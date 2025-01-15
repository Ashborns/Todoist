import fetch from 'node-fetch';

// Variabel global untuk menyimpan instance conn
let connGlobal;

// Fungsi untuk mengecek update gempa dari API BMKG
async function checkForEarthquakeUpdate() {
  try {
    if (!connGlobal) {
      console.log('connGlobal is not initialized.');
      return;
    }

    let activeGroupsCount = 0;   // Hitung grup yang mengaktifkan pembaruan
    let inactiveGroupsCount = 0; // Hitung grup yang tidak mengaktifkan pembaruan

    // Hitung jumlah grup aktif dan tidak aktif
    for (let chatId in db.data.chats) {
      let chat = db.data.chats[chatId];
      if (chat.autoGempa) {
        activeGroupsCount++;
      } else {
        inactiveGroupsCount++;
      }
    }

    console.log(`Total active groups with earthquake updates: ${activeGroupsCount}`);
    console.log(`Total inactive groups (no earthquake updates): ${inactiveGroupsCount}`);

    if (activeGroupsCount > 0) {
      console.log('Starting earthquake check...');

      let sgc = 'https://www.bmkg.go.id/';
      let d = new Date();
      let locale = 'id';
      let date = d.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      let link = 'https://data.bmkg.go.id/DataMKG/TEWS/';

      try {
        const fetchWithTimeout = (url, options, timeout = 10000) => {
          return Promise.race([
            fetch(url, options),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Request timed out')), timeout)
            ),
          ]);
        };

        let res = await fetchWithTimeout(link + 'autogempa.json');
        if (!res.ok) {
          throw new Error(`Failed to fetch data: ${res.statusText}`);
        }

        let res2 = await res.json();
        let anu = res2.Infogempa.gempa;

        let newEarthquakeDetected = false;

        for (let chatId in db.data.chats) {
          let chat = db.data.chats[chatId];

          if (chat.autoGempa) {
            if (chat.lastGempaId !== anu.Tanggal + anu.Jam) {
              newEarthquakeDetected = true;

              try {
                const fileResult = await connGlobal.getFile(link + anu.Shakemap);
                const thumbnail = fileResult ? fileResult.data : null;

                let txt = `*${anu.Wilayah}*\n\n`;
                txt += `Tanggal : ${anu.Tanggal}\n`;
                txt += `Waktu : ${anu.Jam}\n`;
                txt += `Potensi : *${anu.Potensi}*\n\n`;
                txt += `Magnitude : ${anu.Magnitude}\n`;
                txt += `Kedalaman : ${anu.Kedalaman}\n`;
                txt += `Koordinat : ${anu.Coordinates}${anu.Dirasakan.length > 3 ? `\nDirasakan : ${anu.Dirasakan}` : ''}`;

                await connGlobal.sendMessage(chatId, {
                  text: txt,
                  contextInfo: {
                    "externalAdReply": {
                      "title": 'UPDATE GEMPA',
                      "body": date,
                      "showAdAttribution": true,
                      "mediaType": 1,
                      "sourceUrl": sgc,
                      "thumbnail": thumbnail,
                      "renderLargerThumbnail": true,
                    },
                  },
                });

                chat.lastGempaId = anu.Tanggal + anu.Jam;
                chat.lastgempa = new Date().getTime();
              } catch (err) {
                console.error(`Failed to send message to ${chatId}:`, err);
              }
            }
          }
        }

        if (!newEarthquakeDetected) {
          console.log('No new earthquake detected for active groups.');
        }
      } catch (error) {
        console.error('Error fetching earthquake data:', error);
      }
    } else {
      console.log('No active groups for earthquake updates, checking again later...');
    }
  } catch (error) {
    console.error('Error in checkForEarthquakeUpdate:', error);
  } finally {
    setTimeout(checkForEarthquakeUpdate, 600000); // 10 menit
  }
}

// Mulai pengecekan hanya jika connGlobal tersedia
function startEarthquakeCheck() {
  try {
    if (connGlobal) {
      checkForEarthquakeUpdate(); // Mulai pengecekan pertama
    } else {
      setTimeout(startEarthquakeCheck, 10000); // Cek ulang setelah 10 detik
    }
  } catch (error) {
    console.error('Error in startEarthquakeCheck:', error);
  }
}

// Handler utama
export async function before(m, { conn, isAdmin, isBotAdmin }) {
  try {
    if (!connGlobal) {
      connGlobal = conn;
      startEarthquakeCheck();
    }
    // Logika lain di handler kamu...
  } catch (error) {
    console.error('Error in before handler:', error);
  }
};
