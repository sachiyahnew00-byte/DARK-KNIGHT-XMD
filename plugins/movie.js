const { cmd } = require("../command");
const axios = require("axios");
const config = require('../config');
const NodeCache = require("node-cache");

const movieCache = new NodeCache({ stdTTL: 100, checkperiod: 120 });

cmd({
    pattern: "moviepro",
    alias: ["mpro"],
    desc: "🎥 Search and download movies from Silent Tech API",
    category: "media",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q }) => {

    if (!q) return await conn.sendMessage(from, { text: "Use: .moviepro <movie name>" }, { quoted: mek });

    try {
        const cacheKey = `moviepro_${q.toLowerCase()}`;
        let data = movieCache.get(cacheKey);

        if (!data) {
            const url = `https://silent-movies-api.vercel.app/api/search?q=${encodeURIComponent(q)}&key=silent`;
            const res = await axios.get(url);
            
            data = res.data;
  
            if (!data.data?.items?.length) throw new Error("No results found.");
            movieCache.set(cacheKey, data);
        }

        const movieList = data.data.items.map((m, i) => ({
            number: i + 1,
            id: m.subjectId,
            title: m.title,
            year: m.releaseDate,
            time: m.duration,
            genre: m.genre,
            thumbnail: m.cover?.url,
            country: m.countryName,
            imdb: m.imdbRatingValue,
            post: m.postTitle
        }));

        let textList = "🔢 𝑅𝑒𝑝𝑙𝑦 𝐵𝑒𝑙𝑜𝑤 𝑁𝑢𝑚𝑏𝑒𝑟\n━━━━━━━━━━━━━━━━━\n\n";
        movieList.forEach(m => {
            textList += `🔸 *${m.number}. ${m.title}* (${m.year ? m.year.split('-')[0] : 'N/A'})\n`;
        });

        const sentMsg = await conn.sendMessage(from, {
            text: `*🔍 𝐌𝐎𝐕𝐈𝐄𝐏𝐑𝐎 𝑪𝑰𝑵𝑬𝑴𝑨 𝑺𝑬𝑨𝑹𝑪𝑯 🎥*\n\n${textList}\n💬 Reply with movie number to view details.\n\n> Powered by 𝙳𝙰𝚁𝙺-𝙺𝙽𝙸𝙶𝙷𝚃-𝚇𝙼𝙳`,
        }, { quoted: mek });

        const movieMap = new Map();

        const listener = async (update) => {
            const msg = update.messages?.[0];
            if (!msg?.message?.extendedTextMessage) return;

            const replyText = msg.message.extendedTextMessage.text.trim();
            const repliedId = msg.message.extendedTextMessage.contextInfo?.stanzaId;

            if (replyText.toLowerCase() === "done") {
                conn.ev.off("messages.upsert", listener);
                return;
            }

            if (repliedId === sentMsg.key.id) {
                const num = parseInt(replyText);
                const selected = movieList.find(m => m.number === num);
                if (!selected) return;

                await conn.sendMessage(from, { react: { text: "🎯", key: msg.key } });

                const movieUrl = `https://silent-movies-api.vercel.app/api/media?id=${selected.id}&key=silent`;
                const movieRes = await axios.get(movieUrl);
                
                const downloads = movieRes.data?.data?.data?.downloadUrls || movieRes.data?.data?.downloadUrls;

                if (!downloads || !Array.isArray(downloads) || downloads.length === 0) {
                    return conn.sendMessage(from, { text: "No download links available for this movie." }, { quoted: msg });
                }
                
                let info = 
                    `🎬 *${selected.title}*\n\n` +
                    `⭐ *IMDb:* ${selected.imdb}\n` +
                    `📅 *Released:* ${selected.year}\n` +
                    `🌍 *Country:* ${selected.country}\n` +
                    `🕐 *Runtime:* ${selected.time}\n` +
                    `🎭 *Category:* ${selected.genre}\n` +
                    `📝 *Posttitle:*\n${selected.post}\n\n` +
                    `🎥 *𝑫𝒐𝒘𝒏𝒍𝒐𝒂𝒅 𝑳𝒊𝒏𝒌𝒔:* 📥\n\n`;
                
                downloads.forEach((d, i) => {
                    info += `♦️ ${i + 1}. *${d.quality}p* — ${d.size_formatted}\n`;
                });
                info += "\n🔢 Reply with number to download.";

                const downloadMsg = await conn.sendMessage(from, {
                    image: { url: selected.thumbnail },
                    caption: info
                }, { quoted: msg });

                movieMap.set(downloadMsg.key.id, { selected, downloads });
            }

            else if (movieMap.has(repliedId)) {
                const { selected, downloads } = movieMap.get(repliedId);
                const num = parseInt(replyText);
                const chosen = downloads[num - 1];
                if (!chosen) return;

                await conn.sendMessage(from, { react: { text: "📥", key: msg.key } });

                const sizeInBytes = parseInt(chosen.size);
                const sizeGB = sizeInBytes / (1024 * 1024 * 1024);

                if (sizeGB > 2) {
                    return conn.sendMessage(from, { text: `⚠️ Large file (${sizeGB.toFixed(2)} GB)` }, { quoted: msg });
                }

                await conn.sendMessage(from, {
                    document: { url: chosen.downloadUrl },
                    mimetype: "video/mp4",
                    fileName: `${selected.title} - ${chosen.quality}.mp4`,
                    caption: `🎬 *${selected.title}*\n🎥 *${chosen.quality}p*\n\n> Powered by 𝙳𝙰𝚁𝙺-𝙺𝙽𝙸𝙶𝙷𝚃-𝚇𝙼𝙳`
                }, { quoted: msg });
            }
        };

        conn.ev.on("messages.upsert", listener);

    } catch (err) {
        await conn.sendMessage(from, { text: `*Error:* ${err.message}` }, { quoted: mek });
    }
});


cmd({
    pattern: "mvdetail",
    desc: "Fetch detailed information about a movie.",
    category: "utility",
    react: "🎬",
    filename: __filename
},
async (conn, mek, m, { from, reply, sender, args }) => {
    try {
        // Properly extract the movie name from arguments
        const movieName = args.length > 0 ? args.join(' ') : m.text.replace(/^[\.\#\$\!]?movie\s?/i, '').trim();
        
        if (!movieName) {
            return reply("📽️ Please provide the name of the movie.\nExample: .movie Iron Man");
        }

        const apiUrl = `https://apis.davidcyriltech.my.id/imdb?query=${encodeURIComponent(movieName)}`;
        const response = await axios.get(apiUrl);

        if (!response.data.status || !response.data.movie) {
            return reply("🚫 Movie not found. Please check the name and try again.");
        }

        const movie = response.data.movie;
        
        // Format the caption
        const dec = `
🎬 *${movie.title}* (${movie.year}) ${movie.rated || ''}

⭐ *IMDb:* ${movie.imdbRating || 'N/A'} | 🍅 *Rotten Tomatoes:* ${movie.ratings.find(r => r.source === 'Rotten Tomatoes')?.value || 'N/A'} | 💰 *Box Office:* ${movie.boxoffice || 'N/A'}

📅 *Released:* ${new Date(movie.released).toLocaleDateString()}
⏳ *Runtime:* ${movie.runtime}
🎭 *Genre:* ${movie.genres}

📝 *Plot:* ${movie.plot}

🎥 *Director:* ${movie.director}
✍️ *Writer:* ${movie.writer}
🌟 *Actors:* ${movie.actors}

🌍 *Country:* ${movie.country}
🗣️ *Language:* ${movie.languages}
🏆 *Awards:* ${movie.awards || 'None'}

[View on IMDb](${movie.imdbUrl})
`;

        // Send message with the requested format
        await conn.sendMessage(
            from,
            {
                image: { 
                    url: movie.poster && movie.poster !== 'N/A' ? movie.poster : 'https://files.catbox.moe/brlkte.jpg'
                },
                caption: dec,
                contextInfo: {
                    mentionedJid: [sender],
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363400240662312@newsletter',
                        newsletterName: '𝙳𝙰𝚁𝙺-𝙺𝙽𝙸𝙶𝙷𝚃-𝚇𝙼𝙳',
                        serverMessageId: 143
                    }
                }
            },
            { quoted: mek }
        );

    } catch (e) {
        console.error('Movie command error:', e);
        reply(`❌ Error: ${e.message}`);
    }
});
