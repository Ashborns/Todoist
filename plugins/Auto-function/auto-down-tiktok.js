const limit = 80;
const getUsedPrefix = () => process.env.USED_PREFIX || "."; // Set default prefix

export async function before(m) {
  // Jika pesan berasal dari Baileys atau tidak ada teks, keluar dari fungsi
  if (m.isBaileys || !m.text || m.quoted) return false; // Tambahkan pengecekan untuk mengabaikan pesan yang merupakan balasan

  // Mencari link TikTok yang cocok dalam teks
  const matches = m.text.trim().match(/(http(?:s)?:\/\/)?(?:www\.)?(?:tiktok\.com\/@[^\/]+\/video\/(\d+))|(http(?:s)?:\/\/)?vm\.tiktok\.com\/([^\s&]+)|(http(?:s)?:\/\/)?vt\.tiktok\.com\/([^\s&]+)/g),
        chat = db.data.chats[m.chat]; // Mengakses status chat dari database

  // Jika ada link TikTok yang cocok dan fitur autodlTiktok aktif di chat tersebut
  if (matches && matches[0] && chat.autodlTiktok) {
    m.react(wait); // Reaksi untuk menandakan proses sedang berlangsung
    
    try {
      const videoUrl = matches[0];
      const usedPrefix = getUsedPrefix();  // Mengambil prefix secara dinamis
      
      // Set metadata atau flag pada pesan yang dikirim agar tidak tereksekusi ulang
      return conn.ctaButton.setBody("Tautan TikTok terdeteksi. Apakah Anda ingin mengunduhnya?")
        .addReply("🎥 Mp4", `${usedPrefix}tiktok ${videoUrl}`, { quoted: m })     // Sama untuk Mp4
        .run(m.chat, conn, m);
    } catch (e) {
      console.error(e); // Jika terjadi error, tampilkan di konsol
    }
  }
}

export const disabled = false;
