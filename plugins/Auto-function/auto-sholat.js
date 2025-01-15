import fetch from 'node-fetch';

// Global variable to store the connection instance
let connGlobal;

// Waktu sholat untuk Jakarta (beserta Sunset dan Tidur)
const prayerTimes = {
  Imsak: "04:00",
  Fajr: "04:13",
  Sunrise: "05:56",
  Dhuhr: "11:38",
  Asr: "14:43",
  Maghrib: "17:45",
  Isha: "18:55",
  Sunset: "18:00", // Contoh waktu Sunset, sesuaikan sesuai dengan lokasi dan tanggal
  Tidur: "22:00"   // Contoh waktu tidur
};

// Pesan khusus untuk setiap waktu sholat, termasuk Sunset dan Tidur
const prayerMessages = {
  Imsak: "Waktu *Imsak* telah tiba, persiapkan diri untuk berpuasa bagi yang sedang menunaikan Puasa.",
  Fajr: "Waktu *Subuh* telah tiba, segeralah menunaikan shalat Subuh bagi yang beragama Islam.",
  Sunrise: "Waktu *Terbit* matahari telah tiba, Selamat Beraktivitas",
  Dhuhr: "Waktu *Dzuhur* telah tiba, mari kita shalat Dzuhur bagi yang beragama Islam.",
  Asr: "Waktu *Ashar* telah tiba, jangan lupa shalat Ashar bagi yang beragama Islam.",
  Maghrib: "Waktu *Maghrib* telah tiba, mari kita berbuka puasa dan shalat bagi yang beragama Islam.",
  Isha: "Waktu *Isya* telah tiba, segeralah menunaikan shalat Isya bagi yang beragama Islam.",
  Sunset: "Waktu *Sunset* telah tiba, nikmati pemandangan matahari terbenam.",
  Tidur: "Sudah waktunya untuk *Tidur*, istirahatlah agar tubuh tetap sehat."
};

// Function to get the next prayer time
function getNextPrayerTime() {
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const currentTime = jakartaTime.getHours() * 60 + jakartaTime.getMinutes();

  let nextPrayer = null;
  let nextPrayerTime = Infinity;

  for (const [prayer, time] of Object.entries(prayerTimes)) {
    const [hours, minutes] = time.split(':').map(Number);
    const prayerMinutes = hours * 60 + minutes;

    if (prayerMinutes > currentTime && prayerMinutes < nextPrayerTime) {
      nextPrayer = prayer;
      nextPrayerTime = prayerMinutes;
    }
  }

  // If no next prayer found, it means we've passed all prayers for today
  // So, we set the next prayer to the first prayer of the next day
  if (!nextPrayer) {
    nextPrayer = Object.keys(prayerTimes)[0];
    nextPrayerTime = Object.values(prayerTimes)[0].split(':').map(Number).reduce((acc, time) => acc * 60 + time);
    nextPrayerTime += 24 * 60; // Add 24 hours
  }

  return { prayer: nextPrayer, time: nextPrayerTime };
}

// Fungsi untuk mengirim notifikasi waktu sholat atau waktu lainnya
async function sendPrayerNotifications(prayer, time) {
  if (!connGlobal) {
    console.log('connGlobal is not initialized.');
    return;
  }

  const activeGroups = Object.entries(db.data.chats).filter(([_, chat]) => chat.autoSholat);

  console.log(`Sending ${prayer} notifications to ${activeGroups.length} active groups`);

  for (const [chatId, chat] of activeGroups) {
    try {
      const who = chat.lastSender || chatId;
      const caption = `Hai kak @${who.split("@")[0]},\n${prayerMessages[prayer]}\n\n*${prayerTimes[prayer]}*\n_untuk Waktu indonesia Barat._`;

      await connGlobal.sendMessage(chatId, {
        text: caption,
        contextInfo: {
          mentionedJid: [who],
          externalAdReply: {
            title: "Pengingat Waktu",
            body: "",
            mediaType: 1,
            previewType: 0,
            renderLargerThumbnail: false,
            thumbnailUrl: "https://cdn-icons-png.flaticon.com/128/4527/4527060.png",
            sourceUrl: ""
          }
        }
      });

      console.log(`Sent ${prayer} notification to ${chatId}`);
    } catch (err) {
      console.error(`Failed to send message to ${chatId}:`, err);
    }
  }
}

// Function to schedule the next prayer notification
function scheduleNextPrayer() {
  const { prayer, time } = getNextPrayerTime();
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const currentMinutes = jakartaTime.getHours() * 60 + jakartaTime.getMinutes();
  const delay = (time - currentMinutes) * 60 * 1000; // Convert to milliseconds

  console.log(`Scheduled ${prayer} notification in ${delay / 60000} minutes`);

  setTimeout(() => {
    sendPrayerNotifications(prayer, time);
    scheduleNextPrayer(); // Schedule the next prayer after sending notifications
  }, delay);
}

// Start scheduling only if connGlobal is available
function startPrayerScheduler() {
  try {
    if (connGlobal) {
      scheduleNextPrayer();
    } else {
      setTimeout(startPrayerScheduler, 10000); // Check again after 10 seconds
    }
  } catch (error) {
    console.error('Error in startPrayerScheduler:', error);
  }
}

// Main handler
export async function before(m, { conn, isAdmin, isBotAdmin }) {
  try {
    if (!connGlobal) {
      connGlobal = conn;
      startPrayerScheduler();
    }
    // Store the last sender for each chat
    if (m.chat in db.data.chats) {
      db.data.chats[m.chat].lastSender = m.sender;
    }
    // Other logic in your handler...
  } catch (error) {
    console.error('Error in before handler:', error);
  }
}

export const disabled = false;