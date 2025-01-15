import { Prodia } from "prodia.js";
import fetch from "node-fetch";
import _ from "lodash";
import fs from "fs";
import path from "path";
import uploadFile from "../../lib/uploadFile.js";
import uploadImage from "../../lib/uploadImage.js";

const dbPath = path.resolve('./database/controlnet.json');

const defaultData = {
  model: 'absolutereality_v181.safetensors [3d9d4d2b]',
  cmodel: 'control_v11p_sd15_openpose [cab727d4]',
  cmodule: 'openpose_full',
  style: 'analog-film',
  sampler: 'DPM++ 3M SDE',
  negative_prompt: 'blur, low quality, distortion'
};

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

const getValidApiKey = () => {
  const apiKeys = global.APIKeys["https://prodia.com"];
  if (!apiKeys || !Array.isArray(apiKeys) || apiKeys.length === 0) {
    throw new Error("No valid API keys found for Prodia service.");
  }
  return pickRandom(apiKeys);
};

let prodiaClient;
try {
  const apiKey = getValidApiKey();
  prodiaClient = Prodia(apiKey); // Corrected: Prodia is a function, not a constructor
} catch (error) {
  console.error("Error initializing Prodia client:", error);
}

function readDatabase() {
  if (!fs.existsSync(dbPath)) return {};
  const rawData = fs.readFileSync(dbPath, 'utf-8');
  return JSON.parse(rawData || '{}');
}

function saveToDatabase(userId, data) {
  const database = readDatabase();
  database[userId] = data;
  fs.writeFileSync(dbPath, JSON.stringify(database, null, 2), 'utf-8');
}

function getUserData(userId) {
  const database = readDatabase();
  return database[userId] || defaultData;
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    conn.inputData = conn.inputData || await getModels();
    const { model = [], cmodel = [], cmodule = [], style = [], sampler = [] } = conn.inputData;

    conn.controlnetSelection = conn.controlnetSelection || {};

    let userData = getUserData(m.sender);

    if (text.includes("--info")) {
      return conn.reply(
        m.chat,
        `📝 *Your ControlNet Settings*\n\n` +
        `- Model: ${userData.model}\n` +
        `- Control Model: ${userData.cmodel}\n` +
        `- Control Module: ${userData.cmodule}\n` +
        `- Style: ${userData.style}\n` +
        `- Sampler: ${userData.sampler}\n` +
        `- Negative Prompt: ${userData.negative_prompt}`,
        m
      );
    }

    if (!text || !text.trim()) {
      return conn.reply(
        m.chat,
        `ℹ️ *ControlNet Usage Guide*:\n\n` +
        `1. *Set Model:* Type \`${usedPrefix + command} --model\` then reply with the model number.\n` +
        `2. *Set Control Model:* Type \`${usedPrefix + command} --cmodel\` then reply with the control model number.\n` +
        `3. *Set Control Module:* Type \`${usedPrefix + command} --cmodule\` then reply with the control module number.\n` +
        `4. *Set Style:* Type \`${usedPrefix + command} --style\` then reply with the style number.\n` +
        `5. *Set Sampler:* Type \`${usedPrefix + command} --sampler\` then reply with the sampler number.\n` +
        `6. *Set Negative Prompt:* Type \`${usedPrefix + command} --negative_prompt Your negative prompt here\`.\n` +
        `7. *Generate Image:* Type \`${usedPrefix + command} [prompt] --model <number> --cmodel <number> --cmodule <number> --style <number> --sampler <number>\` to generate an image.\n\n` +
        `You can also view your current settings by typing \`${usedPrefix + command} --info\`.`,
        m
      );
    }

    if (text.includes("--model")) {
      const list = model.map((item, index) => `*${index + 1}.* ${item}`).join("\n");
      const { key } = await conn.reply(m.chat, `📝 Choose Model:\n\n${list}\n\nReply to this message with the number of the model you want to select.`, m);
      conn.controlnetSelection[m.chat] = {
        list: model,
        type: "model",
        key,
        timeout: setTimeout(() => {
          conn.sendMessage(m.chat, { delete: key });
          delete conn.controlnetSelection[m.chat];
        }, 6e4)
      };
      return;
    }

    if (text.includes("--cmodel")) {
      const list = cmodel.map((item, index) => `*${index + 1}.* ${item}`).join("\n");
      const { key } = await conn.reply(m.chat, `📝 Choose Control Model:\n\n${list}\n\nReply to this message with the number of the control model you want to select.`, m);
      conn.controlnetSelection[m.chat] = {
        list: cmodel,
        type: "cmodel",
        key,
        timeout: setTimeout(() => {
          conn.sendMessage(m.chat, { delete: key });
          delete conn.controlnetSelection[m.chat];
        }, 6e4)
      };
      return;
    }

    if (text.includes("--cmodule")) {
      const list = cmodule.map((item, index) => `*${index + 1}.* ${item}`).join("\n");
      const { key } = await conn.reply(m.chat, `📝 Choose Control Module:\n\n${list}\n\nReply to this message with the number of the control module you want to select.`, m);
      conn.controlnetSelection[m.chat] = {
        list: cmodule,
        type: "cmodule",
        key,
        timeout: setTimeout(() => {
          conn.sendMessage(m.chat, { delete: key });
          delete conn.controlnetSelection[m.chat];
        }, 6e4)
      };
      return;
    }

    if (text.includes("--style")) {
      const list = style.map((item, index) => `*${index + 1}.* ${item}`).join("\n");
      const { key } = await conn.reply(m.chat, `📝 Choose Style:\n\n${list}\n\nReply to this message with the number of the style you want to select.`, m);
      conn.controlnetSelection[m.chat] = {
        list: style,
        type: "style",
        key,
        timeout: setTimeout(() => {
          conn.sendMessage(m.chat, { delete: key });
          delete conn.controlnetSelection[m.chat];
        }, 6e4)
      };
      return;
    }

    if (text.includes("--sampler")) {
      const list = sampler.map((item, index) => `*${index + 1}.* ${item}`).join("\n");
      const { key } = await conn.reply(m.chat, `📝 Choose Sampler:\n\n${list}\n\nReply to this message with the number of the sampler you want to select.`, m);
      conn.controlnetSelection[m.chat] = {
        list: sampler,
        type: "sampler",
        key,
        timeout: setTimeout(() => {
          conn.sendMessage(m.chat, { delete: key });
          delete conn.controlnetSelection[m.chat];
        }, 6e4)
      };
      return;
    }

    if (text.includes("--negative_prompt")) {
      const negativePrompt = text.split("--negative_prompt")[1].trim();
      userData.negative_prompt = negativePrompt;
      saveToDatabase(m.sender, userData);
      return conn.reply(m.chat, `✅ Negative prompt set to: ${negativePrompt}`, m);
    }

    if (text.trim()) {
      await generateImageAndSend(m, conn, text, userData);
    }
  } catch (error) {
    console.error("Error handling command:", error);
    m.reply("❌ An error occurred.");
  }
};

handler.before = async (m, { conn }) => {
  try {
    if (!conn.controlnetSelection || !(m.chat in conn.controlnetSelection)) return;
    const { list, type, key, timeout } = conn.controlnetSelection[m.chat];

    if (!m.quoted || m.quoted.id !== key.id || !m.text) return;

    const index = parseInt(m.text.trim());
    if (isNaN(index) || index < 1 || index > list.length) {
      await conn.reply(m.chat, "⚠️ Please enter a valid number.", m);
      return;
    }

    const selected = list[index - 1];
    let userData = getUserData(m.sender);

    userData[type] = selected;
    await conn.reply(m.chat, `✅ *${type.charAt(0).toUpperCase() + type.slice(1)} set successfully*\n- ${type}: ${selected}`, m);

    saveToDatabase(m.sender, userData);
    conn.sendMessage(m.chat, { delete: key });
    clearTimeout(timeout);
    delete conn.controlnetSelection[m.chat];
  } catch (error) {
    console.error("Error handling selection:", error);
    m.reply("❌ An error occurred while processing your selection.");
  }
};

async function generateImageAndSend(m, conn, prompt, userData) {
  try {
    const q = m.quoted || m;
    const mime = (q.msg || q).mimetype || "";
    if (!mime) return m.reply("No media found");
    
    const media = await q.download();
    const link = await (/image\/(png|jpe?g|gif)|video\/mp4/.test(mime) ? uploadImage : uploadFile)(media);
    
    if (!link) return m.reply("No media uploaded");

    const generateImageParams = {
      model: userData.model,
      controlnet_model: userData.cmodel,
      controlnet_module: userData.cmodule,
      prompt: encodeURIComponent(prompt),
      style_preset: userData.style,
      sampler: userData.sampler,
      negative_prompt: userData.negative_prompt,
      width: 720,
      height: 1024,
      imageUrl: link,
      imageData: media.toString("base64")
    };

    const result = await generateImage(generateImageParams);

    if (result) {
      await conn.sendMessage(m.chat, {
        image: { url: result.imageUrl },
        caption: `✨ *Image Generated*\n- Model: ${generateImageParams.model}\n- Control Model: ${generateImageParams.controlnet_model}\n- Control Module: ${generateImageParams.controlnet_module}\n- Style: ${generateImageParams.style_preset}\n- Sampler: ${generateImageParams.sampler}\n- Negative Prompt: ${generateImageParams.negative_prompt}\n- Prompt: ${prompt}`
      }, { quoted: m });
    } else {
      throw new Error("Failed to generate image.");
    }
  } catch (error) {
    console.error("Error in generateImageAndSend:", error);
    if (error.message.includes("API key is not enabled")) {
      m.reply("❌ The Prodia API key is not enabled or is invalid. Please contact the bot administrator.");
    } else {
      m.reply(`❌ An error occurred while generating the image: ${error.message}`);
    }
  }
}

async function generateImage(params) {
  try {
    if (!prodiaClient) {
      throw new Error("Prodia client is not initialized.");
    }
    const generate = await prodiaClient.controlNet(params);
    return await prodiaClient.wait(generate);
  } catch (error) {
    console.error("Error generating image:", error);
    if (error.message.includes("API key is not enabled") || error.message.includes("Invalid API key")) {
      throw new Error("The Prodia API key is not enabled or is invalid. Please contact the bot administrator.");
    } else if (error.message.includes("No valid API keys found")) {
      throw new Error("No valid API keys found for Prodia service. Please check your configuration.");
    }
    throw error;
  }
}

async function getModels() {
  try {
    const response = await fetch("https://docs.prodia.com/reference/controlnet");
    const html = await response.text();
    const jsonRegex = /{&quot;[^{}]*}/g;
    const allJSON = _.map(_.filter(html.match(jsonRegex), match => match.includes("&quot;")), match => JSON.parse(match.replace(/&quot;/g, '"'))) || [];
    const data = _.filter(allJSON, obj => _.has(obj, "enum"));
    
    return {
      model: [...new Set([...data[0]?.["enum"], ...await prodiaClient.getModels() || []])],
      cmodel: data?.[6]?.["enum"],
      cmodule: data?.[7]?.["enum"],
      style: data?.[10]?.["enum"],
      sampler: [...new Set([...data[8]?.["enum"], ...await prodiaClient.getSamplers() || []])]
    };
  } catch (error) {
    console.error("Error fetching models:", error);
    return null;
  }
}

handler.help = ["controlnet *[query]* --option"];
handler.tags = ["ai"];
handler.command = /^(controlnet)$/i;

export default handler;