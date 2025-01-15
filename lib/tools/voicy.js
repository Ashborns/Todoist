import axios from 'axios';
 
const headers = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Origin': 'https://www.voicy.network',
  'Referer': 'https://www.voicy.network/tts',
  'User-Agent': 'Postify/1.0.0'
};
 
const voicy = {
  search_voice: async (query) => {
    try {
      const { data } = await axios.post('https://www.voicy.network/search-voices', { query }, { headers });
      return { voices: data.data.map(({ title, creator, language, token, type }) => ({ title, creator, language, token, type })) };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  
  tts: async (token, text) => {
    try {
      const { data } = await axios.post('https://www.voicy.network/inference-tts', { token, text, type: 0 }, { headers });
      return { jobToken: data.data.jobToken };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  
  job_status: async (token) => {
    let status;
    const maxRetries = 20;
    const retryDelay = 5000;
    for (let retries = 0; retries < maxRetries; retries++) {
      try {
        const { data } = await axios.post('https://www.voicy.network/job_status_tts', { token }, { headers });
        status = data.data.status;
        if (status === 'complete_success') {
          const result_token = data.data.maybe_public_bucket_wav_audio_path
            ? `https://storage.googleapis.com/vocodes-public${data.data.maybe_public_bucket_wav_audio_path}`
            : null;
          return { data: { ...data.data, maybe_public_bucket_wav_audio_path: result_token } };
        }
        if (status === 'started' || status === 'pending') {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    }
    throw new Error('Terlalu banyak request api, coba lagi nanti...');
  }
};
 
export { voicy };