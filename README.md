# 📅 WhatsApp Todoist Bot

Sebuah plugin pengingat tugas (reminder) yang powerful untuk WhatsApp Bot, memungkinkan pengguna untuk membuat, mengelola, dan menerima pengingat tugas secara otomatis.

## 👥 Tim Pengembang (Project 6)
Project: Aplikasi Pengingat Harian Todoist

Anggota:
- Muhammad Fathi Aryasatya (20230801153)
- Fuzail Fazle Rabbi (20230801167)
- Ananda Rizky M (20230801097)
- Marchello Kristy Wijaya (20230801013)
- Valentino Wijaya (20230801142)

## 📋 Daftar Isi
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Fitur](#fitur)
- [Penggunaan](#penggunaan)
- [Arsitektur & Logika Program](#arsitektur--logika-program)
- [Konten File](#konten-file)

## 🛠 Prasyarat

- Ubuntu/Debian OS
- Node.js v14 atau lebih tinggi
- Git
- FFmpeg
- ImageMagick

## ⚙️ Instalasi

### 1. Clone Repository
```bash
git clone git@github.com:Ashborns/Todoist.git
cd Todoist
```

### 2. Setup Ubuntu Dependencies
```bash
apt update && apt full-upgrade
apt install wget curl git ffmpeg imagemagick build-essential libcairo2-dev \
libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev dbus-x11 ffmpeg2theora \
ffmpegfs ffmpegthumbnailer ffmpegthumbnailer-dbg ffmpegthumbs libavcodec-dev \
libavcodec-extra libavcodec-extra58 libavdevice-dev libavdevice58 libavfilter-dev \
libavfilter-extra libavfilter-extra7 libavformat-dev libavformat58 libavifile-0.7-bin \
libavifile-0.7-common libavifile-0.7c2 libavresample-dev libavresample4 libavutil-dev \
libavutil56 libpostproc-dev libpostproc55 graphicsmagick graphicsmagick-dbg \
graphicsmagick-imagemagick-compat graphicsmagick-libmagick-dev-compat groff \
imagemagick-6.q16hdri imagemagick-common libchart-gnuplot-perl libgraphics-magick-perl \
libgraphicsmagick++-q16-12 libgraphicsmagick++1-dev
```

### 3. Install Node.js
```bash
apt install nodejs
```

### 4. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 5. Menjalankan Bot
```bash
# Menggunakan QR Code
node . index.js --qr

# Atau menggunakan Pairing Code
node . index.js --pairing
```

## ✨ Fitur

1. **Manajemen Pengingat**
   - Membuat pengingat baru dengan berbagai format waktu
   - Melihat daftar pengingat aktif
   - Menghapus pengingat berdasarkan ID

2. **Format Waktu yang Didukung**
   - Standard (DD/MM/YYYY|HH:mm)
   - Relatif (hari ini, besok, minggu depan)
   - Short Date (DD/MM HH:mm)
   - Natural Date (DD bulan HH:mm)

3. **Fitur Keamanan**
   - Enable/Disable per grup
   - Validasi format waktu
   - Pencegahan pengingat waktu lampau

## 🎯 Penggunaan

### Perintah Dasar
```bash
# Mengaktifkan/Menonaktifkan Todoist
.todoist on
.todoist off

# Membuat Pengingat Baru
.todoist <pesan> <waktu>

# Melihat Daftar Pengingat
.listtodoist

# Menghapus Pengingat
.deltodoist <task_id>
```

### Contoh Format Waktu
```bash
.todoist Kerjakan PR Matematika 25/10/2024|14:30
.todoist Meeting dengan client hari ini jam 16:00
.todoist Rapat tim besok jam 09:00
.todoist Deadline project 25 oktober 16:45
```

## 🏗 Arsitektur & Logika Program

Berikut adalah penjelasan detail tentang komponen-komponen utama dalam program:

### 1. Class TodoistManager (Pengelola Data Utama)
Class utama yang menangani semua operasi Todoist:

```javascript
class TodoistManager {
    constructor(filename) {
        this.filename = filename;
        this.data = {
            todos: {},  // Format: { chatId: { taskId: { message, time, sender } } }
            settings: {} // Format: { chatId: { enabled: boolean } }
        };
        this.initialize();
    }
    // Constructor untuk inisialisasi
    initialize() {
        try {
            const dir = dirname(this.filename);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            this.loadData();
        } catch (error) {
            console.error('Error initializing TodoistManager:', error);
            this.data = { todos: {}, settings: {} };
            this.saveData();
        }
    }

    // Menyimpan data ke file JSON
    saveData() {
        try {
            writeFileSync(this.filename, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    // Menambah pengingat baru
    addTodo(chatId, sender, message, time) {
        if (!chatId || !sender || !message || !time) {
            throw new Error('Missing required parameters');
        }
    
        if (!this.isEnabled(chatId)) {
            throw new Error('Todoist tidak aktif. Gunakan ".todoist on" untuk mengaktifkan');
        }
    
        const taskId = Date.now().toString();
        if (!this.data.todos[chatId]) {
            this.data.todos[chatId] = {};
        }
    
        this.data.todos[chatId][taskId] = {
            message,
            time,
            sender
        };
    
        this.saveData();
        return taskId;
    }
}
```

### 2. Pengiriman Pengingat (Reminder Handler)
```javascript
async function sendReminder(conn, chatId, taskId, todoData) {
    try {
        const reminderKey = `${chatId}-${taskId}-${todoData.time}`;
        
        // Mencegah pengiriman ganda
        if (sentReminders.has(reminderKey)) {
            console.log(`[TODOIST] Reminder ${reminderKey} already sent, skipping`);
            return;
        }

        sentReminders.add(reminderKey);

        // Format pesan pengingat
        const dateTime = new Date(todoData.time);
        const dateStr = dateTime.toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        const timeStr = dateTime.toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        // Membuat pesan pengingat yang terformat
        const caption = `╭─❑ 「 *PENGINGAT TUGAS* 」 ❑──
│
├ 👤 *Untuk:* @${todoData.sender.split("@")[0]}
├ 📅 *Tanggal:* ${dateStr}
├ ⏰ *Waktu:* ${timeStr} WIB
│
├ 📝 *Pesan:*
│ ${todoData.message}
│
╰─❑ 「 *Todoist* 」 ❑──`;

        // Mengirim pesan WhatsApp
        await conn.sendMessage(chatId, {
            text: caption,
            contextInfo: {
                mentionedJid: [todoData.sender],
                externalAdReply: {
                    title: "⏰ Pengingat Tugas",
                    body: todoData.message.substring(0, 60) + (todoData.message.length > 60 ? "..." : ""),
                    mediaType: 1,
                    previewType: 0,
                    renderLargerThumbnail: true,
                    thumbnailUrl: "https://fal.media/files/monkey/vozfKYUEVXqyzPXiYEr8I.png",
                    sourceUrl: "https://chat.whatsapp.com"
                }
            }
        });

        // Hapus task setelah terkirim
        this.removeTodo(chatId, taskId);

        // Hapus dari daftar pengingat terkirim setelah 1 menit
        setTimeout(() => {
            sentReminders.delete(reminderKey);
        }, 60000);

    } catch (err) {
        console.error(`[TODOIST] Failed to send reminder to ${chatId}:`, err);
        sentReminders.delete(`${chatId}-${taskId}-${todoData.time}`);
    }
}
```

### 3. Sistem Penjadwalan
```javascript
function scheduleNextReminder(conn) {
    const todos = todoManager.getAllTodos();
    const now = new Date();
    let nextTask = null;
    let nextTime = Infinity;

    // Mencari tugas terdekat
    for (const [chatId, chatTodos] of Object.entries(todos)) {
        for (const [taskId, todoData] of Object.entries(chatTodos)) {
            const todoTime = new Date(todoData.time).getTime();
            const timeUntilReminder = todoTime - now.getTime();
            
            if (timeUntilReminder > 0 && timeUntilReminder < nextTime) {
                nextTask = { chatId, taskId, todoData };
                nextTime = timeUntilReminder;
            }
        }
    }
    // ... scheduling logic
}
```

### 3. Handler Perintah (Command Handler)
```javascript
let handler = async (m, { conn, text, command }) => {
    try {
        // Handle berbagai perintah
        switch (command) {
            case 'todoist': {
                // Aktivasi/Deaktivasi Todoist
                if (text === 'on') {
                    todoManager.setEnabled(m.chat, true);
                    m.reply('✅ Todoist telah diaktifkan untuk grup ini!');
                    return;
                } else if (text === 'off') {
                    todoManager.setEnabled(m.chat, false);
                    m.reply('❌ Todoist telah dinonaktifkan untuk grup ini!');
                    return;
                }

                // Proses pembuatan pengingat baru
                let dateTimeStr = '';
                let message = '';
                let matchFound = false;

                // Cek pola waktu yang cocok
                for (const pattern of Object.values(patterns)) {
                    const match = text.match(pattern);
                    if (match) {
                        dateTimeStr = match[0];
                        message = text.slice(0, text.lastIndexOf(dateTimeStr)).trim();
                        matchFound = true;
                        break;
                    }
                }

                // Buat pengingat jika format valid
                if (matchFound) {
                    const dateTime = parseDateTime(dateTimeStr);
                    const taskId = todoManager.addTodo(m.chat, m.sender, message, dateTime.toISOString());
                    // ... handle sukses
                }
                break;
            }
            
            case 'listtodoist': {
                const todos = todoManager.getTodos(m.chat);
                // ... tampilkan daftar pengingat
                break;
            }
            
            case 'deltodoist': {
                const deleted = todoManager.removeTodo(m.chat, text);
                // ... handle hasil penghapusan
                break;
            }
        }
    } catch (error) {
        console.error('[TODOIST] Error in handler:', error);
        m.reply(`❌ Terjadi kesalahan saat memproses perintah`);
    }
};
```

### 4. Parser Waktu (DateTime Parser)
```javascript
function parseDateTime(input) {
    const patterns = {
        standard: /\d{1,2}\/\d{1,2}\/\d{4}\|\d{1,2}:\d{1,2}$/,
        tomorrow: /besok(?:\s+jam)?\s+\d{1,2}[:.]\d{1,2}$/,
        nextWeek: /minggu\s+depan(?:\s+jam)?\s+\d{1,2}[:.]\d{1,2}$/,
        today: /hari\s+ini(?:\s+jam)?\s+\d{1,2}[:.]\d{1,2}$/,
        shortDate: /\d{1,2}\/\d{1,2}\s+\d{1,2}[:.]\d{1,2}$/,
        naturalDate: /\d{1,2}\s+(?:jan|feb|mar|apr|mei|jun|jul|ags|sep|okt|nov|des)[a-z]*\s+\d{1,2}[:.]\d{1,2}$/
    };
    // Pattern matching untuk berbagai format waktu
    let dateObj;

    switch (matchedPattern) {
        case 'standard': {
            // Format: DD/MM/YYYY|HH:mm
            const [date, time] = input.split('|');
            const [day, month, year] = date.trim().split('/');
            const [hours, minutes] = time.trim().split(':');

            dateObj = new Date(Date.UTC(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hours) - 7, // Konversi ke WIB
                parseInt(minutes)
            ));
            break;
        }

        case 'tomorrow': {
            // Format: besok jam HH:mm
            const [hours, minutes] = input.match(/\d{1,2}[:.]\d{1,2}$/)[0].split(/[:.]/);
            dateObj = new Date(Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() + 1,
                parseInt(hours) - 7,
                parseInt(minutes)
            ));
            break;
        }

        case 'natural': {
            // Format: DD bulan HH:mm
            const match = input.match(/(\d{1,2})\s+([a-z]+)\s+(\d{1,2})[:](\d{1,2})/);
            const month = monthNames[match[2].substring(0, 3)];
            dateObj = new Date(Date.UTC(
                now.getUTCFullYear(),
                month,
                parseInt(match[1]),
                parseInt(match[3]) - 7,
                parseInt(match[4])
            ));
            break;
        }
        // ... more cases
    }

    if (isNaN(dateObj.getTime())) {
        throw new Error('Tanggal atau waktu tidak valid');
    }

    return dateObj;
}
```

### 5. Helper Functions
```javascript
// Konversi waktu UTC ke WIB
function formatToWIB(date) {
    return new Date(date).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

// Format countdown untuk display
function formatCountdown(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
}
```

### 6. Teknologi dan Fitur Khusus

1. **Persistent Storage**
   - Menggunakan sistem file JSON untuk menyimpan data
   - Auto-backup dan recovery system
   - Struktur data yang terorganisir per chat group

2. **Time Management**
   - Support multiple time zones (UTC to WIB conversion)
   - Natural language date parsing
   - Intelligent scheduling system

3. **Error Handling**
   - Robust error catching dan recovery
   - Verbose logging untuk debugging
   - Failsafe mechanisms untuk mencegah duplikasi

4. **Performance Optimizations**
   - Efficient reminder scheduling
   - Memory management untuk large-scale usage
   - Cleanup mechanisms untuk old data

## 📁 Konten File

File `owner-todoist.js` terletak di `/root/Todoist/plugins/Owner` dan terdiri dari beberapa komponen utama:

1. **Data Management**
   - File-based JSON storage
   - CRUD operations untuk pengingat
   - Settings management per grup

2. **Time Processing**
   - Parsing berbagai format waktu
   - Konversi zona waktu (UTC ke WIB)
   - Validasi waktu

3. **Reminder System**
   - Scheduling algorithm
   - Auto-deletion setelah reminder terkirim
   - Duplicate prevention

4. **Message Handling**
   - Command parsing
   - Error handling
   - Response formatting

## 🤝 Kontribusi

Kontribusi selalu diterima! Silakan buat Pull Request untuk perbaikan atau penambahan fitur.

## 📝 Catatan

- Pastikan bot memiliki izin admin di grup untuk mengirim pengingat
- Backup database secara berkala
- Perhatikan penggunaan memori saat menambahkan banyak pengingat

---