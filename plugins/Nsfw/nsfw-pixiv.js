import Pixiv from '../../lib/pixiv.js'
const {
    proto,
    generateWAMessageFromContent,
    generateWAMessageContent
} = (await import("@whiskeysockets/baileys"))["default"];
const pixiv = new Pixiv('66843587_zCSBrJ3rMQVSpiB8oO5xvYvLxqw9PxqF')

let handler = async (m, { conn, args, usedPrefix, command, text }) => {
    if (!db.data.chats[m.chat].nsfw && m.isGroup) return m.reply(global.nsfw);
  
  let user = global.db.data.users[m.sender].age;
  if (user < 17) return m.reply('❎ Kamu belum cukup umur! Silakan kembali ketika kamu berusia di atas 18 tahun');
  
    if (!text) throw `Masukan URL/input yg ingin dicari`

    await conn.sendMessage(m.chat, { react: { text: `⏱️`, key: m.key } });
    if (text.startsWith('https://www.pixiv.net/')) {
        const { data, status, message } = await pixiv.pixivDownloader(text)

        if (!status) throw message

        for (let i = 0; i < data.result.length; i++) {
            await conn.sendFile(m.chat, data.result[i].buffer, '', '', m)
        }
    } else {
        const { data, status, message } = await pixiv.pixivSearch(text, command === 'pixiv18' ? 'r18' : 'safe', 5) //'5' berapa page yang bakal di ambil, jadi misal '2' maka bakal random 2 page, 1 page = 60 gambar

        if (!status) throw message

        let list = data.filter(item => item.illustType === 0 && item.pageCount === 1);
        const shuffleArray = array => array.sort(() => Math.random() - 0.5);
        list = shuffleArray(list);

        let totalImage = 5
        let images = []
        if (list.length < totalImage) totalImage = list.length
        if (totalImage.length === 0) throw 'Pencarian Tidak Ditemukan'
        for (let i = 0; i < totalImage; i++) {
            const { data: dat, status: sta, message: mess } = await pixiv.pixivDownloader(`https://www.pixiv.net/en/artworks/${list[i].id}`)

            if (!sta) continue

            images.push({ buffer: dat.result[0].buffer, source: `https://www.pixiv.net/en/artworks/${list[i].id}` })
        }

        async function createImageMessage(imageBuffer) {
            const { imageMessage } = await generateWAMessageContent({
                'image': imageBuffer
            }, {
                'upload': conn.waUploadToServer
            });
            return imageMessage;
        }

        await conn.sendMessage(m.chat, { react: { text: `⏱️`, key: m.key } });

        const playResult = [];
        for (let i = 0; i < images.length; i++) {
            playResult.push({
                'body': proto.Message.InteractiveMessage.Body.fromObject({
                    'text': `Gambar ke -${i + 1}`
                }),
                'footer': proto.Message.InteractiveMessage.Footer.fromObject({
                    'text': "乂 P I X I V"
                }),
                'header': proto.Message.InteractiveMessage.Header.fromObject({
                    'title': "Hasil.",
                    'hasMediaAttachment': true,
                    'imageMessage': await createImageMessage(images[i].buffer)
                }),
                'nativeFlowMessage': proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                    'buttons': [
                        {
                            name: "cta_url",
                            buttonParamsJson: JSON.stringify({
                                display_text: "Source",
                                url: images[i].source,
                                merchant_url: images[i].source
                            })
                        }
                    ]
                })
            });
        }

        // Buat pesan carousel 
        const carouselMessage = generateWAMessageFromContent(m.chat, {
            'viewOnceMessage': {
                'message': {
                    'messageContextInfo': {
                        'deviceListMetadata': {},
                        'deviceListMetadataVersion': 2
                    },
                    'interactiveMessage': proto.Message.InteractiveMessage.fromObject({
                        'body': proto.Message.InteractiveMessage.Body.create({
                            'text': `Hasil Pencarian ${text}.`
                        }),
                        'footer': proto.Message.InteractiveMessage.Footer.create({
                            'text': "乂 P I X I V"
                        }),
                        'header': proto.Message.InteractiveMessage.Header.create({
                            'hasMediaAttachment': false
                        }),
                        'carouselMessage': proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                            'cards': [...playResult]
                        })
                    })
                }
            }
        }, {});

        // Kirim pesan carousel
        await conn.relayMessage(m.chat, carouselMessage.message, {
            'messageId': carouselMessage.key.id
        })
    }


    await conn.sendMessage(m.chat, { react: { text: `✅`, key: m.key } });
}
handler.help = ['pixiv <url>', 'pixiv18']
handler.tags = ['nsfw', 'menuprem']
handler.command = ['pixiv', 'pixiv18']

handler.register = true
handler.premium = true
handler.age = 18

export default handler