import * as cheerio from "cheerio";
import { Prodia } from "prodia.js";
import fetch from "node-fetch";
import _ from "lodash";
import fs from 'fs';
import path from 'path';

// API Key dan client Prodia
const apiKey = _.sample(global.APIKeys["https://prodia.com"]);
const prodiaClient = Prodia(apiKey);

// Path untuk database
const dbPath = path.resolve('./database/txt2img.json');

// Default values jika user belum menyimpan pengaturan
const defaultData = {
  model: 'absolutereality_v181.safetensors [3d9d4d2b]',
  style: 'analog-film',
  sampler: 'DPM++ 3M SDE'
};

// Fungsi membaca database dari file JSON
function readDatabase() {
  if (!fs.existsSync(dbPath)) return {};
  const rawData = fs.readFileSync(dbPath, 'utf-8');
  return JSON.parse(rawData || '{}');
}

// Fungsi menyimpan pengaturan pengguna ke file JSON
function saveToDatabase(userId, model, style, sampler) {
  const database = readDatabase();
  database[userId] = { model, style, sampler };
  fs.writeFileSync(dbPath, JSON.stringify(database, null, 2), 'utf-8');
}

// Fungsi mengambil data pengguna, atau default jika tidak ada
function getUserData(userId) {
  const database = readDatabase();
  return database[userId] || defaultData;
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    // Memuat model, style, dan sampler jika belum ada di connection
    conn.inputData = conn.inputData || await getModels();
    const { model = [], style = [], sampler = [] } = conn.inputData;

    conn.txt2imgSelection = conn.txt2imgSelection || {};

    // Ambil data pengguna dari database
    let { model: selectedModel, style: selectedStyle, sampler: selectedSampler } = getUserData(m.sender);

    if (text.includes("--info")) {
      return conn.reply(
        m.chat,
        `📝 *Pengaturan Gambar Anda*\n\n` +
        `- Model: ${selectedModel}\n` +
        `- Style: ${selectedStyle}\n` +
        `- Sampler: ${selectedSampler}`,
        m
      );
    }

    // Jika tidak ada text, tampilkan cara menggunakan command
    if (!text || !text.trim()) {
      return conn.reply(
        m.chat,
        `ℹ️ *Panduan Penggunaan txt2img*:\n\n` +
        `1. *Mengatur Model:* Ketik \`${usedPrefix + command} --model\` lalu balas dengan nomor urut model.\n` +
        `2. *Mengatur Style:* Ketik \`${usedPrefix + command} --style\` lalu balas dengan nomor urut style.\n` +
        `3. *Mengatur Sampler:* Ketik \`${usedPrefix + command} --sampler\` lalu balas dengan nomor urut sampler.\n` +
        `4. *Membuat Gambar:* Ketik \`${usedPrefix + command} [prompt] --model <nomor> --style <nomor> --sampler <nomor>\` untuk menghasilkan gambar.\n\n` +
        `Anda juga dapat melihat pengaturan Anda dengan mengetik \`${usedPrefix + command} --info\` untuk menampilkan data model, style, dan sampler yang Anda gunakan saat ini.`,
        m
      );
    }

    // Menampilkan daftar model
    if (text.includes("--model")) {
      const list = model.map((item, index) => `*${index + 1}.* ${item}`).join("\n");
      const { key } = await conn.reply(m.chat, `📝 Pilih Model:\n\n${list}\n\nBalas pesan ini dengan nomor model yang ingin dipilih.`, m);
      conn.txt2imgSelection[m.chat] = {
        list: model,
        type: "model",
        key,
        timeout: setTimeout(() => {
          conn.sendMessage(m.chat, { delete: key });
          delete conn.txt2imgSelection[m.chat];
        }, 6e4) // Hapus pesan setelah 1 menit
      };
      return;
    }

    // Menampilkan daftar model
    if (text.includes("--model")) {
      const list = model.map((item, index) => `*${index + 1}.* ${item}`).join("\n");
      const { key } = await conn.reply(m.chat, `📝 Pilih Model:\n\n${list}\n\nBalas pesan ini dengan nomor model yang ingin dipilih.`, m);
      conn.txt2imgSelection[m.chat] = {
        list: model,
        type: "model",
        key,
        timeout: setTimeout(() => {
          conn.sendMessage(m.chat, { delete: key });
          delete conn.txt2imgSelection[m.chat];
        }, 6e4) // Hapus pesan setelah 1 menit
      };
      return;
    }

    // Menampilkan daftar style
    if (text.includes("--style")) {
      const list = style.map((item, index) => `*${index + 1}.* ${item}`).join("\n");
      const { key } = await conn.reply(m.chat, `📝 Pilih Style:\n\n${list}\n\nBalas pesan ini dengan nomor style yang ingin dipilih.`, m);
      conn.txt2imgSelection[m.chat] = {
        list: style,
        type: "style",
        key,
        timeout: setTimeout(() => {
          conn.sendMessage(m.chat, { delete: key });
          delete conn.txt2imgSelection[m.chat];
        }, 6e4)
      };
      return;
    }

    // Menampilkan daftar sampler
    if (text.includes("--sampler")) {
      const list = sampler.map((item, index) => `*${index + 1}.* ${item}`).join("\n");
      const { key } = await conn.reply(m.chat, `📝 Pilih Sampler:\n\n${list}\n\nBalas pesan ini dengan nomor sampler yang ingin dipilih.`, m);
      conn.txt2imgSelection[m.chat] = {
        list: sampler,
        type: "sampler",
        key,
        timeout: setTimeout(() => {
          conn.sendMessage(m.chat, { delete: key });
          delete conn.txt2imgSelection[m.chat];
        }, 6e4)
      };
      return;
    }

    // Jika prompt ada dan tidak ada model/style/sampler yang ingin diatur
    if (text.trim()) {
      await generateImageAndSend(m, conn, text, selectedModel, selectedStyle, selectedSampler);
    }
  } catch (error) {
    console.error("Error handling command:", error);
    m.reply("❌ Terjadi kesalahan.");
  }
};

// Fungsi sebelum handler untuk memproses pilihan pengguna dari daftar
handler.before = async (m, { conn }) => {
  try {
    if (!conn.txt2imgSelection || !(m.chat in conn.txt2imgSelection)) return;
    const { list, type, key, timeout } = conn.txt2imgSelection[m.chat];

    if (!m.quoted || m.quoted.id !== key.id || !m.text) return;

    const index = parseInt(m.text.trim());
    if (isNaN(index) || index < 1 || index > list.length) {
      await conn.reply(m.chat, "⚠️ Masukkan nomor yang valid.", m);
      return;
    }

    const selected = list[index - 1];
    let { model, style, sampler } = getUserData(m.sender);

    // Mengatur pilihan pengguna berdasarkan tipe
    if (type === "model") {
      model = selected;
      await conn.reply(m.chat, `✅ *Model berhasil diatur*\n- Model: ${selected}`, m);
    } else if (type === "style") {
      style = selected;
      await conn.reply(m.chat, `✅ *Style berhasil diatur*\n- Style: ${selected}`, m);
    } else if (type === "sampler") {
      sampler = selected;
      await conn.reply(m.chat, `✅ *Sampler berhasil diatur*\n- Sampler: ${selected}`, m);
    }

    saveToDatabase(m.sender, model, style, sampler);
    conn.sendMessage(m.chat, { delete: key });
    clearTimeout(timeout);
    delete conn.txt2imgSelection[m.chat];
  } catch (error) {
    console.error("Error handling selection:", error);
    m.reply("❌ Terjadi kesalahan saat memproses pilihan.");
  }
};

// Fungsi untuk menghasilkan gambar menggunakan Prodia API dan mengirim hasilnya
async function generateImageAndSend(m, conn, prompt, model, style, sampler) {
  try {
    const generateImageParams = {
      model: model || defaultData.model,
      prompt: encodeURIComponent(prompt),
      style_preset: style || defaultData.style,
      sampler: sampler || defaultData.sampler,
      width: 720,
      height: 1024
    };

    const result = await generateImage(generateImageParams);

    if (result) {
      await conn.sendMessage(m.chat, {
        image: { url: result.imageUrl },
        caption: `✨ *Gambar Dihasilkan*\n- Model: ${generateImageParams.model}\n- Style: ${generateImageParams.style_preset}\n- Sampler: ${generateImageParams.sampler}\n- Prompt: ${prompt}`
      }, { quoted: m });
    } else {
      m.reply("❌ Terjadi kesalahan saat menghasilkan gambar.");
    }
  } catch (error) {
    console.error("Error generating image:", error);
    m.reply("❌ Terjadi kesalahan saat menghasilkan gambar.");
  }
}

// Fungsi untuk memanggil API Prodia untuk menghasilkan gambar
async function generateImage(params) {
  try {
    const generate = await prodiaClient.generateImage(params);
    return await prodiaClient.wait(generate);
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
}

// Fungsi untuk mengambil daftar model, style, dan sampler dari Prodia
async function getModels() {
  try {
    const response = await fetch("https://docs.prodia.com/reference/generate");
    const html = await response.text();
    const jsonRegex = /{&quot;[^{}]*}/g;
    const allJSON = _.map(_.filter(html.match(jsonRegex), match => match.includes("&quot;")), match => JSON.parse(match.replace(/&quot;/g, '"'))) || [];
    const data = _.filter(allJSON, obj => _.has(obj, "enum"));

    return {
      model: [...new Set([...data[0]?.["enum"], ...await prodiaClient.getModels() || []])],
      style: data[10]?.["enum"],
      sampler: [...new Set([...data[8]?.["enum"], ...await prodiaClient.getSamplers() || []])]
    };
  } catch (error) {
    console.error("Error fetching models:", error);
    return null;
  }
}

handler.help = ["txt2img *[query]* --option"];
handler.tags = ["ai"];
handler.command = /^(txt2img)$/i;

export default handler;
