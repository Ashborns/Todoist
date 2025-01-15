import Groq from 'groq-sdk';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { GoogleGenerativeAI } from '@google/generative-ai';

class PayloadHandler {
    static normalizeHistoryForStorage(messages) {
        // Normalize messages to standard format for storage
        return messages.map(msg => ({
            role: msg.role === 'model' ? 'assistant' : msg.role,
            content: typeof msg.parts === 'object' ? msg.parts[0].text : msg.content
        }));
    }

    static formatForGroq(messages) {
        // Groq expects simple role/content format
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }

    static formatForGemini(messages) {
        // Gemini expects different role names and parts array
        return messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : msg.role,
            parts: [{text: msg.content}]
        }));
    }

    static async saveHistory(userData, sender, messages, activeModel) {
        // Normalize before saving to ensure consistent storage format
        userData[sender].history = this.normalizeHistoryForStorage(messages);
    }

    static formatForModel(messages, model) {
        switch(model) {
            case 'groq':
                return this.formatForGroq(messages);
            case 'gemini':
                return this.formatForGemini(messages);
            default:
                throw new Error(`Unsupported model: ${model}`);
        }
    }
}

class RoleGPT {
    constructor(path) {
        this.dataPath = path || './database/rolegpt.json';
        this.userData = {};
        this.characters = {};
        this.apiKeys = {
            groq: null,
            gemini: null
        };
        this.activeModel = 'groq'; // Default model
        this.clients = {
            groq: null,
            gemini: null
        };
        this.limitHistory = 50000;
        this.initate = false;

        // Model configurations
        this.modelConfigs = {
            groq: {
                model: "llama-3.1-70b-versatile",
                init: (apiKey) => new Groq({ apiKey }),
                chat: async (client, messages) => {
                    // Format ke format Groq sebelum kirim
                    const formattedMessages = PayloadHandler.formatForGroq(messages);
                    const response = await client.chat.completions.create({
                        messages: formattedMessages,
                        model: "llama-3.1-70b-versatile"
                    });
                    return response.choices[0]?.message?.content || null;
                }
            },
            gemini: {
                model: "gemini-1.5-flash",
                init: (apiKey) => new GoogleGenerativeAI(apiKey),
                chat: async (client, messages) => {
                    try {
                        const model = client.getGenerativeModel({ 
                            model: "gemini-1.5-flash",
                            safetySettings: [
                                {
                                    category: "HARM_CATEGORY_HARASSMENT",
                                    threshold: "BLOCK_NONE" 
                                },
                                {
                                    category: "HARM_CATEGORY_HATE_SPEECH",
                                    threshold: "BLOCK_NONE"
                                },
                                {
                                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                                    threshold: "BLOCK_NONE"
                                },
                                {
                                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                                    threshold: "BLOCK_NONE"
                                }
                            ]
                        });
            
                        // Format ke format Gemini sebelum kirim
                        const formattedMessages = PayloadHandler.formatForGemini(messages);
                        
                        // Extract system prompt (character description)
                        const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
            
                        // Get chat history excluding system message
                        const chatHistory = formattedMessages.filter(m => m.role !== 'system');
                        
                        // Buat chat session dengan history
                        const chat = model.startChat({
                            history: chatHistory,
                            generationConfig: {
                                maxOutputTokens: 2048,
                            }
                        });
            
                        // Ambil pesan terakhir dari user
                        const lastMessage = messages[messages.length - 1].content;
                        
                        // Combine system prompt with last message for every interaction
                        const combinedMessage = systemPrompt 
                            ? `${systemPrompt}\n\nUser message: ${lastMessage}`
                            : lastMessage;
                        
                        // Kirim pesan yang sudah dikombinasikan
                        const result = await chat.sendMessage([{ 
                            text: combinedMessage 
                        }]);
                        
                        const response = await result.response;
                        return response.text();
                    } catch (error) {
                        console.error('Error in Gemini chat:', error);
                        throw error;
                    }
                }
            }
        };
    }

    async loadData() {
        try {
            const fileExists = fs.existsSync(this.dataPath);
            if (fileExists) {
                let data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
                this.userData = data.user || {};
                this.characters = data.characters || {};
                this.apiKeys = data.apiKeys || {};
                this.activeModel = data.activeModel || 'groq';
            } else {
                this.characters = {
                    'default': {
                        name: 'Assistant',
                        description: 'I am a helpful AI assistant.',
                        avatar_url: 'https://media.kasperskycontenthub.com/wp-content/uploads/sites/43/2023/10/13075034/sl-blue-chat-bot-scaled.jpg'
                    }
                };
                await this.saveData();
            }
            this.initate = true;
        } catch (error) {
            console.error('Error loading data:', error);
            this.initate = true;
        }
    }

    async saveData() {
        try {
            const dir = './database';
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            let data = JSON.stringify({
                user: this.userData,
                characters: this.characters,
                apiKeys: this.apiKeys,
                activeModel: this.activeModel
            }, null, 2);
            
            fs.writeFileSync(this.dataPath, data);
        } catch (error) {
            console.error('Error saving data:', error);
            throw error;
        }
    }

    async connect() {
        try {
            const model = this.activeModel;
            const apiKey = this.apiKeys[model];
            
            if (!apiKey) {
                throw new Error(`API Key not set for ${model}`);
            }

            if (!this.modelConfigs[model]) {
                throw new Error(`Model ${model} not supported`);
            }

            this.clients[model] = this.modelConfigs[model].init(apiKey);
        } catch (error) {
            console.error('Error connecting to AI service:', error);
            throw error;
        }
    }

    async ask(sender = '0000', character = null, prompt) {
        try {
            if (!this.initate) await this.loadData();
            if (!this.clients[this.activeModel]) await this.connect();
            if (!this.userData[sender]) await this.setUser(sender, character);
            if (!prompt) throw 'Conversation cannot be empty!';
    
            let payload = this.userData[sender];
    
            if (prompt === "--newchat") {
                this.userData[sender]['history'] = [];
                await this.saveData();
                return {
                    response: "New conversation created. Please continue.",
                };
            }
    
            // History selalu disimpan dalam format standar
            if (payload.history.length === 0) {
                payload.history.push({
                    role: "system",
                    content: this.characters[payload.character].description
                });
            }
    
            payload.history.push({
                role: "user",
                content: prompt
            });
    
            // Model config akan menformat sesuai kebutuhan masing-masing model
            const response = await this.modelConfigs[this.activeModel].chat(
                this.clients[this.activeModel],
                payload.history
            );
    
            if (!response) return {
                response: "Sorry, there was an error processing your request.",
            };
    
            // Simpan response dalam format standar
            const updatedHistory = [
                ...payload.history,
                { role: "assistant", content: response }
            ];
            
            // Normalize sebelum simpan ke database
            this.userData[sender].history = PayloadHandler.normalizeHistoryForStorage(updatedHistory);
            await this.saveData();
    
            return {
                response: response,
                ai: this.characters[payload.character],
            };
        } catch (error) {
            console.error('Error in ask:', error);
            throw error;
        }
    }

    async setUser(user, character) {
        try {
            if (!this.initate) {
                await this.loadData();
            }

            this.userData[user] = {
                'character': character || 'default',
                'history': [],
                'audioEnabled': true // Default audio setting
            };

            await this.saveData();
        } catch (error) {
            console.error('Error setting user:', error);
            throw error;
        }
    }

    async setAudioSetting(user, enabled) {
        try {
            if (!this.initate) await this.loadData();
            
            if (!this.userData[user]) {
                await this.setUser(user, 'default');
            }
            
            this.userData[user].audioEnabled = enabled;
            await this.saveData();
            return true;
        } catch (error) {
            console.error('Error setting audio:', error);
            throw error;
        }
    }

    async getAudioSetting(user) {
        try {
            if (!this.initate) await this.loadData();
            
            if (!this.userData[user]) {
                await this.setUser(user, 'default');
            }
            
            return this.userData[user].audioEnabled;
        } catch (error) {
            console.error('Error getting audio setting:', error);
            return true; // Default to true if error
        }
    }

    async newCharacter(name, description, avatar_url) {
        try {
            if (this.characters[name]) throw 'Character already exists';

            this.characters[name] = {
                name: name,
                description: description || 'No description provided',
                avatar_url: avatar_url || 'https://media.kasperskycontenthub.com/wp-content/uploads/sites/43/2023/10/13075034/sl-blue-chat-bot-scaled.jpg'
            };

            await this.saveData();
            return true;
        } catch (error) {
            console.error('Error creating new character:', error);
            throw error;
        }
    }

    async setModel(model) {
        if (!this.modelConfigs[model]) {
            throw new Error(`Model ${model} not supported`);
        }
        this.activeModel = model;
        await this.saveData();
        return true;
    }

    async setApiKey(model, apiKey) {
        if (!this.modelConfigs[model]) {
            throw new Error(`Model ${model} not supported`);
        }
        this.apiKeys[model] = apiKey;
        await this.saveData();
        return true;
    }

    getAvailableModels() {
        return Object.keys(this.modelConfigs);
    }

    limitHistoryTokens(history, maxTokens) {
        let currentTokens = history.reduce((totalTokens, message) => {
            return totalTokens + (message.content ? this.countWords(message.content) : 0);
        }, 0);
    
        while (currentTokens > maxTokens && history.length > 3) {
            const removedTokens = this.countWords(history[1].content) + 
                this.countWords(history[2].content ? history[2].content : history[3].content);
            currentTokens -= removedTokens;
            if (!history[2].content) {
                history.splice(1, 3);
            } else {
                history.splice(1, 2);
            }
        }
    
        return history;
    }

    countWords(text) {
        return text.split(/\s+/).length;
    }

}

// Function to send text and audio response
async function sendTextAndAudioResponse(m, conn, text, ai, audioEnabled = true) {
    try {
        // Send text response with AI character context first
        await conn.sendMessage(m.chat, {
            text: text,
            contextInfo: {
                externalAdReply: {
                    title: ai.name,
                    body: 'character AI',
                    thumbnailUrl: ai.avatar_url,
                    sourceUrl: "https://character.ai",
                    mediaType: 1,
                    renderLargerThumbnail: false
                }
            }
        });

        // Only proceed with audio if enabled
        if (audioEnabled) {
            // Clean text for TTS
            const cleanText = text
                .replace(/\[\d+\]/g, '')
                .replace(/\[.*?\]/g, '')
                .replace(/Citations:[\s\S]*/, '')
                .replace(/```[\s\S]*?```/g, '')
                .replace(/http[s]?:\/\/\S+/g, '')
                .replace(/[^\w\s.,!?-]/g, '')
                .trim();

            if (cleanText) {
                try {
                    const apiUrl = `https://api.yanzbotz.live/api/tts/tts-multi?query=${encodeURIComponent(cleanText)}&apiKey=yanzdev`;

                    // Send audio response
                    await conn.sendMessage(m.chat, {
                        audio: {
                            url: apiUrl
                        },
                        ptt: true,
                        mimetype: 'audio/mp4'
                    }, { quoted: m });
                } catch (ttsError) {
                    console.error('TTS Error:', ttsError);
                }
            }
        }
    } catch (error) {
        console.error('Error in sendTextAndAudioResponse:', error);
        throw error;
    }
}

async function uploadToWidipe(buffer, mime) {
    try {
        // Validate buffer
        if (!buffer || buffer.length === 0) {
            throw new Error('Invalid image buffer');
        }

        // Validate file size (5MB limit)
        if (buffer.length > 5 * 1024 * 1024) {
            throw new Error('Image size too large (max 5MB)');
        }

        // Create form data
        const formData = new FormData();
        const filename = `image_${Date.now()}.${mime.split('/')[1]}`;
        
        formData.append('file', buffer, {
            filename,
            contentType: mime
        });

        // Upload to Widipe
        const response = await axios.post('https://widipe.com/api/upload.php', formData, {
            headers: {
                ...formData.getHeaders()
            },
            timeout: 15000, // 15 second timeout
            maxBodyLength: Infinity
        });

        // Validate response
        if (!response.data || !response.data.result || !response.data.result.url) {
            throw new Error('Invalid response from upload server');
        }

        // Verify URL is accessible
        const imageUrl = response.data.result.url;
        await axios.head(imageUrl);

        return imageUrl;
    } catch (error) {
        console.error('Upload error:', error);
        throw new Error(`Image upload failed: ${error.message}`);
    }
}

let handler = async (m, { conn, text, isOwner }) => {
    if (!text) throw `*Example:* .rolegpt *[set/character/newchar/key/audio/model/user]*`;
    if (!rolegpt.initate) {
        await rolegpt.loadData();
    }

    if (text.startsWith('audio')) {
        const setting = text.slice(6).trim().toLowerCase();
        if (!['on', 'off'].includes(setting)) {
            throw `*Format Salah!*\n\n*Contoh:* .rolegpt audio on/off`;
        }

        const enabled = setting === 'on';
        await rolegpt.setAudioSetting(m.sender, enabled);
        m.reply(`[ ✓ ] Berhasil mengubah pengaturan audio menjadi ${setting.toUpperCase()}`);

    } else if (text.startsWith('set')) {
        let character = text.slice(4).trim();
        if (!character) throw `*Contoh:* .rolegpt set default\n\nCharacter bisa dicari dengan perintah .rolegpt character`;
        if (!rolegpt.characters[character]) throw `Character ${character} Tidak Ditemukan`;

        await rolegpt.setUser(m.sender, character);
        m.reply(`[ ✓ ] Berhasil Mengganti Character ID`);

    } else if (text.startsWith('character')) {
        let caption = '*✧ LIST CHARACTER ✧*\n\n';
        let char = Object.keys(rolegpt.characters);

        if (!char.length) throw `Tidak Ada Character yang ditambahkan`;

        for (let i = 0; i < char.length; i++) {
            const character = rolegpt.characters[char[i]];
            caption += `*• ${char[i]}*\n`;
            if (character.description) {
                caption += `Description: ${character.description}\n`;
            }
            caption += '\n';
        }

        m.reply(caption);


    } else if (text.startsWith('newchar')) {
        if (!isOwner) throw `Hanya Owner yang bisa menambahkan character`;

        const data = text.slice(8).trim();
        let [character, description] = data.split('|').map(item => item?.trim());
        
        if (!character || !description) {
            throw `*Format Salah!*\n\n*Contoh:* .rolegpt newchar nama|deskripsi\n*Note:* Reply gambar untuk menggunakan avatar custom`;
        }

        let imageUrl = null;
        const quotedMsg = m.quoted;

        if (quotedMsg && quotedMsg.mimetype?.startsWith('image/')) {
            // Validate mime type
            const validMimes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!validMimes.includes(quotedMsg.mimetype)) {
                throw `Format gambar tidak valid. Hanya mendukung JPG dan PNG.`;
            }

            try {
                const buffer = await quotedMsg.download();
                imageUrl = await uploadToWidipe(buffer, quotedMsg.mimetype);
                
                if (!imageUrl?.startsWith('http')) {
                    throw new Error('Invalid upload response');
                }
            } catch (error) {
                console.error('Error processing image:', error);
                throw `Gagal mengupload gambar: ${error.message}. Silakan coba lagi atau gunakan avatar default.`;
            }
        }

        character = character.replace(/\s+/g, '_');

        try {
            const defaultAvatar = 'https://media.kasperskycontenthub.com/wp-content/uploads/sites/43/2023/10/13075034/sl-blue-chat-bot-scaled.jpg';
            let result = await rolegpt.newCharacter(character, description, imageUrl || defaultAvatar);
            
            if (!result) throw `Character *${character}* Gagal dibuat`;
            
            m.reply(`[ ✓ ] Berhasil Menambahkan Character *${character}*${imageUrl ? '\nAvatar berhasil diupload' : '\nMenggunakan avatar default'}`);
        } catch (error) {
            if (error.message === 'Character already exists') {
                throw `Character *${character}* sudah ada!`;
            }
            throw `Gagal membuat character: ${error.message}`;
        }


    } else if (text.startsWith('delchar')) {
        if (!isOwner) throw `Hanya Owner yang bisa menghapus character`;

        let character = text.slice(8).trim();
        if (!character) throw `*Contoh:* .rolegpt delchar default\n\nCharacter ID bisa dicari dengan perintah .rolegpt character`;
        if (!rolegpt.characters[character]) throw `Character *${character}* Tidak Ditemukan`;

        delete rolegpt.characters[character];
        await rolegpt.saveData();
        m.reply(`[ ✓ ] Berhasil Menghapus Character *${character}*`);
        

    } else if (text.startsWith('key')) {
        if (!isOwner) throw `Only Owner can set API keys`;
        
        const args = text.slice(4).trim().split(' ');
        if (args.length !== 2) {
            throw `*Format Error!*\n\n*Example:* .rolegpt key groq xxx-xxxxxx-xxxx`;
        }

        const [model, apiKey] = args;
        if (!rolegpt.modelConfigs[model]) {
            throw `Model ${model} not supported`;
        }

        await rolegpt.setApiKey(model, apiKey);
        m.reply(`[ ✓ ] Successfully set API key for ${model.toUpperCase()}`);


    } else if (text.startsWith('model')) {
        if (!isOwner) throw `Only Owner can change the AI model`;
        
        const modelName = text.slice(6).trim().toLowerCase();
        const availableModels = rolegpt.getAvailableModels();
        
        if (!modelName) {
            const modelList = availableModels.join(', ');
            throw `*Format Error!*\n\n*Example:* .rolegpt model groq\nAvailable models: ${modelList}`;
        }

        if (!availableModels.includes(modelName)) {
            throw `Model ${modelName} not supported. Available models: ${availableModels.join(', ')}`;
        }

        await rolegpt.setModel(modelName);
        m.reply(`[ ✓ ] Successfully changed AI model to ${modelName.toUpperCase()}`);


    } else if (text.startsWith('user')) {
        if (!rolegpt.userData[m.sender]) {
            throw `You haven't started any conversation yet`;
        }
        
        const currentCharacter = rolegpt.characters[rolegpt.userData[m.sender].character];
        const audioStatus = rolegpt.userData[m.sender].audioEnabled;
        
        // Create an aesthetic message box
        let message = `╭━━━━『 User Info 』━━━━╮\n`;
        message += `┃\n`;
        message += `┃ 👤 *User ID*: ${m.sender.split('@')[0]}\n`;
        message += `┃ 🎭 *Current Character*: ${currentCharacter.name}\n`;
        message += `┃ 🤖 *Active Model*: ${rolegpt.activeModel.toUpperCase()}\n`;
        message += `┃ 🔊 *Audio Response*: ${audioStatus ? 'ON' : 'OFF'}\n`;
        message += `┃\n`;
        message += `┃ *Character Description*:\n`;
        message += `┃ ${currentCharacter.description}\n`;
        message += `┃\n`;
        message += `╰━━━━━━━━━━━━━━━━╯`;
    
        // Send the message with the character's avatar
        await conn.sendMessage(m.chat, {
            text: message,
            contextInfo: {
                externalAdReply: {
                    title: currentCharacter.name,
                    body: 'Character Info',
                    thumbnailUrl: currentCharacter.avatar_url,
                    sourceUrl: "https://character.ai",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        });
    }
};

handler.before = async (m, { conn }) => {
    if (m.isBaileys && m.fromMe) return;
    if (m.sender === 'status@broadcast') return;
    if (m.isGroup) return;
    let chatbot = global.db.data.users[m.sender].chatbot;
    if (chatbot && chatbot !== 'rolegpt') return;

    if (
        m.text?.startsWith(".") ||
        m.text?.startsWith("#") ||
        m.text?.startsWith("!") ||
        m.text?.startsWith("/") ||
        m.text?.startsWith("\\/")
    ) return;

    if (m.message?.reactionMessage) return;

    try {
        await conn.sendMessage(m.chat, { react: { text: `⏱️`, key: m.key } });

        // Handle text messages
        if (m.text) {
            const { response, ai } = await rolegpt.ask(m.sender, null, m.text);
            await conn.sendMessage(m.chat, { react: { text: `✅`, key: m.key } });

            if (!ai) return m.reply(response);

            // Get audio setting for user
            const audioEnabled = await rolegpt.getAudioSetting(m.sender);

            // Send response with audio based on user setting
            await sendTextAndAudioResponse(m, conn, response, ai, audioEnabled);
        }
    } catch (error) {
        console.error('Error in handler.before:', error);
        await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply("Maaf, terjadi kesalahan saat memproses permintaan Anda.");
    }
};

// Initialize RoleGPT instance
const rolegpt = new RoleGPT('./database/rolegpt.json');

handler.command = ['rolegpt'];
handler.tags = ["ai"];
handler.help = [
    'rolegpt set <char Name>',
    'rolegpt newchar <char name>|<char description>',
    'rolegpt audio on/off',
    'rolegpt user'
];

export default handler;