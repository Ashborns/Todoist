let handler = async (m, { conn, text }) => {
    if (!text) {
        // Default help message
        return m.reply(`
*📚 FITUR HELP 📚*
1. Ketik .HELP *<NAMA FITUR>* Untuk detail Fitur tersebut lebih lanjut!
2. Ketik *.HELP List* Untuk melihat list fitur yang memiliki penjelasan lebih lanjut
`);
    }

    // Display the list of features when '.help list' is called
    if (text.toLowerCase() === 'list') {
        m.reply(`
*📜 DAFTAR FITUR 📜*
1. *chatai* - .help chatai
2. *characterai* - .help characterai
3. *spicy* - .help spicy
4. *rolegpt* - .help rolegpt
6. *img2img* - .help img2img
7. *txt2img* - .help txt2img
7. *todoist* - .help todoist
8. *yanzgpt* - .help yanzgpt
`);
        return; // Exit after listing the features
    }

    // Handling each specific feature
    if (text.startsWith('spicy')) {
        m.reply(`
*SpicyAI*
*📝 SPICY SET*
Perintah: .spicy set <charID>
Gunakan perintah ini untuk mengatur karakter pada akun Anda menggunakan ID karakter.
Contoh: .spicy set xxx-xxxxxx-xxxx
Anda dapat menemukan ID karakter menggunakan perintah .spicy search <namaCharacter>.

*🔐 SPICY BEARER*
Perintah: .spicy bearer <token>
Perintah ini digunakan untuk mengganti bearer token Anda. 
*Catatan:* Hanya Owner yang memiliki akses untuk mengubah bearer token ini.
Contoh: .spicy bearer xxx-xxxxxx-xxxx

*🔍 SPICY SEARCH*
Perintah: .spicy search <namaCharacter>
Gunakan perintah ini untuk mencari karakter menggunakan nama mereka.
Hasil pencarian akan menampilkan daftar karakter yang sesuai dengan nama yang Anda masukkan.
Contoh: .spicy search irene
`);
    } else if (text.startsWith('chatai')) {
        m.reply(`
*🔄 GANTI CHATBOT*
Perintah: *.chatai <namaChatbot>*
Deskripsi: Gunakan perintah ini untuk mengganti chatbot yang aktif pada sesi chat Anda.

Anda dapat memilih dari daftar chatbot yang tersedia, 
Contoh:
*.chatai rolegpt* - Mengubah chatbot aktif menjadi rolegpt, yang memungkinkan interaksi dalam konteks peran.\n
*.chatai characterai* - Mengubah chatbot aktif menjadi characterai, yang menawarkan pengalaman berbasis AI dengan karakter tertentu.\n
*.chatai spicyai* - Mengubah chatbot aktif menjadi spicyai, yang menawarkan pengalaman berbasis AI dengan karakter tertentu.\n
*.chatai morph* - Mengubah chatbot aktif menjadi morph, untuk pengalaman interaksi yang berbeda.\n
*.chatai roleplai* - Mengubah chatbot aktif menjadi roleplai, sesi roleplai AI dengan role.\n


📜 DAFTAR CHATBOT
Chatbot Tersedia:
*1.rolegpt* - Chatbot untuk interaksi berbasis peran.

*2. characterai* - Chatbot dengan fokus pada karakter tertentu.

*3. spicyai* - Chatbot untuk pengalaman berbasis karakter AI.

*4. morph* - Chatbot dengan fitur interaksi yang bervariasi.

*5. roleplai* - Chatbot yang mendukung permainan peran.

*6. off* - Menonaktifkan chatbot.

*🔍 CATATAN:*
Jika chatbot yang Anda masukkan tidak tersedia, 
Anda akan mendapatkan pesan kesalahan yang menunjukkan chatbot yang dapat dipilih. 
Pastikan untuk mengecek daftar chatbot yang ada agar tidak terjadi kesalahan pengetikan.
            `);
    } else if (text.startsWith('txt2img')) {
        m.reply(`
*🖼️ MENGHASILKAN GAMBAR DARI TEKS*
Perintah: *.txt2img [query]* --option
Deskripsi: Fitur ini memungkinkan pengguna untuk menghasilkan gambar berdasarkan teks yang diberikan. 
Pengguna dapat menyesuaikan model, gaya, dan sampler yang digunakan untuk menghasilkan gambar.

Contoh:
*.txt2img gambar seorang laki-laki ber jas*\n - Menghasilkan gambar berdasarkan prompt "seorang laki laki menggunakan jas" seperti yang di inginkan oleh pengguna.

*ℹ️ PANDUAN PENGGUNAAN*
Mengatur Model: Ketik *.txt2img --model* lalu balas dengan nomor urut model yang ingin dipilih.\n
Mengatur Style: Ketik *.txt2img --style* lalu balas dengan nomor urut style yang ingin dipilih.\n
Mengatur Sampler: Ketik *.txt2img --sampler* lalu balas dengan nomor urut sampler yang ingin dipilih.\n

Membuat Gambar: Ketik *.txt2img [prompt] untuk menghasilkan gambar.\n
Melihat Pengaturan Saat Ini: Ketik *.txt2img --info* untuk menampilkan data model, style, 
dan sampler yang Anda gunakan saat ini.

*📜 DAFTAR PENGATURAN GAMBAR*
Pengguna dapat mengatur pengaturan berikut sebelum menghasilkan gambar:\n
*Model:* Pilihan model yang digunakan untuk menghasilkan gambar. Setiap model memiliki karakteristik yang berbeda.\n
*Style:* Gaya visual yang diterapkan pada gambar. Pengguna dapat memilih gaya yang diinginkan.\n
*Sampler:* Metode yang digunakan untuk menghasilkan gambar. Berbagai sampler dapat memberikan hasil yang bervariasi.\n

*🔍 CATATAN:*
Jika tidak ada teks yang dimasukkan, atau jika prompt yang dimasukkan tidak jelas, 
pengguna akan menerima panduan penggunaan.\n
Pastikan untuk mengikuti petunjuk dengan benar untuk 
menghasilkan gambar sesuai keinginan.
            `);
    } else if (text.startsWith('img2img')) {
        m.reply(`
*🖼️ MENGHASILKAN GAMBAR DENGAN img2img*
Perintah: *.img2img [query]* --option
Deskripsi: Fitur ini memungkinkan pengguna untuk menghasilkan gambar dengan mengubah atau memperbaiki gambar yang ada menggunakan model AI. Pengguna dapat memilih model, gaya, dan sampler yang digunakan dalam proses penggambaran.
Contoh:

*.img2img --model* - Mengatur model yang akan digunakan.
*.img2img --style* - Mengatur gaya gambar.
*.img2img --sampler* - Mengatur metode sampling.
*.img2img [prompt] --model <nomor> --style <nomor> --sampler <nomor>* - Menghasilkan gambar berdasarkan prompt yang diberikan.

*ℹ️ PANDUAN PENGGUNAAN*

Mengatur Model:

Ketik *.img2img --model* untuk memilih model. Balas dengan nomor model yang diinginkan.
Mengatur Gaya:

Ketik *.img2img --style* untuk memilih gaya. Balas dengan nomor gaya yang diinginkan.
Mengatur Sampler:

Ketik *.img2img --sampler* untuk memilih sampler. Balas dengan nomor sampler yang diinginkan.
Membuat Gambar:

Ketik *.img2img [prompt] --model <nomor> --style <nomor> --sampler <nomor>* untuk menghasilkan gambar baru berdasarkan prompt yang diberikan.
Melihat Pengaturan:

Ketik *.img2img --info* untuk menampilkan pengaturan model, gaya, dan sampler yang saat ini digunakan.

*📜 DAFTAR PENGATURAN*
Pengguna dapat mengatur beberapa opsi berikut:

Model: Model AI yang akan digunakan untuk menghasilkan gambar.
Style: Gaya visual yang diterapkan pada gambar.
Sampler: Metode sampling yang digunakan dalam proses penggambaran.

*🔍 CATATAN:*

Jika tidak ada teks yang dimasukkan, pengguna akan menerima pesan panduan.
Pengguna dapat mengubah pengaturan model, gaya, dan sampler secara terpisah.
Hasil gambar yang dihasilkan akan disertai dengan informasi tentang model, gaya, dan sampler yang digunakan.
            `);
    } else if (text.startsWith('characterai')) {
        m.reply(`
*🤖 MENGGUNAKAN CHARACTER AI*
Perintah: *.characterai [set/search/token]*
Deskripsi: Fitur ini memungkinkan pengguna untuk berinteraksi dengan karakter AI dengan mengatur karakter yang diinginkan, mencari karakter berdasarkan nama, dan mengubah token untuk akses AI. Pengguna juga dapat melakukan percakapan dengan karakter yang dipilih.\n
Contoh:

*.characterai set xxx-xxxxxx-xxxx* - Mengatur ID karakter yang akan digunakan.\n
*.characterai search namaCharacter* - Mencari karakter berdasarkan nama.\n
*.characterai token xxx-xxxxxx-xxxx* - Mengganti token untuk akses AI.\n

*ℹ️ PANDUAN PENGGUNAAN*

Mengatur Karakter:
Ketik *.characterai set <charID>* untuk mengatur karakter yang akan digunakan. ID karakter dapat dicari dengan perintah *.characterai search <namaCharacter>*.\n
Contoh: *.characterai set xxx-xxxxxx-xxxx*
Mencari Karakter:

Ketik *.characterai search <namaCharacter>* untuk mencari karakter berdasarkan nama.
Contoh: *.characterai search Batman*
Mengganti Token:

Ketik *.characterai token <token>* untuk mengganti token akses AI. Hanya pemilik yang dapat melakukan ini.
Contoh: *.characterai token xxx-xxxxxx-xxxx*

*📜 DAFTAR PENGATURAN*

Pengguna dapat mengatur beberapa opsi berikut:

Character ID: ID unik yang digunakan untuk mengidentifikasi karakter AI.
Token: Token otorisasi yang diperlukan untuk mengakses API Character AI.

*🔍 CATATAN:*

Jika tidak ada teks yang dimasukkan, pengguna akan menerima pesan kesalahan.
Pengguna dapat berinteraksi dengan karakter AI setelah ID karakter diatur dengan benar.
Hasil pencarian karakter akan ditampilkan dalam format yang sesuai, dan pengguna dapat memilih karakter dari daftar.
            `);
    } else if (text.startsWith('rolegpt')) {
        m.reply(`
*🤖 MENGGUNAKAN ROLEGPT*
Perintah: *.rolegpt [set/character/newchar/key]*
Deskripsi: Fitur ini memungkinkan pengguna untuk berinteraksi dengan karakter AI yang dapat disesuaikan. Pengguna dapat mengatur karakter, menambahkan karakter baru, dan mengelola API key yang digunakan oleh RoleGPT.\n
Contoh:

*.rolegpt set <character_name>* - Mengatur karakter yang sedang digunakan.
*.rolegpt character* - Menampilkan daftar karakter yang tersedia.
*.rolegpt newchar <character_name>|<description>* - Menambahkan karakter baru dengan deskripsi.
*.rolegpt delchar <character_name>* - Menghapus karakter yang ada.
*.rolegpt key <new_api_key>* - Mengganti API key yang digunakan.


*ℹ️ PANDUAN PENGGUNAAN*

Mengatur Karakter:

Ketik *.rolegpt set <character_name>* untuk mengatur karakter yang akan digunakan. Jika karakter tidak ditemukan, sistem akan memberikan pesan kesalahan.\n
Menampilkan Daftar Karakter:

Ketik *.rolegpt character* untuk menampilkan daftar karakter yang telah ditambahkan.\n
Menambahkan Karakter Baru:

Hanya pengguna dengan hak akses pemilik yang dapat menambahkan karakter baru. Ketik *.rolegpt newchar <character_name>|<description>* untuk menambahkan karakter baru. Pengguna juga dapat mengunggah gambar untuk karakter baru.\n
Menghapus Karakter:

Hanya pemilik yang dapat menghapus karakter. Ketik *.rolegpt delchar <character_name>* untuk menghapus karakter yang ada. Jika karakter tidak ditemukan, sistem akan memberikan pesan kesalahan.\n
Mengganti API Key:

Hanya pemilik yang dapat mengganti API key. Ketik *.rolegpt key <new_api_key>* untuk memperbarui API key.\n
*🔍 CATATAN:*

-Jika tidak ada teks yang dimasukkan, pengguna akan menerima pesan kesalahan dengan contoh penggunaan.\n
-Pengguna yang bukan pemilik tidak dapat menambahkan atau menghapus karakter.\n
-Sistem mengelola reaksi pesan saat memproses pertanyaan yang diajukan kepada RoleGPT.\n
-Jika ada kesalahan saat memproses permintaan, pengguna akan menerima pesan kesalahan yang sesuai.
            `);
    } else if (text.startsWith('todoist')) {
        m.reply(`
*🗒️ Panduan Penggunaan Todoist*

Todoist adalah fitur untuk membuat pengingat tugas di grup. Berikut adalah cara penggunaannya:

*📝 Perintah Dasar*

1. Mengaktifkan/Menonaktifkan Todoist
*.todoist on*\n- Mengaktifkan fitur todoist di grup
*.todoist off*\n- Menonaktifkan fitur todoist di grup

2. Membuat Pengingat Baru
*.todoist <pesan pengingat> <tanggal/bulan/tahun|jam:menit>*

Contoh:
*.todoist Kerjakan PR Matematika 25/10/2024|14:30*\n
Ini akan membuat pengingat untuk mengerjakan PR Matematika pada tanggal 25 Oktober 2024 jam 14:30 WIB.

3. Melihat Daftar Pengingat
*.listtodoist*
Perintah ini akan menampilkan semua pengingat yang aktif di grup beserta ID tugasnya.

4. Menghapus Pengingat
*.deltodoist <ID tugas>*
Contoh:
*.deltodoist 1698135678912*

*⚠️ Hal Penting*

Format waktu harus menggunakan format: DD/MM/YYYY|HH:mm
Waktu menggunakan zona waktu WIB (GMT+7)
Pastikan Todoist sudah diaktifkan di grup sebelum membuat pengingat
Simpan ID tugas jika ingin menghapus pengingat di kemudian hari

*🔍 Tips*

-Gunakan format waktu yang benar (contoh: 24/10/2024|15:30)\n-Tulis pesan pengingat yang jelas dan spesifik\n-Periksa daftar pengingat secara berkala dengan .listtodoist\n-Hapus pengingat yang sudah tidak diperlukan untuk menghindari notifikasi yang tidak perlu
            `);
    } else if (text.startsWith('yanzgpt')) {
        m.reply(`
🤖 *PANDUAN PENGGUNAAN YANZCHAT BOT* 🤖\n
──────────────────\n
🔰 *Fitur Utama*:\n
• Chat AI Pintar
• Analisis Gambar
• Pengenalan Suara
• Respon Suara Otomatis
• Akses Model Pro\n
──────────────────\n
📝 *Perintah Dasar*:\n
1. *Mengaktifkan YanzGPT*:
   • Ketik: *.chatai aiyanz*
   • Ini akan mengaktifkan mode chatbot AI\n
2. *Menonaktifkan YanzGPT*:
   • Ketik: *.chatai off*
   • Ini akan menonaktifkan mode chatbot\n
3. *Mengganti Model AI*:
   • Ketik: *.yanzgpt set default* (Model biasa)
   • Ketik: *.yanzgpt set pro* (Model canggih)
   • Ketik: *.yanzgpt model* (Cek model saat ini)\n
──────────────────\n
💬 *Fitur Chat*:\n
1. *Chat Biasa*:
   • Langsung ketik pesanmu
   • Bot akan membalas dengan teks
   • Contoh: "Apa itu kecerdasan buatan?"\n
2. *Balas Pesan*:
   • Balas pesan sebelumnya dengan pertanyaan baru
   • Cocok untuk pertanyaan lanjutan
   • Contoh: Balas "Bisa jelaskan lebih detail?"\n
3. *Chat Pro*:
   • Mulai pesan dengan *pro* untuk respons lebih canggih
   • Contoh: "pro buatkan puisi tentang ibu"\n
──────────────────\n
🎨 *Analisis Gambar*:\n
1. *Kirim Gambar*:
   • Kirim gambar untuk dianalisis
   • Bisa tambah caption untuk pertanyaan spesifik
   • Contoh: Kirim gambar dengan "Apa yang ada di gambar ini?"\n
2. *Balas Gambar*:
   • Balas gambar dengan pertanyaanmu
   • Contoh: Balas "Warna apa saja yang digunakan?"\n
──────────────────\n
🎤 *Fitur Suara*:\n
1. *Input Suara*:
   • Kirim pesan suara untuk diterjemahkan
   • Bot akan mengerti dan merespons
   • Bisa menggunakan bahasa apapun\n
2. *Respons Suara*:
   • Bot membalas dengan teks dan suara
   • Pengucapan yang jelas
   • Suara natural\n
──────────────────\n
⚠️ *Catatan Penting*:\n
• Pastikan pesan suara jelas
• Gambar harus terlihat jelas
• Bot bekerja optimal di chat pribadi
• Perintah dimulai dengan *.* (titik)\n
──────────────────\n
🚫 *Batasan*:\n
• Tidak support grup chat
• Tidak untuk konten dewasa
• Tidak untuk permintaan berbahaya
• Terbatas pada teks, gambar, dan suara\n
──────────────────\n
✨ *Tips Penggunaan*:\n
• Gunakan pertanyaan spesifik untuk jawaban lebih baik
• Coba kedua model untuk tugas berbeda
• Pesan suara bisa dalam bahasa apapun
• Bisa tambahkan caption detail di gambar
• Gunakan fitur balas untuk diskusi mendalam\n
──────────────────\n
📞 *Butuh Bantuan?*
Hubungi owner jika mengalami masalah\n
──────────────────\n
*Happy Chatting* ✨
            `);
    } else if (text.startsWith('')) {
        m.reply(`
            Coming soon!
            `);
    }
    
    else {
        // Fallback if the command does not match any known features
        m.reply(`Fitur *${text}* tidak ditemukan. Silakan cek penulisan atau gunakan perintah *.help* untuk melihat daftar fitur yang tersedia.`);
    }
};

handler.command = ['help'];
handler.tags = ["info"];
handler.help = ['help <fitur>'];

export default handler;
