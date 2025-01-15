import axios from 'axios';
import cheerio from 'cheerio';

const handler = async (m, { conn, text, args, usedPrefix, command }) => {
    if (!text) throw `*⚡ Wuthering Waves Character Info*\n
*Cara Penggunaan:*
${usedPrefix + command} <nama_karakter>

*Contoh:* 
${usedPrefix + command} jinhsi

*Note:*
• Gunakan nama karakter dalam bahasa Inggris
• Nama karakter harus sesuai dengan yang ada di website
• Contoh karakter: baizhi, gevurah, jinhsi, lan`;

    try {
        // Format character name
        const characterName = text.toLowerCase().trim().replace(/\s+/g, '');
        
        // Fetch character data
        const { data } = await axios.get(`https://wuthering.gg/characters/${characterName}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

        const $ = cheerio.load(data);
        
        // Basic Info dengan perbaikan pada scraping rarity dan nama
        const nama_character = $('.name h1').text().trim();
        
        // Perbaikan untuk scraping rarity
        let bintang = '';
        if ($('.name').hasClass('q5')) {
            bintang = '⭐⭐⭐⭐⭐'; // 5-star character
        } else if ($('.name').hasClass('q4')) {
            bintang = '⭐⭐⭐⭐'; // 4-star character
        }
        
        const deskripsi = $('.description').text().trim();
        const senjata = $('.buble').eq(0).find('p').text().trim();
        const elemen = $('.element p').text().trim();
        const birthday = $('.birthday p').text().trim();
        const max_level = $('.ascension .top-h2 span').text().replace('Max Level: ', '').trim();
        const introduction = $('.intro .container p').eq(1).text().trim();

        // Materials
        const materials = [];
        $('.ascension .list .consume').each((i, elem) => {
            const materialName = $(elem).find('.name').text().trim();
            const materialCost = $(elem).find('.cost').text().trim();
            materials.push({ material: materialName, cost: materialCost });
        });

        // Stats
        const stats = {};
        $('.stats .item').each((i, elem) => {
            const statName = $(elem).find('.text span').text().trim();
            const statValue = $(elem).find('.value').text().trim();
            stats[statName] = statValue;
        });

        // Character Image dengan perbaikan
        const characterImg = $('.left img').attr('src');

        // Format the response with emojis and better formatting
        let responseText = `╔══════『 *WUTHERING WAVES* 』══════╗\n\n`;
        responseText += `┌──『 *CHARACTER INFO* 』──┐\n`;
        responseText += `│ *🎭 Name:* ${nama_character}\n`;
        responseText += `│ *💫 Rarity:* ${bintang}\n`;
        responseText += `│ *🗡️ Weapon:* ${senjata}\n`;
        responseText += `│ *🌟 Element:* ${elemen}\n`;
        responseText += `│ *🎂 Birthday:* ${birthday}\n`;
        responseText += `│ *📊 Max Level:* ${max_level}\n`;
        responseText += `└────────────────┘\n\n`;

        if (introduction) {
            responseText += `┌──『 *INTRODUCTION* 』──┐\n`;
            responseText += `${introduction}\n`;
            responseText += `└────────────────┘\n\n`;
        }

        if (Object.keys(stats).length > 0) {
            responseText += `┌──『 *BASE STATS* 』──┐\n`;
            for (const [stat, value] of Object.entries(stats)) {
                responseText += `│ *${stat}:* ${value}\n`;
            }
            responseText += `└────────────────┘\n\n`;
        }

        if (materials.length > 0) {
            responseText += `┌──『 *ASCENSION MATERIALS* 』──┐\n`;
            materials.forEach(({ material, cost }) => {
                responseText += `│ • ${material}: ${cost}\n`;
            });
            responseText += `└────────────────┘\n\n`;
        }

        if (deskripsi) {
            responseText += `┌──『 *DESCRIPTION* 』──┐\n`;
            responseText += `${deskripsi}\n`;
            responseText += `└────────────────┘\n`;
        }

        // Send response with image if available
        if (characterImg) {
            const imageUrl = characterImg.startsWith('http') ? characterImg : `https://wuthering.gg${characterImg}`;
            try {
                const imageBuffer = await axios.get(imageUrl, { 
                    responseType: 'arraybuffer',
                    headers: {
                        'Referer': 'https://wuthering.gg',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                const buffer = Buffer.from(imageBuffer.data);
                await conn.sendFile(m.chat, buffer, 'character.jpg', responseText, m);
            } catch (imgError) {
                console.error('Error fetching image:', imgError);
                m.reply(`${responseText}\n\n_Note: Failed to load character image_`);
            }
        } else {
            m.reply(responseText);
        }
        
    } catch (error) {
        console.error(error);
        m.reply(`An error occurred. Please make sure you entered the correct character name.\n\nError: ${error.message}`);
    }
};

handler.help = ['wuwa <character_name>'];
handler.tags = ['game', 'info', 'internet', 'anime'];
handler.command = /^(wuwa|wutheringwaves)$/i;
handler.limit = true;

export default handler;