import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';

class SpicyAI {
    constructor(path) {
        this.path = path || './SpicyAI.json';
        this.userData = {};
        this.bearer = null;
        this.load = false;
    }

    async loadData() {
        try {
            const data = JSON.parse(fs.readFileSync(this.path, 'utf8'));
            this.userData = data.user
            this.bearer = data.bearer
            this.load = true
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.load = true
            } else {
                throw error;
            }
        }
    }

    async saveData() {
        try {
            const data = JSON.stringify({ user: this.userData, bearer: this.bearer}, null, 4);
            fs.writeFileSync(this.path, data);
        } catch (error) {
            throw error;
        }
    }

    async searchCharacters(param) {
        try {
            if (!param) throw new Error('Parameter tidak boleh kosong');

            const url = 'https://etmzpxgvnid370fyp.a1.typesense.net/multi_search';
            const apiKey = 'Meet8Q3nyEoWmLaDAmNuf6PK84MB0qs8';
            const payload = {
                "searches": [
                    {
                        "query_by": "name,title,tags,creator_username,character_id",
                        "use_cache": true,
                        "sort_by": "num_messages_24h:desc",
                        "highlight_full_fields": "name,title,tags,creator_username,character_id",
                        "collection": "characters",
                        "q": param,
                        "facet_by": "tags",
                        "filter_by": "application_ids:spicychat && tags:!Step-Family",
                        "max_facet_values": 100,
                        "page": 1,
                        "per_page": 48
                    }
                ]
            };
    
            let response = await axios.post(`${url}?x-typesense-api-key=${apiKey}`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }).then(res => res.data);
    
            return response
        } catch (error) {
            throw error;
        }
    }

    async infoChar(charID) {
        try {
            const url = `https://4mpanjbsf6.execute-api.us-east-1.amazonaws.com/v2/characters/${charID}`;
    
            let response = await axios.get(url, {
                headers: {
                    'Accept': 'application/json',
                    'x-app-id': 'spicychat',
                    'x-guest-userid': this.generateRandomID(),
                }
            }).then(res => res.data);
    
            return response
        } catch (error) {
            throw error;
        }
    }

    async ask(user = 'guest', character_id = null, text, type = 'message') {
        const url = 'https://chat.nd-api.com/chat';
        let postType = ['message', 'autopilot', 'continue_chat'];
        let headers = {
            'content-type': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
            'x-app-id': 'spicychat',
            'x-country': 'ID',
        };

        if (!this.load) {
            await this.loadData();
        }

        if (!postType.includes(type)) throw new Error(`Invalid post type: ${type}`);
        if (type === 'message' && !text) throw new Error('Text is required for message type');

        if (!this.userData[user]) await this.setUser(user, character_id);
        const payload = this.userData[user];
        if (character_id && payload.character_id !== character_id) {
            this.userData[user].character_id = character_id;
            payload.character_id = character_id;
            payload.conversation = {};
        }

        let param = {
            "conversation_id": payload.conversation.id,
            "character_id": payload.character_id,
            "inference_model": "default",
            "inference_settings": {
                "max_new_tokens": 180,
                "temperature": 0.7,
                "top_p": 0.7,
                "top_k": 90
            }
        };

        param[type] = type === 'message' ? text : true

        if (this.bearer) {
            headers['authorization'] = this.bearer
        } else {
            headers['x-guest-userid'] = payload.userId
        }

        try {
            const response = await axios.post(url, param, { headers }).then(res => res.data);

            if (type === 'autopilot') {
                const content = response.message.content;
                delete param['autopilot'];
                param['message'] = content;
                const responsePilot = await axios.post(url, param, { headers }).then(res => res.data);

                if (!payload.conversation.id || payload.conversation.id && payload.conversation.id !== responsePilot.message.conversation_id) {
                    let char = await this.infoChar(payload.character_id);

                    payload.conversation = {
                        'id': responsePilot.message.conversation_id,
                        'name': char.name,
                        'avatar_url': `https://ndsc.b-cdn.net/avatars/${char.avatar_url}`,
                        'is_nsfw': char.is_nsfw,
                        'avatar_is_nsfw': char.avatar_is_nsfw
                    }
                    this.userData[user].conversation = payload.conversation;
                    
                    await this.saveData();
                }

                return {
                    content: content,
                    response: responsePilot,
                    ai: payload.conversation
                }
            } else {
                if (!payload.conversation.id || payload.conversation.id && payload.conversation.id !== response.message.conversation_id) {
                    let char = await this.infoChar(payload.character_id);

                    payload.conversation = {
                        'id': response.message.conversation_id,
                        'name': char.name,
                        'avatar_url': `https://ndsc.b-cdn.net/${char.avatar_url}`,
                        'is_nsfw': char.is_nsfw,
                        'avatar_is_nsfw': char.avatar_is_nsfw
                    }
                    this.userData[user].conversation = payload.conversation;
                    
                    await this.saveData();
                }

                return { 
                    response,
                    ai: payload.conversation
                }
            }
        } catch (error) {
            if (error.response && error.response.status === 502) {
                console.error('Error 502, Removing Conversation ID...');
                this.userData[user].conversation = {};
                return await this.ask(user, character_id, text, type);
            }
            throw error;
        }
    }

    async setUser(user, character_id) {
        if (!this.load) {
            await this.loadData();
        }
        
        this.userData[user] = {
            'userId': this.generateRandomID(),
            'character_id': character_id || '85f3e651-fedf-421d-901e-bc7219a6999d',
            'conversation': {}
        }

        await this.saveData();
        return this.userData[user];
    }

    generateRandomID() {
        const randomBytes = crypto.randomBytes(16);
        const randomString = randomBytes.toString('hex');

        return `${randomString.slice(0, 8)}-${randomString.slice(8, 12)}-${randomString.slice(12, 16)}-${randomString.slice(16, 20)}-${randomString.slice(20)}w`;
    }
}

export default SpicyAI