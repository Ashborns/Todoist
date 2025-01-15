import axios from 'axios';
import { unlinkSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const headers = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Origin': 'https://www.voicy.network',
  'Referer': 'https://www.voicy.network/tts',
  'User-Agent': 'Postify/1.0.0'
};

const handler = async (m, { conn, args, usedPrefix, command }) => {
  const query = args[0];
  const text = args.slice(1).join(' ');
  
  if (!query || !text) {
    m.reply(`Masukkan input yang benar. Contoh penggunaan: ${usedPrefix}${command} <query> <teks>`);
    return;
  }
  
  try {
    m.react(wait);
    
    // Search for voices
    const searchResult = await searchVoice(query);
    if (!searchResult.voices || searchResult.voices.length === 0) {
      m.reply('Tidak ditemukan suara yang cocok untuk query tersebut.');
      return;
    }
    
    const voiceToken = searchResult.voices[0].token; // Use the first voice result

    // Text-to-Speech request
    const ttsResult = await tts(voiceToken, text);
    if (!ttsResult.jobToken) {
      m.reply('Gagal membuat TTS. Coba lagi nanti.');
      return;
    }
    
    // Poll for job status
    const audioUrl = await getJobStatus(ttsResult.jobToken);
    if (!audioUrl) {
      m.reply('Gagal mendapatkan status pekerjaan TTS.');
      return;
    }
    
    // Download the audio file
    const audioPath = await downloadAudio(audioUrl);
    
    // Send the audio file
    await conn.sendFile(m.chat, audioPath, 'voice.mp3', '', m, true, {
      mimetype: 'audio/mp4',
      ptt: true,
      contextInfo: {
        externalAdReply: {
          title: 'Voicy TTS',
          body: '',
          mediaType: 1,
          previewType: 0,
          renderLargerThumbnail: true,
          thumbnailUrl: 'https://www.voicy.network/images/voicy_logo.png',
          sourceUrl: ''
        }
      }
    });
    
    m.react(sukses);
    unlinkSync(audioPath); // Delete the temporary file
  } catch (e) {
    m.react(eror);
    console.error('An error occurred:', e);
  }
};

// Voicy network functions
async function searchVoice(query) {
  const { data } = await axios.post('https://www.voicy.network/search-voices', { query }, { headers });
  return { voices: data.data.map(({ title, creator, language, token, type }) => ({ title, creator, language, token, type })) };
}

async function tts(token, text) {
  const { data } = await axios.post('https://www.voicy.network/inference-tts', { token, text, type: 0 }, { headers });
  return { jobToken: data.data.jobToken };
}

async function getJobStatus(token) {
  const maxRetries = 20;
  const retryDelay = 5000;
  
  for (let retries = 0; retries < maxRetries; retries++) {
    const { data } = await axios.post('https://www.voicy.network/job_status_tts', { token }, { headers });
    const status = data.data.status;
    
    if (status === 'complete_success') {
      return `https://storage.googleapis.com/vocodes-public${data.data.maybe_public_bucket_wav_audio_path}`;
    }
    
    if (status === 'started' || status === 'pending') {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  throw new Error('Terlalu banyak request API, coba lagi nanti...');
}

async function downloadAudio(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const filePath = join(dirname(fileURLToPath(import.meta.url)), '../../tmp', `${Date.now()}.mp3`);
  writeFileSync(filePath, response.data);
  return filePath;
}

// Command configuration
handler.help = ['voicy <query> <teks>'];
handler.tags = ['tools'];
handler.command = /^(voicy)$/i;

export default handler;