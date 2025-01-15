/*
Sukses Get Plugin
/plugins/AI/ai-chatai.js
𝑨𝒔𝒉𝒃𝒐𝒓𝒏𝒂𝒓𝒖
*/

const chatbotList = ['rolegpt', 'characterai', 'spicyai', 'morph', 'roleplai', 'yanzgpt', 'off']

let handler = async (m, { conn, text }) => {
    if (!text) {
        let newCap = `*_[ C H A T A I ]_*\n\nActive Chatbot :\n> ${global.db.data.users[m.sender].chatbot || 'rolegpt'}\n\nContoh Untuk Mengganti ChatBot: \n*.chatai ${chatbotList[0]}*\n\nList AI Assistant :\n- ${chatbotList.join('\n- ')}`
        throw newCap
    }

    if (chatbotList.includes(text)) {
        global.db.data.users[m.sender].chatbot = text
        m.reply(`ChatAI Telah Berhasil Diganti ke ${text}`)
        return
    } else {
        m.reply(`ChatAI ${text} Tidak Tersedia\n\n- ${chatbotList.join('\n- ')}`)
    }
};

handler.command = ['chatai'];
handler.tags = ["ai"];
handler.help = ['chatai'];
handler.vip = true

export default handler;