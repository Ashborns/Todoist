import axios from 'axios';
import cheerio from 'cheerio';

async function scrapeSSO(username, password) {
    try {
        // Create axios instance with better headers
        const instance = axios.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Connection': 'keep-alive',
                'Origin': 'https://sso.esaunggul.ac.id',
                'Referer': 'https://sso.esaunggul.ac.id/'
            },
            withCredentials: true
        });

        // First get the main page to get any necessary cookies
        const mainPage = await instance.get('https://sso.esaunggul.ac.id/');
        
        // Validate credentials first
        const validateResponse = await instance.post('https://sso.esaunggul.ac.id/login/process2', 
            new URLSearchParams({
                username: username,
                password: password
            }).toString()
        );

        if (validateResponse.data === 'true') {
            // If validation successful, perform actual login
            const loginResponse = await instance.post('https://sso.esaunggul.ac.id/login/process',
                new URLSearchParams({
                    username: username,
                    password: password
                }).toString(),
                {
                    maxRedirects: 5,
                    validateStatus: function (status) {
                        return status >= 200 && status < 500;
                    }
                }
            );

            // Update cookies from login response
            if (loginResponse.headers['set-cookie']) {
                instance.defaults.headers.Cookie = loginResponse.headers['set-cookie'].join('; ');
            }

            // Get dashboard page
            const dashboardResponse = await instance.get('https://sso.esaunggul.ac.id/dashboard');
            const $ = cheerio.load(dashboardResponse.data);
            
            // Extract user data - adjust selectors based on actual dashboard HTML structure
            const userData = {
                title: $('title').text().trim(),
                name: $('.profile-name, .user-name').text().trim(), // Added alternative selector
                email: $('.profile-email, .user-email').text().trim(), // Added alternative selector
                role: $('.profile-role, .user-role, .user-type').text().trim() // Added alternative selectors
            };

            if (!userData.name && !userData.email) {
                throw new Error('Failed to extract user data from dashboard');
            }

            return {
                success: true,
                data: userData
            };

        } else {
            const errorCodes = {
                '1': 'Nama Pengguna / Kata Sandi Salah',
                '2': 'Kata Sandi Anda Salah',
                '3': 'Akun Anda Sudah Tidak Aktif',
                '4': 'Akun Anda dinonaktifkan karena melakukan pelanggaran'
            };
            return {
                success: false,
                error: errorCodes[validateResponse.data] || 'Error tidak diketahui'
            };
        }

    } catch (error) {
        console.error('Scraping error:', error);
        return {
            success: false,
            error: `Error during scraping: ${error.message}`
        };
    }
}

const handler = async (m, { conn, args, usedPrefix, command }) => {
    if (!args[0] || !args[1]) {
        return m.reply(`Format salah! Gunakan:\n${usedPrefix}${command} username password\n\nContoh:\n${usedPrefix}${command} 20230801153 password123`);
    }

    const username = args[0];
    const password = args[1];

    m.react(wait);
    
    try {
        const result = await scrapeSSO(username, password);
        
        if (result.success) {
            const responseText = `✅ Login Berhasil!\n\n` +
                               `📚 ${result.data.title || 'Tidak ada judul'}\n` +
                               `👤 Nama: ${result.data.name || 'Tidak ditemukan'}\n` +
                               `📧 Email: ${result.data.email || 'Tidak ditemukan'}\n` +
                               `🔰 Role: ${result.data.role || 'Tidak ditemukan'}`;
            
            await conn.reply(m.chat, responseText, m);
            m.react(sukses);
        } else {
            await conn.reply(m.chat, `❌ Login Gagal: ${result.error}`, m);
            m.react(eror);
        }
    } catch (error) {
        console.error("Handler " + command + " error:", error);
        await conn.reply(m.chat, '❌ Terjadi kesalahan saat mengakses SSO', m);
        m.react(eror);
    }
};

handler.help = ['sso'];
handler.tags = ['tools'];
handler.command = /^(sso)$/i;
handler.limit = true;
handler.private = true;

export default handler;