import axios from 'axios';
import { load } from 'cheerio';

let handler = async (m, { conn, text, command, isOwner }) => {
    if (!text) throw `*Contoh:* .scrape <URL>`;

    const url = text;
    if (!url.startsWith('http')) throw `URL tidak valid. Harus dimulai dengan http atau https.`;

    try {
        // Mengirim permintaan HTTP GET ke URL
        const { data } = await axios.get(url);
        
        // Memuat HTML menggunakan Cheerio
        const $ = load(data);
        
        // Contoh: Mengambil judul halaman
        const pageTitle = $('title').text();

        // Mengambil semua tautan di halaman
        let links = [];
        $('a').each((index, element) => {
            const link = $(element).attr('href');
            if (link) {
                links.push(link);
            }
        });

        // Membuat pesan respons
        let caption = `*Judul Halaman:* ${pageTitle}\n\n*Daftar Tautan Ditemukan:*\n`;
        links.slice(0, 10).forEach((link, i) => {
            caption += `> ${i + 1}. ${link}\n`;
        });

        // Mengirim respons ke pengguna
        m.reply(caption);
    } catch (error) {
        console.log(error);
        m.reply("Maaf, terjadi kesalahan saat melakukan scraping.");
    }
};

handler.command = ['scrape'];
handler.tags = ["tools"];
handler.help = ['scrape <URL>'];

export default handler;