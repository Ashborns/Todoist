import { Prodia } from "prodia.js";
import fetch from "node-fetch";
import _ from "lodash";
import uploadFile from "../../lib/uploadFile.js";
import uploadImage from "../../lib/uploadImage.js";
import fs from "fs";
import path from 'path';

const dbPath = path.resolve('./database/img2img.json');

const defaultData = {
  model: 'absolutereality_v181.safetensors [3d9d4d2b]',
  style: 'analog-film',
  sampler: 'DPM++ 3M SDE'
};

const getValidApiKey = () => {
  const apiKeys = global.APIKeys["https://prodia.com"];
  if (!apiKeys || apiKeys.length === 0) {
    throw new Error("No API keys found for Prodia service.");
  }
  return _.sample(apiKeys);
};

let prodiaClient;
try {
  const apiKey = getValidApiKey();
  prodiaClient = Prodia(apiKey);
} catch (error) {
  console.error("Error initializing Prodia client:", error);
}

function readDatabase() {
  if (!fs.existsSync(dbPath)) return {};
  const rawData = fs.readFileSync(dbPath, 'utf-8');
  return JSON.parse(rawData || '{}');
}

function saveToDatabase(userId, model, style, sampler) {
  const database = readDatabase();
  database[userId] = { model, style, sampler };
  fs.writeFileSync(dbPath, JSON.stringify(database, null, 2), 'utf-8');
}

function getUserData(userId) {
  const database = readDatabase();
  return database[userId] || defaultData;
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    conn.inputData = conn.inputData || await getModels();
    const { model = [], style = [], sampler = [] } = conn.inputData;

    conn.img2imgSelection = conn.img2imgSelection || {};

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

    if (!text || !text.trim()) {
      return conn.reply(
        m.chat,
        `ℹ️ *Panduan Penggunaan img2img*:\n\n` +
        `1. *Mengatur Model:* Ketik \`${usedPrefix + command} --model\` lalu balas dengan nomor urut model.\n` +
        `2. *Mengatur Style:* Ketik \`${usedPrefix + command} --style\` lalu balas dengan nomor urut style.\n` +
        `3. *Mengatur Sampler:* Ketik \`${usedPrefix + command} --sampler\` lalu balas dengan nomor urut sampler.\n` +
        `4. *Membuat Gambar:* Ketik \`${usedPrefix + command} [prompt] --model <nomor> --style <nomor> --sampler <nomor>\` untuk menghasilkan gambar.\n\n` +
        `Anda juga dapat melihat pengaturan Anda dengan mengetik \`${usedPrefix + command} --info\` untuk menampilkan data model, style, dan sampler yang Anda gunakan saat ini.`,
        m
      );
    }

    if (text.includes("--model")) {
      const list = model.map((item, index) => `*${index + 1}.* ${item}`).join("\n");
      const { key } = await conn.reply(m.chat, `📝 Pilih Model:\n\n${list}\n\nBalas pesan ini dengan nomor model yang ingin dipilih.`, m);
      conn.img2imgSelection[m.chat] = {
        list: model,
        type: "model",
        key,
        timeout: setTimeout(() => {
          conn.sendMessage(m.chat, { delete: key });
          delete conn.img2imgSelection[m.chat];
        }, 6e4)
      };
      return;
    }

    if (text.includes("--style")) {
      const list = style.map((item, index) => `*${index + 1}.* ${item}`).join("\n");
      const { key } = await conn.reply(m.chat, `📝 Pilih Style:\n\n${list}\n\nBalas pesan ini dengan nomor style yang ingin dipilih.`, m);
      conn.img2imgSelection[m.chat] = {
        list: style,
        type: "style",
        key,
        timeout: setTimeout(() => {
          conn.sendMessage(m.chat, { delete: key });
          delete conn.img2imgSelection[m.chat];
        }, 6e4)
      };
      return;
    }

    if (text.includes("--sampler")) {
      const list = sampler.map((item, index) => `*${index + 1}.* ${item}`).join("\n");
      const { key } = await conn.reply(m.chat, `📝 Pilih Sampler:\n\n${list}\n\nBalas pesan ini dengan nomor sampler yang ingin dipilih.`, m);
      conn.img2imgSelection[m.chat] = {
        list: sampler,
        type: "sampler",
        key,
        timeout: setTimeout(() => {
          conn.sendMessage(m.chat, { delete: key });
          delete conn.img2imgSelection[m.chat];
        }, 6e4)
      };
      return;
    }

    if (text.trim()) {
      await generateImageAndSend(m, conn, text, selectedModel, selectedStyle, selectedSampler);
    }
  } catch (error) {
    console.error("Error handling command:", error);
    m.reply("❌ Terjadi kesalahan.");
  }
};

handler.before = async (m, { conn }) => {
  try {
    if (!conn.img2imgSelection || !(m.chat in conn.img2imgSelection)) return;
    const { list, type, key, timeout } = conn.img2imgSelection[m.chat];

    if (!m.quoted || m.quoted.id !== key.id || !m.text) return;

    const index = parseInt(m.text.trim());
    if (isNaN(index) || index < 1 || index > list.length) {
      await conn.reply(m.chat, "⚠️ Masukkan nomor yang valid.", m);
      return;
    }

    const selected = list[index - 1];
    let { model, style, sampler } = getUserData(m.sender);

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
    delete conn.img2imgSelection[m.chat];
  } catch (error) {
    console.error("Error handling selection:", error);
    m.reply("❌ Terjadi kesalahan saat memproses pilihan.");
  }
};

async function generateImageAndSend(m, conn, prompt, model, style, sampler) {
  try {
    const q = m.quoted || m;
    const mime = (q.msg || q).mimetype || "";
    if (!mime) return m.reply("Tidak ada media yang ditemukan");
    
    const media = await q.download();
    const link = await (/image\/(png|jpe?g|gif)|video\/mp4/.test(mime) ? uploadImage : uploadFile)(media);
    
    if (!link) return m.reply("Tidak ada media yang diupload");

    const generateImageParams = {
      model: model || defaultData.model,
      prompt: encodeURIComponent(prompt),
      style_preset: style || defaultData.style,
      sampler: sampler || defaultData.sampler,
      width: 720,
      height: 1024,
      imageUrl: link,
      imageData: media.toString("base64")
    };

    const result = await generateImage(generateImageParams);

    if (result) {
      await conn.sendMessage(m.chat, {
        image: { url: result.imageUrl },
        caption: `✨ *Gambar Dihasilkan*\n- Model: ${generateImageParams.model}\n- Style: ${generateImageParams.style_preset}\n- Sampler: ${generateImageParams.sampler}\n- Prompt: ${prompt}`
      }, { quoted: m });
    } else {
      throw new Error("Failed to generate image.");
    }
  } catch (error) {
    console.error("Error in generateImageAndSend:", error);
    if (error.message.includes("API key is not enabled")) {
      m.reply("❌ The Prodia API key is not enabled or is invalid. Please contact the bot administrator.");
    } else {
      m.reply(`❌ Terjadi kesalahan saat menghasilkan gambar: ${error.message}`);
    }
  }
}

async function generateImage(params) {
  try {
    if (!prodiaClient) {
      throw new Error("Prodia client is not initialized.");
    }
    const generate = await prodiaClient.transform(params);
    return await prodiaClient.wait(generate);
  } catch (error) {
    console.error("Error generating image:", error);
    if (error.message.includes("API key is not enabled")) {
      throw new Error("The Prodia API key is not enabled or is invalid. Please contact the bot administrator.");
    }
    throw error;
  }
}

async function getModels() {
  try {
    const response = await fetch("https://docs.prodia.com/reference/transform");
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

handler.help = ["img2img *[query]* --option"];
handler.tags = ["ai"];
handler.command = /^(img2img)$/i;

export default handler;