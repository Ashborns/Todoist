import axios from 'axios';

export const YanzGPT = (query, model) => {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await axios("https://yanzgpt.my.id/chat", {
        data: {
          query: query,
          model: model,
        },
        headers: {
          authorization: "Bearer yzgpt-sc4tlKsMRdNMecNy",
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.163 Mobile Safari/537.36",
          Referer: "https://yanzgpt.my.id/chat",
        },
        method: "POST",
      });
      resolve(response.data);
    } catch (error) {
      reject(error);
    }
  });
};

// Test code (commented out)
// YanzGPT('Buatkan saya gambar kucing yang lucu').then(a => console.log(a));