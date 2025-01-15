import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Track sent reminders to prevent duplicates
const sentReminders = new Set();
let connGlobal;

class TodoistManager {
    constructor(filename) {
        this.filename = filename;
        this.data = {
            todos: {},  // Format: { chatId: { taskId: { message, time, sender } } }
            settings: {} // Format: { chatId: { enabled: boolean } }
        };
        this.initialize();
    }

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

    loadData() {
        try {
            if (existsSync(this.filename)) {
                const data = readFileSync(this.filename, 'utf8');
                this.data = JSON.parse(data);
                if (!this.data.todos) this.data.todos = {};
                if (!this.data.settings) this.data.settings = {};
            } else {
                this.data = { todos: {}, settings: {} };
                this.saveData();
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.data = { todos: {}, settings: {} };
            this.saveData();
        }
    }

    saveData() {
        try {
            writeFileSync(this.filename, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    setEnabled(chatId, enabled) {
        if (!this.data.settings[chatId]) {
            this.data.settings[chatId] = {};
        }
        this.data.settings[chatId].enabled = enabled;
        this.saveData();
        return enabled;
    }

    isEnabled(chatId) {
        return this.data.settings[chatId]?.enabled || false;
    }

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
        console.log(`[DEBUG] New task added: ${taskId}, chatId: ${chatId}, time: ${time}`);
    
        // Jadwalkan ulang pengingat untuk tugas baru
        if (connGlobal) {
            console.log(`[TODOIST] New task added. Rescheduling reminders.`);
            scheduleNextReminder(connGlobal);
        }
    
        return taskId;
    }
    

    removeTodo(chatId, taskId) {
        if (!chatId || !taskId) return false;

        try {
            if (this.data.todos[chatId] && this.data.todos[chatId][taskId]) {
                delete this.data.todos[chatId][taskId];
                if (Object.keys(this.data.todos[chatId]).length === 0) {
                    delete this.data.todos[chatId];
                }
                this.saveData();
                return true;
            }
        } catch (error) {
            console.error('Error removing todo:', error);
        }
        return false;
    }

    getTodos(chatId) {
        if (!chatId) return {};
        return this.data.todos[chatId] || {};
    }

    getAllTodos() {
        return this.data.todos || {};
    }

    async sendReminder(conn, chatId, taskId, todoData) {
        try {
            if (!conn || !chatId || !taskId || !todoData) {
                console.log('[TODOIST] Missing required parameters for sendReminder');
                return;
            }

            const reminderKey = `${chatId}-${taskId}-${todoData.time}`;

            if (sentReminders.has(reminderKey)) {
                console.log(`[TODOIST] Reminder ${reminderKey} already sent, skipping`);
                return;
            }

            sentReminders.add(reminderKey);

            console.log(`[TODOIST] Sending reminder for task ${taskId} to ${chatId}`);

            // Enhanced reminder message format with fixed layout
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

            const caption = `╭─❑ 「 *PENGINGAT TUGAS* 」 ❑──
    │
    ├ 👤 *Untuk:* @${todoData.sender.split("@")[0]}
    ├ 📅 *Tanggal:* ${dateStr}
    ├ ⏰ *Waktu:* ${timeStr} WIB
    │
    ├ 📝 *Pesan:*
    │ ${todoData.message}
    │
    ╰─❑ 「 *Ashbornaru* 」 ❑──
    
    _Ketik *.todoist* untuk membuat pengingat baru_`;

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

            // Remove the todo after successfully sending reminder
            this.removeTodo(chatId, taskId);

            setTimeout(() => {
                sentReminders.delete(reminderKey);
            }, 60000);

            console.log(`[TODOIST] Reminder sent and removed for task ${taskId}`);
        } catch (err) {
            console.error(`[TODOIST] Failed to send reminder to ${chatId}:`, err);
            sentReminders.delete(`${chatId}-${taskId}-${todoData.time}`);
        }
    }
}

function parseDateTime(input) {
    try {
        input = input.toLowerCase().trim();
        const now = new Date();
        let dateObj;

        const patterns = {
            standard: /\d{1,2}\/\d{1,2}\/\d{4}\|\d{1,2}:\d{1,2}$/,
            tomorrow: /besok(?:\s+jam)?\s+\d{1,2}[:.]\d{1,2}$/,
            nextWeek: /minggu\s+depan(?:\s+jam)?\s+\d{1,2}[:.]\d{1,2}$/,
            today: /hari\s+ini(?:\s+jam)?\s+\d{1,2}[:.]\d{1,2}$/,
            shortDate: /\d{1,2}\/\d{1,2}\s+\d{1,2}[:.]\d{1,2}$/,
            naturalDate: /\d{1,2}\s+(?:jan|feb|mar|apr|mei|jun|jul|ags|sep|okt|nov|des)[a-z]*\s+\d{1,2}[:.]\d{1,2}$/
        };

        const monthNames = {
            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mei': 4, 'jun': 5,
            'jul': 6, 'ags': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'des': 11
        };

        let matchedPattern = null;
        for (const [key, pattern] of Object.entries(patterns)) {
            if (pattern.test(input)) {
                matchedPattern = key;
                break;
            }
        }

        if (!matchedPattern) {
            throw new Error('Format waktu tidak valid');
        }

        switch (matchedPattern) {
            case 'standard': {
                const [date, time] = input.split('|');
                if (!date || !time) throw new Error('Format waktu tidak valid');

                const [day, month, year] = date.trim().split('/');
                const [hours, minutes] = time.trim().split(':');

                dateObj = new Date(Date.UTC(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hours) - 7,
                    parseInt(minutes)
                ));
                break;
            }

            case 'tomorrow': {
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

            case 'nextWeek': {
                const [hours, minutes] = input.match(/\d{1,2}[:.]\d{1,2}$/)[0].split(/[:.]/);
                dateObj = new Date(Date.UTC(
                    now.getUTCFullYear(),
                    now.getUTCMonth(),
                    now.getUTCDate() + 7,
                    parseInt(hours) - 7,
                    parseInt(minutes)
                ));
                break;
            }

            case 'today': {
                const [hours, minutes] = input.match(/\d{1,2}[:.]\d{1,2}$/)[0].split(/[:.]/);
                dateObj = new Date(Date.UTC(
                    now.getUTCFullYear(),
                    now.getUTCMonth(),
                    now.getUTCDate(),
                    parseInt(hours) - 7,
                    parseInt(minutes)
                ));
                break;
            }

            case 'shortDate': {
                const match = input.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2})[:](\d{1,2})/);
                dateObj = new Date(Date.UTC(
                    now.getUTCFullYear(),
                    parseInt(match[2]) - 1,
                    parseInt(match[1]),
                    parseInt(match[3]) - 7,
                    parseInt(match[4])
                ));

                if (dateObj.getTime() < now.getTime()) {
                    dateObj.setUTCFullYear(now.getUTCFullYear() + 1);
                }
                break;
            }

            case 'naturalDate': {
                const match = input.match(/(\d{1,2})\s+([a-z]+)\s+(\d{1,2})[:](\d{1,2})/);
                const month = monthNames[match[2].substring(0, 3)];
                dateObj = new Date(Date.UTC(
                    now.getUTCFullYear(),
                    month,
                    parseInt(match[1]),
                    parseInt(match[3]) - 7,
                    parseInt(match[4])
                ));

                if (dateObj.getTime() < now.getTime()) {
                    dateObj.setUTCFullYear(now.getUTCFullYear() + 1);
                }
                break;
            }
        }

        if (isNaN(dateObj.getTime())) {
            throw new Error('Tanggal atau waktu tidak valid');
        }

        return dateObj;
    } catch (error) {
        throw new Error('Format waktu tidak valid. Gunakan format yang didukung');
    }
}



// Function to format date to WIB timezone
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

// Function to format countdown
function formatCountdown(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
}

const todoManager = new TodoistManager(join(__dirname, '../../database/todoist.json'));

// Function to check and send reminders
function scheduleNextReminder(conn) {
    try {
        const todos = todoManager.getAllTodos(); // Ambil semua tugas
        if (!todos) {
            console.log("[TODOIST] No tasks found in the database.");
            return;
        }

        const now = new Date();
        let nextTask = null;
        let nextTime = Infinity;

        console.log(`[DEBUG] Current time: ${now}`);

        // Cari tugas dengan waktu terdekat
        for (const [chatId, chatTodos] of Object.entries(todos)) {
            if (!chatTodos) continue;

            for (const [taskId, todoData] of Object.entries(chatTodos)) {
                if (!todoData || !todoData.time) continue;

                const todoTime = new Date(todoData.time).getTime(); // Ambil waktu tugas
                console.log(`[DEBUG] Task ${taskId} time: ${todoTime}`);

                if (isNaN(todoTime)) {
                    console.error(`[TODOIST] Invalid time for task ${taskId}.`);
                    continue;
                }

                const timeUntilReminder = todoTime - now.getTime();
                console.log(`[DEBUG] Time until reminder for task ${taskId}: ${timeUntilReminder} ms`);

                if (timeUntilReminder > 0 && timeUntilReminder < nextTime) {
                    nextTask = { chatId, taskId, todoData };
                    nextTime = timeUntilReminder;
                }
            }
        }

        if (nextTask) {
            console.log(`[TODOIST] Scheduling next reminder for task ${nextTask.taskId} in ${nextTime / 1000} seconds.`);
            setTimeout(() => {
                todoManager.sendReminder(conn, nextTask.chatId, nextTask.taskId, nextTask.todoData);
                scheduleNextReminder(conn); // Jadwalkan tugas berikutnya
            }, nextTime);
        } else {
            console.log("[TODOIST] No upcoming reminders to schedule.");
        }
    } catch (error) {
        console.error("Error in scheduleNextReminder:", error);
    }
}

let handler = async (m, { conn, text, command }) => {
    try {
        // Helper function untuk menampilkan panduan
        const showGuide = () => {
            const guide = `📌 *Panduan Penggunaan Todoist*

*1️⃣ Aktifkan/Nonaktifkan:*
╭─❑
│ ✅ *.todoist on*  — Mengaktifkan
│ ❌ *.todoist off* — Menonaktifkan
╰─❑

*2️⃣ Membuat Pengingat Baru:*
╭─❑
│ Gunakan salah satu format berikut:
│ 
│ • *.todoist <pesan> <tanggal/bulan/tahun|jam:menit>*
│ • *.todoist <pesan> hari ini jam <HH:mm>*
│ • *.todoist <pesan> besok jam <HH:mm>*
│ • *.todoist <pesan> minggu depan jam <HH:mm>*
│ • *.todoist <pesan> <tanggal/bulan jam HH:mm>*
│ • *.todoist <pesan> <tanggal nama_bulan jam HH:mm>*
│
│ *Contoh:*
│ ➡️ *.todoist Kerjakan PR Matematika 25/10/2024|14:30*
│ ➡️ *.todoist Meeting dengan client hari ini jam 16:00*
│ ➡️ *.todoist Rapat tim besok jam 09:00*
╰─❑

*3️⃣ Melihat Daftar Pengingat:*
╭─❑
│ 📋 *.listtodoist* — Melihat semua pengingat
╰─❑

*4️⃣ Menghapus Pengingat:*
╭─❑
│ ❌ *.deltodoist <ID>*
│ 
│ *Contoh:*
│ ➡️ *.deltodoist 1698135678912*
╰─❑

⚠️ *Format Tanggal & Waktu yang Didukung:*
╭─❑
│ 📅 *Tanggal:* DD/MM/YYYY (contoh: 25/10/2024)
│ 🕒 *Waktu:* HH:mm (format 24 jam, contoh: 14:30)
│ ➡️ *Pemisah:* Gunakan simbol | untuk memisahkan tanggal dan waktu
│ 📖 *Nama Bulan:* Gunakan nama bulan seperti Januari, Februari, dll.
╰─❑

❌ *Kesalahan Umum:*
• Gunakan format *DD/MM/YYYY|HH:mm* untuk waktu!
• Tahun harus 4 digit, contoh *2024*!
• Hindari penggunaan tanda yang salah seperti: 25-10-2024 atau 14.30`;

            return guide;
        };

        if (!connGlobal) {
            connGlobal = conn;
            console.log("[TODOIST] Initializing global connection.");
            scheduleNextReminder(conn);
        }        

        switch (command) {
            case 'todoist': {
                if (!text) {
                    m.reply(showGuide());
                    return;
                }

                if (text === 'on') {
                    todoManager.setEnabled(m.chat, true);
                    console.log(`[TODOIST] Enabled for chat ${m.chat}`);
                    m.reply('✅ Todoist telah diaktifkan untuk grup ini!');
                    return;
                } else if (text === 'off') {
                    todoManager.setEnabled(m.chat, false);
                    console.log(`[TODOIST] Disabled for chat ${m.chat}`);
                    m.reply('❌ Todoist telah dinonaktifkan untuk grup ini!');
                    return;
                }

                // Cari pola waktu di akhir pesan
                const patterns = {
                    standard: /\d{1,2}\/\d{1,2}\/\d{4}\|\d{1,2}:\d{1,2}$/,
                    tomorrow: /besok(?:\s+jam)?\s+\d{1,2}[:.]\d{1,2}$/,
                    nextWeek: /minggu\s+depan(?:\s+jam)?\s+\d{1,2}[:.]\d{1,2}$/,
                    today: /hari\s+ini(?:\s+jam)?\s+\d{1,2}[:.]\d{1,2}$/,
                    shortDate: /\d{1,2}\/\d{1,2}\s+\d{1,2}[:.]\d{1,2}$/,
                    naturalDate: /\d{1,2}\s+(?:jan|feb|mar|apr|mei|jun|jul|ags|sep|okt|nov|des)[a-z]*\s+\d{1,2}[:.]\d{1,2}$/
                };

                let dateTimeStr = '';
                let message = '';
                let matchFound = false;

                for (const pattern of Object.values(patterns)) {
                    const match = text.match(pattern);
                    if (match) {
                        dateTimeStr = match[0];
                        message = text.slice(0, text.lastIndexOf(dateTimeStr)).trim();
                        matchFound = true;
                        break;
                    }
                }

                if (!matchFound) {
                    m.reply(`❌ Format waktu tidak valid
            
*Format yang didukung:*
1. DD/MM/YYYY|HH:mm     (25/10/2024|14:30)
2. besok 14:30          (besok jam 14:30)
3. minggu depan 14:30   (minggu depan jam 14:30)
4. hari ini 14:30       (hari ini jam 14:30)
5. DD/MM HH:mm          (25/10 14:30)
6. DD bulan HH:mm       (25 oktober 14:30)

*Contoh penggunaan:*
• .todoist Kerjakan PR Matematika besok 14:30
• .todoist Meeting dengan client minggu depan 09:00
• .todoist Deadline project 25 oktober 16:45`);
                    return;
                }

                try {
                    const dateTime = parseDateTime(dateTimeStr);

                    // Cek apakah waktu yang dimasukkan sudah lewat
                    if (dateTime.getTime() <= new Date().getTime()) {
                        m.reply(`❌ Tidak bisa membuat pengingat untuk waktu yang sudah lewat!\n\n*Contoh waktu yang benar:*
            • Hari ini: ${formatToWIB(new Date(Date.now() + 3600000))} (1 jam dari sekarang)
            • Besok: ${formatToWIB(new Date(Date.now() + 86400000))}
            • Minggu depan: ${formatToWIB(new Date(Date.now() + 7 * 86400000))}`);
                        return;
                    }

                    const taskId = todoManager.addTodo(m.chat, m.sender, message, dateTime.toISOString());
                    const timeUntilReminder = dateTime.getTime() - new Date().getTime();

                    if (timeUntilReminder > 0 && timeUntilReminder <= 60000) {
                        setTimeout(() => {
                            todoManager.sendReminder(conn, m.chat, taskId, {
                                message,
                                time: dateTime.toISOString(),
                                sender: m.sender
                            });
                        }, timeUntilReminder);
                    }

                    m.reply(`✅ *Pengingat Berhasil Dibuat!*

📝 *Detail Pengingat:*
╭─❑
│ 🗒️ *Pesan:* ${message}
│ 📅 *Tanggal:* ${formatToWIB(dateTime)}
│ ⏰ *ID:* ${taskId}
│ 🔔 *Diingatkan dalam:* ${formatCountdown(timeUntilReminder)}
╰─❑

💡 *Tips:*
• Simpan ID pengingat untuk menghapusnya nanti
• Gunakan *.listtodoist* untuk melihat daftar pengingat
• Gunakan *.deltodoist ${taskId}* untuk menghapus pengingat ini`);


                    } catch (error) {
                    m.reply(`❌ ${error.message}\n\n*Format waktu yang benar:*
• DD/MM/YYYY|HH:mm
• besok 14:30
• minggu depan 09:00
• hari ini 16:45
• 25/10 14:30
• 25 oktober 14:30`);
                }
                break;
            }

            case 'listtodoist': {
                const todos = todoManager.getTodos(m.chat);
                if (!todos || Object.keys(todos).length === 0) {
                    m.reply(`Tidak ada pengingat yang aktif.

*Cara membuat pengingat baru:*
.todoist [pesan] [tanggal/bulan/tahun|jam:menit]

*Contoh:*
.todoist Kerjakan PR Matematika 25/10/2024|14:30`);
                    return;
                }

                let list = '*📝 Daftar Pengingat Aktif:*\n\n';
                for (const [taskId, todo] of Object.entries(todos)) {
                    if (!todo || !todo.time) continue;
                    const date = new Date(todo.time);
                    if (isNaN(date.getTime())) continue;
                    list += `📌 *ID:* ${taskId}
📝 *Pesan:* ${todo.message}
⏰ *Waktu:* ${formatToWIB(date)}
⏳ *Sisa waktu:* ${formatCountdown(date.getTime() - new Date().getTime())}\n\n`;
                }
                list += `\n💡 *Cara menghapus pengingat:*
Gunakan perintah .deltodoist [ID]
Contoh: .deltodoist ${Object.keys(todos)[0]}`;

                m.reply(list);
                break;
            }

            case 'deltodoist': {
                if (!text) {
                    m.reply(`❌ Masukkan ID tugas yang akan dihapus

*Format yang benar:*
.deltodoist [ID]

*Contoh:*
.deltodoist 1698135678912

💡 *Tips:*
• Gunakan .listtodoist untuk melihat ID tugas
• ID adalah angka panjang yang unik untuk setiap tugas`);
                    return;
                }

                const deleted = todoManager.removeTodo(m.chat, text);
                if (deleted) {
                    m.reply('✅ Pengingat berhasil dihapus!');
                } else {
                    m.reply(`❌ *Pengingat Tidak Ditemukan!*

                        *Kemungkinan Penyebab:*
                        • ID salah atau sudah terhapus
                        • Pengingat sudah selesai
                        
                        *Cara Melihat ID:*
                        Gunakan *.listtodoist* untuk melihat daftar pengingat aktif.`);
                        
                }
                break;
            }
        }
    } catch (error) {
        console.error('[TODOIST] Error in handler:', error);
        m.reply(`❌ Terjadi kesalahan saat memproses perintah

*Panduan penggunaan yang benar:*
${showGuide()}`);
    }
};

handler.help = [
    'todoist on/off',
    'todoist <pesan> <DD/MM/YYYY|HH:mm>',
    'listtodoist',
    'deltodoist <task_id>'
];
handler.tags = ['tools', 'database', 'owner'];
handler.command = ['todoist', 'listtodoist', 'deltodoist'];

export default handler;