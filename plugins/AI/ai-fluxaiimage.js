import axios from 'axios';
import FormData from 'form-data';
import * as cheerio from 'cheerio';

class FluxImage {
  constructor() {
    this.baseUrl = 'https://devrel.app.n8n.cloud/form/flux';
    this.availableStyles = [
      'Hyper-Surreal Escape',
      'Neon Fauvism',
      'Post-Analog Glitchscape',
      'AI Dystopia',
      'Vivid Pop Explosion'
    ];
  }

  getStyleByNumber(number) {
    const index = parseInt(number, 10) - 1;
    if (index >= 0 && index < this.availableStyles.length) {
      return this.availableStyles[index];
    }
    throw new Error('Invalid style number. Please choose a number from the list.');
  }

  async create(prompt, styleNumber) {
    const style = this.getStyleByNumber(styleNumber);

    const formData = new FormData();
    formData.append('field-0', prompt);
    formData.append('field-1', style);

    const headers = {
      ...formData.getHeaders(),
      'Accept': '/',
      'User-Agent': 'FluxImageGenerator/1.0.0'
    };

    try {
      const { data } = await axios.post(this.baseUrl, formData, { headers });
      const $ = cheerio.load(data);

      const imageUrl = $('.image-container img').attr('src');
      const returnedStyle = $('.style-text').text().replace('Style: ', '');

      if (!imageUrl) {
        throw new Error('Failed to scrape image URL.');
      }

      return {
        image: imageUrl,
        style: returnedStyle
      };
    } catch (error) {
      console.error('Error in creating image:', error.message);
      throw new Error('Failed to generate image. Please try again later.');
    }
  }

  listStyles() {
    return this.availableStyles
      .map((style, index) => `${index + 1}. ${style}`)
      .join('\n');
  }
}

const handler = async (m, { conn, args, usedPrefix, command }) => {
  if (args[0] === 'list') {
    const fluxImage = new FluxImage();
    const styleList = fluxImage.listStyles();
    return m.reply(`Available styles:\n${styleList}\n\nUsage:\n${usedPrefix}${command} <prompt> <style number>\nExample:\n${usedPrefix}${command} A futuristic city 2`);
  }

  const promptText = args.slice(0, -1).join(' ');
  const styleNumber = args[args.length - 1];

  if (!promptText || isNaN(styleNumber)) {
    return m.reply(`Please provide both a prompt and a style number.\nUse "${usedPrefix}${command} list" to see the available styles.`);
  }

  const fluxImage = new FluxImage();

  try {
    const response = await fluxImage.create(promptText, styleNumber);
    await conn.sendFile(m.chat, response.image, 'image.jpg', `Generated in style: ${response.style}`, m);
  } catch (error) {
    console.error(error);
    m.reply(`Error: ${error.message}`);
  }
};

handler.help = ['fluximage'];
handler.tags = ['ai'];
handler.command = /^(fluximage)$/i;

export default handler;
