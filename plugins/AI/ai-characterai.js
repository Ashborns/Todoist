import CharacterAI from "../../lib/ai/characterAI.js";
import axios from "axios";
import * as cheerio from 'cheerio';

const characterAI = new CharacterAI('./database/characterAI.json');

const handler = async (m, { conn, text, command, isOwner }) => {
    if (!text) throw `*Contoh:* .characterai *[set/search/token]*`;

    if (text.startsWith('set')) {
        let id = text.slice(4);
        if (!id) throw `*Contoh:* .characterai set xxx-xxxxxx-xxxx\n\nCharacter ID bisa dicari dengan perintah .characterai search namaCharacter`;
        
        // Send success message first
        await m.reply(`[ ✓ ] Berhasil Mengganti Character ID`);
        
        // Initialize if needed
        if (!characterAI.initate) {
            await characterAI.loadData();
        }
        
        // Then set user and get greeting via ask
        await characterAI.setUser(m.sender, id);
        const result = await characterAI.ask(m.pushName || 'Ash', m.sender, null, '', true);
        
        // Finally send greeting if available
        if (result?.ai?.greeting) {
            await conn.sendMessage(m.chat, {
                text: result.ai.greeting,
                contextInfo: {
                    externalAdReply: {
                        title: result.ai.name || 'Character AI',
                        body: 'character AI',
                        thumbnailUrl: result.ai.avatar_url || 'https://character.ai/favicon.ico',
                        sourceUrl: "https://character.ai",
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            });
        }
    } else if (text.startsWith('token')) {
        if (!characterAI.initate) {
            await characterAI.loadData();
        }

        if (!isOwner) throw `Hanya Owner yang bisa mengganti token`;
        if (!text.slice(6)) throw `*Contoh:* .characterai token xxx-xxxxxx-xxxx`;

        characterAI.user_id = null;
        characterAI.userData = {};
        characterAI.token = text.slice(6);
        await characterAI.saveData();
        m.reply("[ ✓ ] Berhasil Mengganti Token");
    } else if (text.startsWith('search')) {
        let name = text.slice(7);
        if (!name) throw `*Contoh:* .characterai search namaCharacter`;

        await conn.sendMessage(m.chat, { react: { text: `⏱️`, key: m.key }});

        const result = await searchCharacter(name);
        let caption = '*✧ RESULT CHARACTER AI ✧*\n\n';

        // Format yang konsisten untuk semua platform
        for (let i = 0; i < result.length; i++) {
            const char = result[i];
            caption += `*${i + 1}. ${char.participant__name}*\n`;
            caption += `> *Title:* ${char.title}\n`;
            caption += `> *Score:* ${char.score}\n`;
            caption += `> *Character ID:* ${char.external_id}\n`;
            caption += `> *Greeting:* ${char.greeting || 'No greeting available'}\n\n`;
            caption += `──────────────────\n\n`;
        }

        caption += `Balas pesan ini dengan nomor karakter yang ingin dipilih.`;

        await conn.sendMessage(m.chat, { react: { text: `✅`, key: m.key }});

        const { key } = await conn.sendMessage(m.chat, {
            text: caption,
            contextInfo: {
                externalAdReply: {
                    title: `Character Search: ${name}`,
                    body: 'Character AI',
                    thumbnailUrl: result[0]?.avatar_file_name ? 
                        'https://characterai.io/i/400/static/avatars/' + result[0].avatar_file_name : 
                        'https://character.ai/favicon.ico',
                    sourceUrl: 'https://character.ai',
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        });

        // Store the search results and message key for later reference
        conn.characterSearch = conn.characterSearch || {};
        conn.characterSearch[m.chat] = {
            results: result,
            key: key,
            timeout: setTimeout(() => {
                conn.sendMessage(m.chat, { delete: key });
                delete conn.characterSearch[m.chat];
            }, 120000) // 120 seconds timeout
        };
    }
};


handler.before = async (m, { conn }) => {
    // Handle character selection from search results
    if (conn.characterSearch?.[m.chat]) {
        const { results, key, timeout } = conn.characterSearch[m.chat];
        
        if (m.quoted && m.quoted.id === key.id && m.text) {
            const index = parseInt(m.text.trim()) - 1;
            
            if (!isNaN(index) && index >= 0 && index < results.length) {
                const selectedChar = results[index];
                
                // Set the selected character
                await characterAI.setUser(m.sender, selectedChar.external_id);
                
                // Clean up
                clearTimeout(timeout);
                delete conn.characterSearch[m.chat];
                
                await conn.sendMessage(m.chat, { delete: key });
                
                // Send success message first
                await m.reply(`[ ✓ ] Berhasil mengganti karakter ke: ${selectedChar.participant__name}`);

                // Then send greeting
                if (selectedChar.greeting) {
                    await conn.sendMessage(m.chat, {
                        text: selectedChar.greeting,
                        contextInfo: {
                            externalAdReply: {
                                title: selectedChar.participant__name,
                                body: 'character AI',
                                thumbnailUrl: selectedChar.avatar_file_name ? 
                                    'https://characterai.io/i/400/static/avatars/' + selectedChar.avatar_file_name : 
                                    'https://character.ai/favicon.ico',
                                sourceUrl: "https://character.ai",
                                mediaType: 1,
                                renderLargerThumbnail: false
                            }
                        }
                    });
                }
                return;
            } else if (!isNaN(index)) {
                return m.reply('⚠️ Nomor karakter tidak valid. Silakan pilih nomor yang tersedia.');
            }
        }
    }

    // Original chatbot functionality
    if (m.isBaileys && m.fromMe) return;
    if (!m.text) return;
    let chatbot = global.db.data.users[m.sender].chatbot;
    if (!chatbot || chatbot !== 'characterai') return;

    if (
        m.text.startsWith(".") ||
        m.text.startsWith("#") ||
        m.text.startsWith("!") ||
        m.text.startsWith("/") ||
        m.text.startsWith("\\/")
    ) return;

    if (m.message.reactionMessage) return;

    try {
        await conn.sendMessage(m.chat, { react: { text: `⏱️`, key: m.key }});

        const newChat = m.text.trim().toLowerCase() === '--newchat';
        if (newChat) {
            // Pastikan characterAI sudah diinisialisasi
            if (!characterAI.initate) {
                await characterAI.loadData();
            }

            // Tambahkan error handling dan logging
            console.log('Starting new chat for user:', m.sender);
            
            const { ai } = await characterAI.ask(m.pushName || 'Ash', m.sender, null, '', true);
            console.log('AI response received:', ai);

            if (ai && ai.greeting) {
                console.log('Sending greeting:', ai.greeting);
                
                try {
                    await conn.sendMessage(m.chat, {
                        text: ai.greeting,
                        contextInfo: {
                            externalAdReply: {
                                title: ai.name || 'Character AI',
                                body: 'character AI',
                                thumbnailUrl: ai.avatar_url || 'https://character.ai/favicon.ico',
                                sourceUrl: "https://character.ai",
                                mediaType: 1,
                                renderLargerThumbnail: false
                            }
                        }
                    });
                    
                    await conn.sendMessage(m.chat, { react: { text: `✅`, key: m.key }});
                } catch (sendError) {
                    console.error('Error sending greeting:', sendError);
                    throw sendError;
                }
            } else {
                console.log('No greeting available in AI response');
                await m.reply("Berhasil memulai chat baru, tapi tidak ada greeting tersedia.");
            }
            return;
        }

        const username = m.pushName || 'Ash';
        const { response, ai } = await characterAI.ask(username, m.sender, null, m.text, newChat);
        
        await conn.sendMessage(m.chat, { react: { text: `✅`, key: m.key }});

        await conn.sendMessage(m.chat, {
            text: response,
            contextInfo: {
                externalAdReply: {
                    title: ai.name || 'Character AI',
                    body: 'character AI',
                    thumbnailUrl: ai.avatar_url || 'https://character.ai/favicon.ico',
                    sourceUrl: "https://character.ai",
                    mediaType: 1,
                    renderLargerThumbnail: false
                }
            }
        });
    } catch (error) {
        console.error('CharacterAI Error:', error);
        await conn.sendMessage(m.chat, { react: { text: `❌`, key: m.key }});
        await m.reply("Maaf, terjadi kesalahan saat memproses permintaan Anda. Error: " + error.message);
    }
};

handler.help = ['characterai set <charID>', 'characterai bearer <token>'];
handler.command = ['characterai'];
handler.tags = ['ai'];
handler.limit = true;

export default handler;

async function searchCharacter(query) {
    const url = `https://character.ai/search?q=${encodeURIComponent(query)}`;
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        const scriptTag = $('#__NEXT_DATA__');
        if (scriptTag.length === 0) {
            throw new Error('Script tag with id "__NEXT_DATA__" not found.');
        }

        const jsonData = JSON.parse(scriptTag.html());
        let result = jsonData.props.pageProps.prefetchedSearchResults.slice(0, 20);
        return result;
    } catch (error) {
        console.error('Error fetching or parsing data:', error);
        throw error;
    }
}