import axios from "axios";

const handler = async (m, { conn, usedPrefix, command, text }) => {
    if (!text)
        throw `Apa yang pengen kamu tanyain?\n\nContoh: ${usedPrefix + command} halo bot`; // Membalas pesan apabila tidak ada teks yang terdeteksi selain perintah

    try {
        await m.react('💬'); // Auto react jika fitur dijalankan
        let d = new Date(new Date() + 3600000); // Membuat tanggal sesuai dengan saat ini
        let locale = 'id'; // Berlokasi di Indonesia, sesuaikan jika diperlukan
        const jam = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }); // Menyesuaikan jam dari pusat kota
        let hari = d.toLocaleDateString(locale, { weekday: 'long' }); // Menggunakan hari saat ini
        let tgl = d.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }); // Menggunakan format tanggal hari, bulan, dan tahun
        
        let logic = `Nama kamu adalah Ash-AI, kamu dibuat dan dikembangkan oleh Ashbornaru. Pakailah bahasa gaul, seperti kata gue dan lu dalam menjawab semua pertanyaan. Kamu cerdas dalam menangani masalah apapun. Selalu gunakan emoji yang sesuai dalam setiap kalimat. Gunakan tanggal ${tgl}. Gunakan jam ${jam}. Gunakan hari ${hari}, kamu adalah perempuan`; // Sesuaikan dengan logic yang kamu punya, buat logic sesimple mungkin agar mudah dimengerti oleh AI
        
        let json = await openai(text, logic); // Memanggil fungsi yang dibuat dengan format teks dan logic
        
        // Kirim pesan teks sesuai format yang diinginkan
        await conn.sendMessage(m.chat, {
            text: json, // Hasil dari respon AI
            contextInfo: {
                externalAdReply: {
                    title: 'GPT-4',
                    thumbnailUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSUgq45nsxxSRPEUMhX3Bgzctxv7VT-ieYmdw&usqp=CAU', // URL gambar
                    sourceUrl: 'https://chatgpt.com', // URL sumber
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: m }); // Mengutip pesan yang dikirim oleh pengguna
        
        await m.react('🔥'); // Auto react jika sukses
    } catch (e) {
        await m.react('❎'); // Auto react jika error
    }
};

handler.help = ["gpt4 <teks>", "gpt4"];
handler.tags = ["ai"];
handler.command = /^(openai4|gpt4)$/i;
handler.limit = true;

export default handler;

async function openai(text, logic) { // Membuat fungsi openai untuk dipanggil
    let response = await axios.post("https://chateverywhere.app/api/chat/", {
        "model": {
            "id": "gpt-4",
            "name": "GPT-4",
            "maxLength": 32000,  // Sesuaikan token limit jika diperlukan
            "tokenLimit": 8000,  // Sesuaikan token limit untuk model GPT-4
            "completionTokenLimit": 5000,  // Sesuaikan jika diperlukan
            "deploymentName": "gpt-4"
        },
        "messages": [
            {
                "pluginId": null,
                "content": text, 
                "role": "user"
            }
        ],
        "prompt": logic, 
        "temperature": 0.5
    }, { 
        headers: {
            "Accept": "/*/",
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        }
    });
    
    let result = response.data;
    return result;
};