import axios from 'axios';
import cheerio from 'cheerio';

const handler = async (m, { conn, text, args, usedPrefix, command }) => {
    if (!text) throw `*Cara Penggunaan:*\n
1️⃣ Mencari talent: ${usedPrefix + command} talent <nama>
Contoh: ${usedPrefix + command} talent kobo kanaeru

2️⃣ Melihat berita: ${usedPrefix + command} news <region?> <halaman?>
Contoh: ${usedPrefix + command} news         (default: JP, page 1)
        ${usedPrefix + command} news id      (ID, page 1)
        ${usedPrefix + command} news en 2    (EN, page 2)

*Region yang tersedia:*
• jp - Japan (default)
• en - English
• id - Indonesia`;

    try {
        const [action, ...params] = text.split(' ');
        
        if (action.toLowerCase() === 'talent') {
            const talentName = params.join(' ')
                                   .toLowerCase()
                                   .replace(/\s+/g, '-'); 
            
            const { data } = await axios.get(`https://hololive.hololivepro.com/en/talents/${talentName}/`);
            const $ = cheerio.load(data);
            
            const name = $('.talent_top .bg_box h1').contents().not('span').text().trim() + 
                        ` (${$('.talent_top .bg_box h1 span').text().trim()})`;
            const desc = $('.talent_top .bg_box p').text().trim();
            const img = $('.talent_top figure img').attr('src');
            
            let socialMedia = [];
            $('.right_box .t_sns.clearfix li a').each((i, el) => {
                socialMedia.push(`${$(el).text().trim()}: ${$(el).attr('href')}`);
            });
            
            let talentInfo = {};
            $('.talent_data .left dl').each((i, el) => {
                const key = $(el).find('dt').text().trim();
                const value = $(el).find('dd').html().trim().replace(/<br\s*\/?>/g, ', ');
                talentInfo[key] = value;
            });
            
            let response = `*『 HOLOLIVE TALENT INFO 』*\n\n`;
            response += `*🎭 Nama:* ${name}\n`;
            response += `*📝 Deskripsi:* ${desc}\n\n`;
            response += `*『 INFORMASI DETAIL 』*\n`;
            
            for (const [key, value] of Object.entries(talentInfo)) {
                response += `*${key}:* ${value}\n`;
            }
            
            response += `\n*『 MEDIA SOSIAL 』*\n`;
            response += socialMedia.map(social => `▢ ${social}`).join('\n');
            
            if (img) {
                await conn.sendFile(m.chat, img, 'talent.jpg', response, m);
            } else {
                m.reply(response);
            }
            
        } else if (action.toLowerCase() === 'news') {
            let region = 'jp';  
            let page = 1;      
            
            if (params.length > 0) {
                if (['en', 'id', 'jp'].includes(params[0].toLowerCase())) {
                    region = params[0].toLowerCase();
                    if (params[1]) page = parseInt(params[1]);
                } else {
                    if (!isNaN(params[0])) page = parseInt(params[0]);
                }
            }
            
            let baseUrl = 'https://hololive.hololivepro.com';
            if (region === 'en') baseUrl += '/en';
            else if (region === 'id') baseUrl += '/id';
            
            const { data } = await axios.get(`${baseUrl}/news/?paged=${page}`);
            const $ = cheerio.load(data);
            
            let response = `*『 HOLOLIVE NEWS - ${region.toUpperCase()} 』*\n`;
            response += `*📄 Page:* ${page}\n\n`;
            
            $('.in_news ul li').each((i, el) => {
                if (i < 5) {
                    const date = $(el).find('.date').text().trim();
                    const title = $(el).find('dt').contents().not('.date').text().trim();
                    const url = $(el).find('a').attr('href');
                    
                    response += `*📅 Tanggal:* ${date}\n*📑 Judul:* ${title}\n*🔗 Link:* ${url}\n\n`;
                }
            });
            
            response += `\n*Tip:* Gunakan ${usedPrefix + command} news <region> <halaman>\n`;
            response += `Region: jp (default), en, id`;
            
            await m.reply(response);
            
        } else {
            throw `Command tidak valid. Gunakan:\n${usedPrefix + command} talent <nama>\n${usedPrefix + command} news <region?> <halaman?>`;
        }
        
    } catch (error) {
        console.error(error);
        m.reply(`Terjadi kesalahan. Pastikan input yang Anda masukkan benar.\n\nError: ${error.message}`);
    }
};

handler.help = [
    'hololive talent <nama_talent> - Mencari info talent HoloLive',
    'hololive news <region?> <halaman?> - Melihat berita HoloLive (region: jp/en/id)'
];
handler.tags = ['internet', 'anime', 'info'];
handler.command = /^(hololive)$/i;
handler.limit = true;

export default handler;
