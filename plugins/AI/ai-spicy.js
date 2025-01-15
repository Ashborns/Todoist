import SpicyAI from "../../lib/ai/spicyAI.js";
const {
    getDevice,
    proto,
    generateWAMessageFromContent
} = (await import('@whiskeysockets/baileys')).default

const spicyAI = new SpicyAI('./database/spicyAI.json');

let handler = async (m, { conn, text, command, isOwner }) => {
    if (!text) throw `*Contoh:* .spicy *[set/search/bearer]*`;

    if (text.startsWith('set')) {
        let id = text.slice(4);
        if (!id) throw `*Contoh:* .spicy set xxx-xxxxxx-xxxx\n\nCharacter ID bisa dicari dengan perintah .spicy search namaCharacter`;
        await spicyAI.setUser(m.sender, id);

        let char = await spicyAI.infoChar(id);
        await m.reply(`[ ✓ ] Berhasil Mengganti Character Menjadi *${char.name}*`);
        
        // Send character greeting after success message
        if (char.greeting) {
            await conn.sendMessage(m.chat, {
                text: char.greeting,
                contextInfo: {
                    externalAdReply: {
                        title: char.name,
                        body: 'AI Chatbot',
                        thumbnailUrl: char.avatar_url,
                        sourceUrl: `https://spicychat.ai/`,
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            });
        }
    } else if (text.startsWith('bearer')) {
        if (!spicyAI.load) {
            await spicyAI.loadData();
        }

        if (!isOwner) throw `Hanya Owner yang bisa mengganti bearer token`;
        if (!text.slice(7)) throw `*Contoh:* .spicy bearer xxx-xxxxxx-xxxx`;

        spicyAI.bearer = text.slice(7);
        await spicyAI.saveData();
        m.reply("[ ✓ ] Berhasil Mengganti Token");
    } else if (text.startsWith('search')) {
        let name = text.slice(7);
        if (!name) throw `*Contoh:* .spicy search namaCharacter`;

        await conn.sendMessage(m.chat, { react: { text: `⏱️`, key: m.key }});

        let res = await spicyAI.searchCharacters(name);
        if (!res) throw `Character ${name} Tidak Ditemukan`;

        let result = res.results[0].hits.slice(0, 10);
        let caption = '*✧ RESULT SPICY AI ✧*\n\n';

        for (let i = 0; i < result.length; i++) {
            const doc = result[i].document;
            caption += `*${i + 1}. ${doc.name}*\n`;
            caption += `> *Title:* ${doc.title}\n`;
            caption += `> *NSFW:* ${doc.is_nsfw ? 'Yes' : 'No'}\n`;
            caption += `> *Character ID:* ${doc.character_id}\n\n`;
            caption += `──────────────────\n\n`;
        }

        caption += `Balas pesan ini dengan nomor karakter yang ingin dipilih.`;

        await conn.sendMessage(m.chat, { react: { text: `✅`, key: m.key }});

        const { key } = await conn.sendMessage(m.chat, {
            text: caption,
            contextInfo: {
                externalAdReply: {
                    title: `Character Search: ${name}`,
                    body: 'SpicyAI',
                    thumbnailUrl: "https://spicychat.ai/favicon.ico",
                    sourceUrl: 'https://spicychat.ai',
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        });

        conn.spicySearch = conn.spicySearch || {};
        conn.spicySearch[m.chat] = {
            results: result,
            key: key,
            timeout: setTimeout(() => {
                conn.sendMessage(m.chat, { delete: key });
                delete conn.spicySearch[m.chat];
            }, 120000)
        };
    }
};

handler.before = async (m, { conn }) => {
    if (conn.spicySearch?.[m.chat]) {
        const { results, key, timeout } = conn.spicySearch[m.chat];
        
        if (m.quoted && m.quoted.id === key.id && m.text) {
            const index = parseInt(m.text.trim()) - 1;
            
            if (!isNaN(index) && index >= 0 && index < results.length) {
                const selectedChar = results[index];
                
                await spicyAI.setUser(m.sender, selectedChar.document.character_id);
                
                clearTimeout(timeout);
                delete conn.spicySearch[m.chat];
                
                await conn.sendMessage(m.chat, { delete: key });
                await m.reply(`[ ✓ ] Berhasil mengganti karakter ke: ${selectedChar.document.name}`);

                // Send character greeting after selecting from search
                if (selectedChar.document.greeting) {
                    await conn.sendMessage(m.chat, {
                        text: selectedChar.document.greeting,
                        contextInfo: {
                            externalAdReply: {
                                title: selectedChar.document.name,
                                body: 'AI Chatbot',
                                thumbnailUrl: selectedChar.document.avatar_url,
                                sourceUrl: `https://spicychat.ai/`,
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

    if (m.isBaileys && m.fromMe) return;
    if (!m.text) return;
    if (m.sender === 'status@broadcast') return;
    if (m.isGroup) return;
    let chatbot = global.db.data.users[m.sender].chatbot;
    if (!chatbot || chatbot !== 'spicyai') return;

    if (
        m.text.startsWith(".") ||
        m.text.startsWith("#") ||
        m.text.startsWith("!") ||
        m.text.startsWith("/") ||
        m.text.startsWith("\\/")
    ) return;

    if (m.message.reactionMessage) return

    try {
        await conn.sendMessage(m.chat, { react: { text: `⏱️`, key: m.key } });

        const type = m.text === "--auto" ? 'autopilot' : m.text === "--continue" ? 'continue_chat' : 'message';
        let res = await spicyAI.ask(m.sender, null, m.text, type);
        let caption;
        if (m.text === '--auto') {
            caption = `*[ YOU ]*\n${res.content}\n\n*[ ${res.ai.name} ]*\n${res.response.message.content}`;
        } else {
            caption = res.response.message.content;
        }

        await conn.sendMessage(m.chat, { react: { text: `✅`, key: m.key } });

        conn.sendMessage(m.chat, {
            text: caption,
            contextInfo: {
                externalAdReply: {
                    title: res.ai.name,
                    body: 'AI Chatbot',
                    thumbnailUrl: res.ai.avatar_url,
                    sourceUrl: `https://spicychat.ai/`,
                    mediaType: 1,
                    renderLargerThumbnail: false
                }
            }
        });
    } catch (error) {
        console.log(error);
        m.reply("Maaf, terjadi kesalahan saat memproses permintaan Anda.");
    }
};

handler.command = ['spicy'];
handler.tags = ["ai"];
handler.help = ['spicy set <charID>', 'spicy bearer <token>'];

export default handler;