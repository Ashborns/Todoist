import fs from 'fs';
import archiver from 'archiver';

const handler = async (m, { conn }) => {
  conn.sendMessage(m.chat, {
    react: {
      text: '🕒',
      key: m.key,
    }
  });

  const foldersToExclude = [
    'node_modules',
    '.npm',
    '.cache',
    'jadibot'
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `Ash-bot-backup_${timestamp}.zip`;

  const output = fs.createWriteStream(backupFileName);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('warning', err => {
    if (err.code === 'ENOENT') {
      console.warn('Warning during archiving:', err);
    } else {
      throw err;
    }
  });

  archive.on('error', err => {
    console.error('Error during archiving:', err);
    throw err;
  });

  console.log(`Memulai pembuatan arsip: ${backupFileName}`);
  archive.pipe(output);

  const processDir = (dir, parentDir = '') => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = parentDir ? `${parentDir}/${file}` : file;
      const fullFilePath = `${dir}/${file}`;
      if (fs.lstatSync(fullFilePath).isDirectory()) {
        if (!foldersToExclude.some(folder => filePath.startsWith(folder))) {
          processDir(fullFilePath, filePath);
        }
      } else {
        archive.file(fullFilePath, { name: filePath });
      }
    }
  };

  processDir('.');
  archive.finalize();

  archive.on('end', () => {
    console.log(`Arsip ${backupFileName} berhasil dibuat!`);

    setTimeout(() => {
      if (fs.existsSync(backupFileName)) {
        console.log(`File ${backupFileName} ditemukan, mempersiapkan pengiriman...`);
        const stats = fs.statSync(backupFileName);
        const fileSize = `${(stats.size / (1024 * 1024)).toFixed(2)} MB`;

        const description = `Berhasil melakukan backup file bot\n\n` +
          `• *Ukuran File :* ${fileSize}\n` +
          `• *Tanggal Backup :* ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}`;

        // Kirim file dan hanya hapus setelah berhasil dikirim
        conn.sendFile(m.chat, backupFileName, backupFileName, description)
          .then(() => {
            console.log(`File ${backupFileName} berhasil dikirim, menghapus file...`);
            fs.unlinkSync(backupFileName); // Hapus file setelah dikirim
          })
          .catch(err => {
            console.error(`Error saat mengirim file: ${err}`);
          });
      } else {
        console.error(`File ${backupFileName} tidak ditemukan!`);
        conn.reply(m.chat, 'Backup gagal: File tidak ditemukan.', m);
      }
    }, 1000);  // Tambah jeda untuk memastikan file sudah dibuat
  });

  output.on('close', () => {
    console.log(`Stream untuk file ${backupFileName} sudah ditutup.`);
  });
};

handler.help = ['backupme'];
handler.tags = ['owner'];
handler.rowner = true;
handler.command = /^backupme$/i;

export default handler;
