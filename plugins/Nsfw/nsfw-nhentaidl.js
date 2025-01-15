import fetch from 'node-fetch';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import { extractImageThumb } from '@whiskeysockets/baileys';

const handler = async (m, { conn, usedPrefix, command, text }) => {
    if (!db.data.chats[m.chat].nsfw && m.isGroup) return m.reply(global.nsfw);
    
    let user = global.db.data.users[m.sender].age;
    if (user < 17) m.reply('❎ Kamu belum cukup umur! Silakan kembali ketika kamu berusia di atas 18 tahun');
    
    if (!text) return m.reply(`Contoh\n${usedPrefix + command} 344253`);
    if (isNaN(text)) return m.reply(`Contoh\n${usedPrefix + command} 344253`);
    
    let f = await fetch(API('https://api.lolhuman.xyz', `/api/nhentai/${text}`, null, 'apikey'));
    let xx = await f.json();
    
    await m.reply('_In progress, please wait..._');
    let pages = xx.result.image;
    let buffer = await (await fetch(xx.result.image[0])).buffer();
    let jpegThumbnail = await extractImageThumb(buffer);
    let imagepdf = await toPDF(pages);
    
    await conn.sendMessage(m.chat, { document: imagepdf, jpegThumbnail, fileName: `${text}.pdf`, mimetype: 'application/pdf' }, { quoted: m });
};

handler.help = ['nhentaidl'];
handler.tags = ['nsfw'];
handler.command = /^(nhentaidl)$/i;
handler.premium = true;
handler.nsfw = true;
handler.register = true;
handler.age = 18;

export default handler;

async function toPDF(images, opt = {}) {
    return new Promise(async (resolve, reject) => {
        if (!Array.isArray(images)) images = [images];
        
        let buffs = [];
        let doc = new PDFDocument({
            margin: 0,
            size: 'A4'
        });
        
        for (let x = 0; x < images.length; x++) {
            if (/.webp|.gif/.test(images[x])) continue;
            
            let { data } = await axios.get(images[x], {
                responseType: 'arraybuffer', ...opt
            });
            
            doc.image(data, 0, 0, {
                fit: [595.28, 841.89],
                align: 'center',
                valign: 'center'
            });
            
            if (images.length !== x + 1) doc.addPage();
        }
        
        doc.on('data', (chunk) => buffs.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffs)));
        doc.on('error', (err) => reject(err));
        doc.end();
    });
}
