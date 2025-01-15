import fetch from "node-fetch";
import axios from "axios";

const api_key = "SG_8bc7975ff91a8b13";

const postRequest = async (url, data, responseType = "arraybuffer") => {
  const response = await axios.post(url, data, {
    headers: {
      "x-api-key": api_key
    },
    responseType: responseType
  });
  return Buffer.from(response.data);
};

const generateImage = async (endpoint, prompt, extraData = {}) => {
  const url = `https://api.segmind.com/v1/${endpoint}`;
  const data = {
    prompt: prompt,
    seed: Math.floor(Math.random() * 1e9),
    ...extraData
  };
  return await postRequest(url, data);
};

const upscaleImage = async (image) => {
  const url = "https://api.segmind.com/v1/clarity-upscaler";
  const reqBody = {
    seed: 1337,
    image: image,
    prompt: "masterpiece, best quality, highres, <lora:more_details:0.5> <lora:SDXLrender_v2.0:1>",
    dynamic: 6,
    handfix: "disabled",
    sharpen: 0,
    sd_model: "juggernaut_reborn.safetensors [338b85bc4f]",
    scheduler: "DPM++ 3M SDE Karras",
    creativity: .35,
    downscaling: false,
    resemblance: .6,
    scale_factor: 1,
    tiling_width: 112,
    output_format: "png",
    tiling_height: 144,
    negative_prompt: "(worst quality, low quality, normal quality:2) JuggernautNegative-neg",
    num_inference_steps: 18,
    downscaling_resolution: 768
  };
  return await postRequest(url, reqBody);
};

const processSamV2Video = async (input_video, prompt) => {
  const url = "https://api.segmind.com/v1/sam-v2-video";
  const data = {
    input_video: input_video,
    prompt: prompt,
    overlay_mask: true
  };
  return await postRequest(url, data);
};

const handler = async (m, {
  conn,
  args,
  usedPrefix,
  command
}) => {
  try {
    const q = m.quoted || m;
    const mime = (q.msg || q).mimetype || "";
    const inputUrl = args.join(" ") || q.text || q.caption;

    if (!inputUrl) {
      return m.reply(`Masukkan prompt.\nContoh:\n*${usedPrefix}${command} [prompt]*`);
    }

    m.react(wait);
    let resultBuffer;
    const captionText = `✨ *${command.toUpperCase()}*\n- *Request oleh:* @${m.sender.split("@")[0]}`;

    switch (command) {
      case "segmindimg2img":
        if (!mime) return m.reply(`Masukkan gambar dan prompt.\nContoh:\n*${usedPrefix}${command} [URL gambar] [prompt]*`);
        const base64Image = await q.upload();
        resultBuffer = await generateImage("flux-img2img", inputUrl, {
          image: base64Image,
          steps: 20,
          denoise: .75,
          scheduler: "simple",
          sampler_name: "euler",
          base64: false
        });
        await conn.sendMessage(m.chat, {
          image: resultBuffer,
          caption: captionText,
          mentions: [m.sender]
        }, {
          quoted: m
        });
        break;

      case "segmindupscale":
        if (!mime) return m.reply(`Masukkan gambar.\nContoh:\n*${usedPrefix}${command} [url gambar]*`);
        const upscaleImg = await q.upload();
        resultBuffer = await upscaleImage(upscaleImg);
        await conn.sendMessage(m.chat, {
          image: resultBuffer,
          caption: captionText,
          mentions: [m.sender]
        }, {
          quoted: m
        });
        break;

      case "segmindcog":
        resultBuffer = await generateImage("cog-video-5b-t2v", inputUrl, {
          input_frames: 49,
          steps: 45,
          guidance_scale: 6,
          frame_rate: 8
        });
        await conn.sendMessage(m.chat, {
          video: resultBuffer,
          caption: captionText,
          mentions: [m.sender]
        }, {
          quoted: m
        });
        break;

      case "segmindsamv2video":
        if (!mime) return m.reply(`Masukkan video dan prompt.\nContoh:\n*${usedPrefix}${command} [url video]*`);
        const samV2Video = await q.upload();
        resultBuffer = await processSamV2Video(samV2Video, inputUrl);
        await conn.sendMessage(m.chat, {
          video: resultBuffer,
          caption: captionText,
          mentions: [m.sender]
        }, {
          quoted: m
        });
        break;

      default:
        m.reply("Command tidak dikenal.");
        break;
    }
    m.react(sukses);
  } catch (error) {
    console.error(error);
    m.react(eror);
    m.reply(`Terjadi kesalahan: ${error.message}`);
  }
};

handler.help = ["segmindimg2img", "segmindupscale", "segmindcog", "segmindsamv2video"];
handler.command = /^(segmindimg2img|segmindupscale|segmindcog|segmindsamv2video)$/i;

export default handler;
