import WebSocket from 'ws';
import crypto from 'crypto';
import fs from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';

class CharacterAI {
    constructor(path) {
        this.dataPath = path || './characterAI.json';
        this.userData = {};
        this.token = null;
        this.user_id = null;
        this.timeout = null;
        this.expires = 600000;
        this.webSocket = null;
        this.requests = [];
        this.initate = false;
    }

    async loadData() {
        try {
            let data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
            this.userData = data.user
            this.token = data.token
            this.user_id = data.user_id
            this.initate = true
        } catch (error) {
            this.initate = true
        }
    }

    async saveData() {
        try {
            let data = JSON.stringify({ user: this.userData, token: this.token, user_id: this.user_id }, null, 4);
            fs.writeFileSync(this.dataPath, data);
        } catch (error) {
            throw error;
        }
    }

    async connect() {
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
                    await this.connectWebSocket();
                }
                return;
            } catch (error) {
                console.error('Error saat menghubungkan WebSocket:', error);
                retryCount++;
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }

        console.error(`Gagal terhubung setelah ${maxRetries} kali percobaan.`);
        throw 'Gagal terhubung setelah ' + maxRetries + ' kali percobaan.';
    }

    async connectWebSocket() {
        const ws = new WebSocket('wss://neo.character.ai/ws/', {
            headers: { Cookie: `HTTP_AUTHORIZATION="Token ${this.token}"` }
        });

        this.webSocket = ws;

        this.setWebSocketTimeout();

        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
        });

        console.log(`WebSocket terhubung.`);

        ws.on('message', this.handleMessage.bind(this));
    }

    setWebSocketTimeout() {
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            console.log(`Menutup WebSocket karena tidak aktif setelah 10 menit.`);
            this.webSocket.close();
            this.webSocket = null;
        }, this.expires);
    }

    handleMessage(data) {
        const response = JSON.parse(data);
        const requestIndex = this.requests.findIndex((req) => req.request_id === response.request_id);

        if (requestIndex !== -1) {
            const { resolve, args } = this.requests[requestIndex];

            if (['neo_error', 'STATE_OK'].includes(response.command) || response.turn?.state === 'STATE_OK') {
                if (args.chatbot) {
                    if (response.turn?.candidates[0]?.is_final && !response.turn.author.is_human) {
                        resolve(response);
                        this.requests.splice(requestIndex, 1);
                    }

                    if (response.error_code === 400) {
                        resolve('MISSID')
                    }
                    return;
                }
                resolve(response);
                this.requests.splice(requestIndex, 1);
            }
        } else {
            console.log('Tidak ditemukan permintaan yang cocok untuk:', response.request_id);
        }
    }

    async request(o, args = {}) {
        try {
            if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
                console.log(`Mencoba terhubung ke WebSocket...`);
                await this.connect();
            }

            o.request_id = o.request_id || this.uuidv4();
            this.webSocket.send(JSON.stringify(o));

            return new Promise((resolve) => {
                this.requests.push({ request_id: o.request_id, resolve, args });
            });
        } catch (error) {
            throw error;
        }
    }

    async ask(username = 'guest', user = '0000', character_id = null, text, newChat = false) {
        try {
            console.log('Asking:', text);
            if (!this.initate) await this.loadData();
            if (!this.token) throw 'Token tidak ditemukan';
            	if (!this.user_id) {
                await this.getUserId();
            }
            if (!this.userData[user]) await this.setUser(user, character_id);
            let payload = this.userData[user]

            if (!payload.conversation[payload.character_id] || newChat) {
                payload.conversation[payload.character_id] = {
                    'id': await this.createChat(payload.character_id),
                }

                this.userData[user] = payload;
                await this.saveData();
            }

            let chat_id = payload.conversation[payload.character_id].id;

            const author = this.createAuthorHuman(this.user_id, username);
            const turn_id = this.uuidv4();
            const request_id = this.uuidv4();
            const resPayload = {
                command: 'create_and_generate_turn',
                request_id: request_id,
                payload: {
                    num_candidates: 1,
                    tts_enabled: false,
                    selected_language: '',
                    character_id: payload.character_id,
                    user_name: author.name,
                    turn: {
                        turn_key: { turn_id: turn_id, chat_id },
                        author,
                        candidates: [{ candidate_id: turn_id, raw_content: text }],
                        primary_candidate_id: turn_id
                    }
                },
                origin_id: 'web-next'
            };

            console.log('Sending Message...')
            const result = await this.request(resPayload, { chatbot: true });
            if (result === 'MISSID') {
                console.log('Request ID not found, retrying...')
                return await this.ask(username, user, character_id, text, true);
            }

            if (!payload.conversation[payload.character_id].name) {
                let res = await axios.post('https://plus.character.ai/chat/character/info/', { "external_id": payload.character_id }).then(res => res.data)

                payload.conversation[payload.character_id]['name'] = res.character.name;
                payload.conversation[payload.character_id]['avatar_url'] = 'https://characterai.io/i/400/static/avatars/' + res.character['avatar_file_name'];
                this.userData[user].conversation = payload.conversation;
                
                await this.saveData();
            }

            return { response: result.turn.candidates[0].raw_content, ai: payload.conversation[payload.character_id] };
        } catch (error) {
            console.error('Error saat mengirim permintaan:', error);
            throw error;
        }
    }

    async createChat(character_id) {
        try {
            if (!this.user_id) {
                await this.getUserId();
            }

            character_id = character_id || '0'
            const chat_id = this.uuidv4();
            const creator_id = this.user_id

            const req = {
                command: "create_chat",
                payload: {
                    chat: {
                        chat_id: chat_id,
                        creator_id: creator_id,
                        visibility: "VISIBILITY_PRIVATE",
                        character_id: character_id,
                        type: "TYPE_ONE_ON_ONE"
                    },
                    with_greeting: true
                }
            };

            const response = await this.request(req);
            return response.turn.turn_key.chat_id;
        } catch (error) {
            console.error('Error saat membuat chat baru:', error.message);
            throw error;
        }
    }

    async getUserId() {
        try {
            const character_id = '0'
            const chat_id = this.uuidv4();
            const creator_id = '0';

            const req = {
                command: "create_chat",
                payload: {
                    chat: {
                        chat_id: chat_id,
                        creator_id: creator_id,
                        visibility: "VISIBILITY_PRIVATE",
                        character_id: character_id,
                        type: "TYPE_ONE_ON_ONE"
                    },
                    with_greeting: true
                }
            };

            return new Promise((resolve, reject) => {
                console.log(this.token)
                const ws = new WebSocket('wss://neo.character.ai/ws/', {
                    headers: { Cookie: `HTTP_AUTHORIZATION="Token ${this.token}"` }
                });

                ws.on('open', () => {
                    ws.send(JSON.stringify(req));
                });

                ws.on('message', (message) => {
                    const response = JSON.parse(message);
                    if (response.comment?.startsWith('Unauthorized access for user_id:')) {
                        this.user_id = response.comment.replace(/[^0-9]/g, '');
                        this.saveData();
                        resolve();
                    }
                });

                ws.on('error', (error) => {
                    console.error('Error saat mengambil user ID');
                    reject(error);
                });
            });
        } catch (error) {
            console.error('Error saat mengambil user ID:', error);
            throw error;
        }
    }

    async searchCharacter(query) {
        const url = `https://character.ai/search?q=${encodeURIComponent(query)}`;
        try {
            const response = await axios.get(url);
            const html = response.data;
            const $ = cheerio.load(html);
    
            const scriptTag = $('#__NEXT_DATA__');
            if (scriptTag.length === 0) {
                throw new Error('Script tag with id "__NEXT_DATA__" not found.');
            }
    
            const jsonData = JSON.parse(scriptTag.html())
    
            let result = jsonData.props.pageProps.prefetchedSearchResults.slice(0, 20);
            return result
        } catch (error) {
            console.error('Error fetching or parsing data:', error);
            throw error;
        }
    }

    async setUser(user, character_id) {
        if (!this.initate) {
            await this.loadData();
        }
        
        if (!this.userData[user]) {
            this.userData[user] = {
                'character_id': character_id || 'ry8gF_zBtaSQgVTQ-LQrS98yxtCNZ86SRH7R1L0g6iU',
                'conversation': {}
            }
        } else {
            this.userData[user].character_id = character_id || 'ry8gF_zBtaSQgVTQ-LQrS98yxtCNZ86SRH7R1L0g6iU';
        }

        await this.saveData();
        return this.userData[user];
    }

    uuidv4() {
        return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
            (c ^ (crypto.randomBytes(1)[0] & 15) >> (c / 4)).toString(16)
        );
    }

    createAuthorHuman(author_id, name) {
        return { author_id: author_id.toString(), name: name.toString(), is_human: true };
    }
}

export default CharacterAI