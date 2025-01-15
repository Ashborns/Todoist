import Groq from 'groq-sdk';
import fs from 'fs';

class RoleGPT{
    constructor(path) {
        this.dataPath = path || './rolegpt.json';
        this.userData = {};
        this.characters = {}
        this.apiKey = null;
        this.groq = null;
        this.limitHistory = 50000;
        this.initate = false;
    }

    async loadData() {
        try {
            let data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
            this.userData = data.user
            this.characters = data.characters
            this.apiKey = data.apiKey
            this.initate = true
        } catch (error) {
            this.initate = true
        }
    }

    async saveData() {
        try {
            let data = JSON.stringify({ user: this.userData, characters: this.characters, apiKey: this.apiKey }, null, 4);
            fs.writeFileSync(this.dataPath, data);
        } catch (error) {
            throw error;
        }
    }

    async connect() {
        try {
            this.groq = new Groq({
                apiKey: this.apiKey
            });
        } catch (error) {
            throw error;
        }
    }

    async ask(sender = '0000', character = null, prompt) {
        try {
            if (!this.initate) await this.loadData();
            if (!this.groq) await this.connect();
            if (!this.userData[sender]) await this.setUser(sender, character);
            if (!prompt) throw 'Percakapan tidak boleh kosong!';

            let payload = this.userData[sender]

            if (prompt === "--newchat") {
                this.userData[sender]['history'] = []
                await this.saveData();
                return {
                    response: "Percakapan baru telah dibuat. Silahkan lanjutkan percakapan Anda.",
                };
            }

            if (payload.history.length === 0) {
                payload.history.push(
                    {
                        role: "system",
                        content: this.characters[payload.character].description
                    }
                );
            }

            payload.history.push(
                {
                    role: "user",
                    content: prompt
                }
            );

            const response = await this.groq.chat.completions.create({
                messages: payload.history,
                model: "llama-3.1-70b-versatile"
            });
    
            const responseText = response.choices[0]?.message?.content || null;
    
            if (!responseText) return {
                response: "Maaf, terjadi kesalahan saat memproses permintaan Anda.",
            }

            payload.history.push(
                {
                    role: "assistant",
                    content: responseText
                }
            );
    
            this.userData[sender]['history'] = this.limitHistoryTokens(payload.history, this.limitHistory);

            await this.saveData();
    
            return {
                response: responseText,
                ai: this.characters[payload.character],
            }
        } catch (error) {
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
                'history': []
            }

            await this.saveData();
        } catch (error) {
            throw error;
        }
    }

    async newCharacter(name, description, avatar_url) {
        try {
            if (this.characters[name]) throw 'Character already exists';

            this.characters[name] = {
                name: name,
                description: description,
                avatar_url: avatar_url || 'https://media.kasperskycontenthub.com/wp-content/uploads/sites/43/2023/10/13075034/sl-blue-chat-bot-scaled.jpg'
            }

            await this.saveData();

            return true
        } catch (error) {
            throw error;
        }
    }

    limitHistoryTokens(history, maxTokens) {
        let currentTokens = history.reduce((totalTokens, message) => {
            return totalTokens + message.content ? this.countWords(message.content): 0;
        }, 0);
    
        while (currentTokens > maxTokens && history.length > 3) {
            const removedTokens = this.countWords(history[1].content) + this.countWords(history[2].content ? history[2].content : history[3].content);
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

export default RoleGPT