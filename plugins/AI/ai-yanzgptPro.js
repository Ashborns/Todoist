import axios from "axios";
import chalk from 'chalk';
import Form from "form-data";
import { fileTypeFromBuffer } from 'file-type';
import fs from "fs";
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import uploadFile from "../../lib/uploadFile.js";
import uploadImage from "../../lib/uploadImage.js";
import path from 'path';

// Initialize database
const yz = "./database/yanzgpt.json";
if (!fs.existsSync(yz)) fs.writeFileSync(yz, JSON.stringify({}));
let yanzgpt = JSON.parse(fs.readFileSync(yz, "utf8"));

// Available models
const models = {
  default: "yanzgpt-revolution-25b-v3.0",
  pro: "yanzgpt-legacy-72b-v3.0"
};

// YanzGPT API function
const YanzGPT = (query, model) => {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await axios("https://yanzgpt.my.id/chat", {
        data: { query, model },
        headers: {
          "authorization": "Bearer yzgpt-sc4tlKsMRdNMecNy",
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      resolve(response.data);
    } catch (error) {
      reject(error);
    }
  });
};

// Enhanced media download function with better error handling
async function downloadMedia(m) {
  try {
    const quoted = m.quoted || m;
    const mime = (quoted.msg || quoted).mimetype || (m.message?.mimetype || '');
    
    // Validate media object
    const mediaObj = quoted.msg || m.message;
    if (!mediaObj || !mediaObj.mediaKey || !mediaObj.directPath) {
      throw new Error('Invalid or unavailable media.');
    }

    // Only allow supported media types
    if (/image|video|audio/.test(mime)) {
      const stream = await downloadContentFromMessage(mediaObj, mime.split('/')[0]);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      return buffer;
    }
    throw new Error('Unsupported media type');
  } catch (error) {
    console.error('Error downloading media:', error);
    throw error;
  }
};

// Format response helper function
const formatResponse = (text) => {
  return text
    .replace(/####/g, '')
    .replace(/###/g, '')
    .replace(/##/g, '')
    .replace(/\*\*/g, '*');
};

// Send text and audio response function
async function sendTextAndAudioResponse(m, conn, text, response) {
  try {
    // Send text response first
    const textPromise = conn.sendMessage(m.chat, { text }, { quoted: m });
    
    // Clean and prepare text for TTS
    const cleanText = text
      .replace(/\[\d+\]/g, '')           
      .replace(/\[.*?\]/g, '')           
      .replace(/Citations:[\s\S]*/, '')   
      .replace(/```[\s\S]*?```/g, '')    
      .replace(/http[s]?:\/\/\S+/g, '')  
      .replace(/[^\w\s.,!?-]/g, '')      
      .trim();
    
    // Construct the API URL
    const apiUrl = `https://api.yanzbotz.live/api/tts/tts-multi?query=${
      encodeURIComponent(cleanText)
    }&apiKey=yanzdev`;

    // Wait for text to be sent first
    await textPromise;

    // Send audio directly using the API URL
    await conn.sendMessage(m.chat, {
      audio: {
        url: apiUrl
      },
      ptt: true,
      mimetype: 'audio/mp4'
    }, { quoted: m });

  } catch (error) {
    console.error('Error in sendTextAndAudioResponse:', error);
    // Notify user of audio failure but don't break the flow
    await conn.sendMessage(m.chat, {
      text: "Note: Audio response could not be generated at this time."
    }, { quoted: m }).catch(() => {});
  }
}

// Enhanced image response handling
async function sendImageResponse(m, conn, buffer) {
  try {
    await conn.sendMessage(m.chat, {
      image: buffer,
      caption: "Image From Yanz-GPT",
      mimetype: "image/jpeg",
    }, { quoted: m });
  } catch (error) {
    console.error('Error sending image response:', error);
    await conn.sendMessage(m.chat, { 
      text: 'Failed to send generated image.' 
    }, { quoted: m });
  }
}

// Main handler for model settings
let handler = async (m, { conn, text, args, command }) => {
  const usage = `*YanzGPT Command Usage:*
    
  .yanzgpt set <model> - Set YanzGPT model
  .yanzgpt model - View current model
  
  Available models:
  - default (${models.default})
  - pro (${models.pro})`;
  
  if (!text) return m.reply(usage);
  
  const [action] = text.toLowerCase().split(' ');
  
  if (action === 'set') {
    const value = text.split(' ')[1];
    if (!value || !models[value]) {
      return m.reply(`Invalid model. Available models:\n${Object.keys(models).map(k => `- ${k} (${models[k]})`).join('\n')}`);
    }
    global.db.data.users[m.sender].yanzModel = models[value];
    return m.reply(`Successfully set YanzGPT model to: ${models[value]}`);
  } 
  else if (action === 'model') {
    const currentModel = global.db.data.users[m.sender].yanzModel || models.default;
    const modelKey = Object.entries(models).find(([key, val]) => val === currentModel)?.[0] || 'default';
    return m.reply(`*Current YanzGPT Model*\n\nType: ${modelKey}\nModel: ${currentModel}`);
  }
  else {
    return m.reply(usage);
  }
};

// Enhanced audio handling
async function handleAudio(m, conn) {
  await conn.sendMessage(m.chat, { react: { text: "🔍", key: m.key } });
  
  try {
    // Download audio file
    const mediaBuffer = await downloadMedia(m);
    const audioUrl = await uploadFile(mediaBuffer);
    
    // Get transcription from Whisper API
    const whisperResponse = await fetch(
      `https://api.yanzbotz.live/api/tools/whisper?url=${audioUrl}&apiKey=yanzdev`
    ).then(r => r.json());

    if (!whisperResponse || !whisperResponse.result) {
      throw new Error('Failed to transcribe audio');
    }

    // Get response from YanzGPT
    const model = global.db.data.users[m.sender].yanzModel || models.default;
    const gptResponse = await YanzGPT(whisperResponse.result.trim(), model);
    const formattedResponse = formatResponse(gptResponse.message);

    // Send text and audio response
    await sendTextAndAudioResponse(m, conn, formattedResponse, gptResponse);

    // Handle image if present
    if (gptResponse.image) {
      const buffer = Buffer.from(gptResponse.image, "base64");
      await sendImageResponse(m, conn, buffer);
    }

    await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
  } catch (error) {
    console.error('Error handling audio:', error);
    await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
    
    // Send more specific error message
    let errorMessage = 'Failed to process audio message.';
    if (error.message === 'Failed to transcribe audio') {
      errorMessage = 'Sorry, I could not understand the audio. Please try again with clearer audio.';
    }
    m.reply(errorMessage);
  }
}

// Enhanced media handling
async function handleMedia(m, conn) {
  await conn.sendMessage(m.chat, { react: { text: "🔎", key: m.key } });
  
  try {
    const media = await downloadMedia(m);
    const mediaUrl = await uploadImage(media);
    
    const response = await fetch(
      `https://api.yanzbotz.live/api/ai/gemini-image?url=${mediaUrl}&query=${
        m.text || "Please analyze this image/video"
      }&apiKey=yanzdev`
    ).then(r => r.json());

    await conn.sendMessage(m.chat, { text: response.result }, { quoted: m });
    await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
  } catch (error) {
    console.error('Error handling media:', error);
    await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
    m.reply('Failed to process media message.');
  }
}

// Enhanced text handling
async function handleText(m, conn) {
  const model = global.db.data.users[m.sender].yanzModel || models.default;
  
  const initialResponse = await conn.sendMessage(
    m.chat,
    { text: "```Searching for an answer...```" },
    { quoted: m }
  );

  try {
    let queryText = m.text.trim();
    if (m.quoted?.text) {
      queryText = `${m.quoted.text}\n\n${queryText}`;
    }

    // Remove mentions and clean text
    queryText = queryText.replace(/@\d+/g, '').trim();

    const response = await YanzGPT(queryText, model);
    const formattedResponse = formatResponse(response.message);

    await conn.sendMessage(m.chat, { 
      text: formattedResponse, 
      edit: initialResponse.key 
    });

    if (response.image) {
      const buffer = Buffer.from(response.image, "base64");
      await sendImageResponse(m, conn, buffer);
    }
  } catch (error) {
    console.error('Error handling text:', error);
    await conn.sendMessage(m.chat, {
      text: "An error occurred while processing your request.",
      edit: initialResponse.key
    });
  }
}

// Message handler
handler.before = async (m, { conn }) => {
  if (m.isBaileys && m.fromMe) return;
  if (m.sender === 'status@broadcast') return;
  if (m.isGroup) return;

  let chatbot = global.db.data.users[m.sender].chatbot;
  if (!chatbot || chatbot !== 'yanzgpt') return;

  // Skip command messages
  if (m.text?.match(/^[\.#!\/\\]/)) return;

  try {
    if (m.message?.audioMessage || m.quoted?.mtype === 'audioMessage') {
      await handleAudio(m, conn);
    } else if (m.message?.imageMessage || m.quoted?.mtype === 'imageMessage' ||
               m.message?.videoMessage || m.quoted?.mtype === 'videoMessage') {
      await handleMedia(m, conn);
    } else if (m.text) {
      await handleText(m, conn);
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    m.reply('An error occurred while processing your request.');
  }
};

handler.help = ['yanzgpt'];
handler.tags = ['ai'];
handler.command = ['yanzgpt'];
handler.premium = false;
handler.limit = false;

export default handler;