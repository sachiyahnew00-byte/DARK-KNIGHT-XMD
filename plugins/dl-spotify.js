const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "spotify",
    desc: "Search Spotify tracks",
    category: "downloader",
    react: "🎵",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("*Please provide a song name!*");

        reply("🔍 *Searching Spotify... Please wait!*");

        const response = await axios.get(`https://jerrycoder.oggyapi.workers.dev/spotify?search=${encodeURIComponent(q)}`);
        const data = response.data;

        if (data.status !== "success" || !data.tracks || data.tracks.length === 0) {
            return reply("*No songs found!*");
        }

        let txt = `🎧 *SPOTIFY SEARCH LIST* 🎧\n\n`;
        txt += `🔎 *Search:* ${q}\n\n`;

        data.tracks.forEach((s, i) => {
            txt += `*${i + 1}.* ${s.trackName}\n`;
            txt += `👤 Artist: ${s.artist}\n`;
            txt += `⏱️ Duration: ${s.durationMs}\n`;
            txt += `🖼️ Img: ${s.image}\n`;
            txt += `🔗 URL: ${s.spotifyUrl}\n\n`;
        });

        txt += `*🔢 Please Reply with the number.* \n\n> *© Powered by 𝙳𝙰𝚁𝙺-𝙺𝙽𝙸𝙶𝙷𝚃-𝚇𝙼𝙳*`;

        await conn.sendMessage(from, { text: txt }, { quoted: mek });

    } catch (e) {
        console.error(e);
        reply("*Error fetching Spotify search results.*");
    }
});

cmd({
    on: "body"
}, async (conn, mek, m, { body, from, reply }) => {
    try {
        if (!m.quoted) return;
        const quotedText = m.quoted.text || m.quoted.conversation || "";
        if (!quotedText) return;

        const selection = body.trim();
        if (isNaN(selection)) return;
        const num = parseInt(selection);

        if (quotedText.includes("SPOTIFY SEARCH LIST")) {
            const lines = quotedText.split("\n");
            const targetLineIndex = lines.findIndex(l => l.startsWith(`*${num}.*`));
            if (targetLineIndex === -1) return;

            const trackName = lines[targetLineIndex].split(".* ")[1].trim();
            const artist = lines[targetLineIndex + 1].split("Artist: ")[1].trim();
            const duration = lines[targetLineIndex + 2].split("Duration: ")[1].trim();
            const image = lines[targetLineIndex + 3].split("Img: ")[1].trim();
            const spotifyUrl = lines[targetLineIndex + 4].split("URL: ")[1].trim();

            if (trackName && spotifyUrl) {
                let formatMsg = `🎧 *Spotify Downloader* 📥\n\n`;
                formatMsg += `🎵 *Track:* ${trackName}\n`;
                formatMsg += `👤 *Artist:* ${artist}\n`;
                formatMsg += `⏱️ *Duration:* ${duration}\n`;
                formatMsg += `🔗 *URL:* ${spotifyUrl}\n\n`;
                formatMsg += `*1.* 🎵 Audio (Normal)\n`;
                formatMsg += `*2.* 📄 Document (File)\n`;
                formatMsg += `*3.* 🎤 Voice (PTT)\n\n`;
                formatMsg += `> *🔢 Please Reply Below Number.*`;

                return await conn.sendMessage(from, { 
                    image: { url: image }, 
                    caption: formatMsg 
                }, { quoted: mek });
            }
        }

        if (quotedText.includes("Spotify Downloader")) {
            if (![1, 2, 3].includes(num)) return;

            const trackName = quotedText.split("Track:* ")[1].split("\n")[0].trim();
            const spotifyUrl = quotedText.split("URL:* ")[1].split("\n")[0].trim();

            if (trackName && spotifyUrl) {
                reply(`📥 *Downloading:* ${trackName}...`);

                const dlRes = await axios.get(`https://jerrycoder.oggyapi.workers.dev/dspotify?url=${encodeURIComponent(spotifyUrl)}`);
                const dlData = dlRes.data;

                if (dlData.status === "success" && dlData.download_link) {
                    const downloadUrl = dlData.download_link;

                    switch (selection) {
                        case "1": // Normal Audio
                            await conn.sendMessage(from, {
                                audio: { url: downloadUrl },
                                mimetype: "audio/mpeg",
                                ptt: false,
                            }, { quoted: mek });
                            break;

                        case "2": // Document
                            await conn.sendMessage(from, {
                                document: { url: downloadUrl },
                                mimetype: "audio/mpeg",
                                fileName: `${trackName}.mp3`,
                                caption: `*Spotify Download*\n🎵 ${trackName}`
                            }, { quoted: mek });
                            break;

                        case "3": // Voice
                            await conn.sendMessage(from, {
                                audio: { url: downloadUrl },
                                mimetype: "audio/mpeg",
                                ptt: true,
                            }, { quoted: mek });
                            break;
                    }
                } else {
                    reply("❌ *Failed to get download link!*");
                }
            }
        }

    } catch (e) {
        console.log("Spotify Listener Error:", e);
    }
});            


cmd({
    pattern: "spotify2",
    alias: ["spot2"],
    react: "🎵",
    desc: "Download Spotify MP3",
    category: "download",
    use: ".spotify2 <spotify link>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        if (!q) return reply("❓ Please provide a Spotify track link!");

        if (!q.includes("spotify.com/track")) {
            return reply("❌ Invalid Spotify link! Please send a valid Spotify track URL.");
        }

        const api = `https://api-aswin-sparky.koyeb.app/api/downloader/spotify?url=${encodeURIComponent(q)}`;
        const { data: apiRes } = await axios.get(api);

        if (!apiRes?.status || !apiRes.data?.download) {
            return reply("❌ Unable to download this Spotify track. Please try another link!");
        }

        const result = apiRes.data;

        // Convert duration from milliseconds → mm:ss
        const minutes = Math.floor(result.durasi / 60000);
        const seconds = Math.floor((result.durasi % 60000) / 1000);
        const duration = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

        const caption = `
🎧 *Spotify Downloader* 📥

📑 *Title:* ${result.title}
👤 *Artist:* ${result.artis}
⏱️ *Duration:* ${duration}
🎶 *Type:* ${result.type}
🔗 *Link:* ${q}

🔢 *Reply Below Number*

1️⃣ *Audio Type*
2️⃣ *Document Type*
3️⃣ *Voice Note*

> Powered by 𝙳𝙰𝚁𝙺-𝙺𝙽𝙄𝙶𝙷𝚃-𝚇𝙼𝙳
`;

        const sentMsg = await conn.sendMessage(from, {
            image: { url: result.cover },
            caption
        }, { quoted: m });

        const messageID = sentMsg.key.id;

        conn.ev.on("messages.upsert", async (msgData) => {
            const receivedMsg = msgData.messages[0];
            if (!receivedMsg?.message) return;

            const receivedText = receivedMsg.message.conversation || receivedMsg.message.extendedTextMessage?.text;
            const senderID = receivedMsg.key.remoteJid;
            const isReplyToBot = receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            if (isReplyToBot) {
                await conn.sendMessage(senderID, { react: { text: '⏳', key: receivedMsg.key } });

                switch (receivedText.trim()) {
                    case "1":
                        await conn.sendMessage(senderID, {
                            audio: { url: result.download },
                            mimetype: "audio/mpeg",
                            ptt: false,
                        }, { quoted: receivedMsg });
                        break;

                    case "2":
                        await conn.sendMessage(senderID, {
                            document: { url: result.download },
                            mimetype: "audio/mpeg",
                            fileName: `${result.title}.mp3`
                        }, { quoted: receivedMsg });
                        break;

                    case "3":
                        await conn.sendMessage(senderID, {
                            audio: { url: result.download },
                            mimetype: "audio/mpeg",
                            ptt: true,
                        }, { quoted: receivedMsg });
                        break;

                    default:
                        reply("❌ Invalid option! Please reply with 1, 2, or 3.");
                }
            }
        });

    } catch (error) {
        console.error("Spotify Command Error:", error);
        reply("❌ An error occurred while processing your request. Please try again later.");
    }
});
