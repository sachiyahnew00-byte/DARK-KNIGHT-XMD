const { cmd } = require('../command');
const { File } = require('megajs');
const axios = require('axios');
const path = require('path');
const mime = require('mime-types');


cmd({
    pattern: "mega",
    alias: ["meganz"],
    desc: "Download Mega.nz files via API",
    react: "🌐",
    category: "download",
    filename: __filename
}, async (conn, m, store, { from, q, reply }) => {
    try {
        if (!q) return reply("❌ Please provide a Mega.nz link.");

        await conn.sendMessage(from, { react: { text: "⬇️", key: m.key } });

        const apiUrl = `https://api-dark-shan-yt.koyeb.app/download/meganz?url=${encodeURIComponent(q)}&apikey=65d6c884d8624c71`;
        const { data } = await axios.get(apiUrl);

        if (!data.status || !data.data?.result?.length) {
            return reply("⚠️ Invalid Mega link or API error.");
        }

        const file = data.data.result[0];
        if (!file.download) return reply("⚠️ Download link not found.");

        // Mimetype එක extension එකෙන් හෝ link එකේ headers වලින් ලබා ගැනීම
        let determinedMime = mime.lookup(file.name);
        if (!determinedMime) {
            try {
                const headRes = await axios.head(file.download);
                determinedMime = headRes.headers['content-type'];
            } catch (e) {
                determinedMime = "application/octet-stream";
            }
        }

        await conn.sendMessage(from, { react: { text: "⬆️", key: m.key } });

        await conn.sendMessage(from, {
            document: { url: file.download },
            fileName: file.name,
            mimetype: determinedMime|| "application/octet-stream",
            caption: `📁 *File:* ${file.name}\n📦 *Size:* ${(file.size / 1024 / 1024).toFixed(2)} MB\n\n*© Powered By 𝙳𝙰𝚁𝙺-𝙺𝙽𝙸𝙶𝙷𝚃-𝚇𝙼𝙳*`
        }, { quoted: m });

        await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

    } catch (err) {
        console.error(err);
        reply("❌ Mega API download failed.");
    }
});


cmd({
    pattern: "mega2",
    alias: ["meganz2"],
    react: "📦",
    desc: "Download Mega files directly using MegaJS",
    category: "downloader",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("📦 Please provide a Mega.nz link.");

        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        // MegaJS හරහා File Attributes ලබා ගැනීම
        const file = File.fromURL(q);
        await file.loadAttributes();

        const downloadUrl = await file.link();
      
        const determinedMime = mime.lookup(file.name) || "application/octet-stream";

        await conn.sendMessage(from, { react: { text: '⬆️', key: m.key } });

        await conn.sendMessage(from, {
            document: { url: downloadUrl },
            fileName: file.name,
            mimetype: determinedMime,
            caption: `📦 *File:* ${file.name}\n⚖️ *Size:* ${(file.size / 1024 / 1024).toFixed(2)} MB\n\n> Powered by 𝙳𝙰𝚁𝙺-𝙺𝙽𝙸𝙶𝙷𝚃-𝚇𝙼𝙳`
        }, { quoted: m });

        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (error) {
        console.error("Mega2 Error:", error);
        reply("❌ MegaJS link generation failed. Make sure the link is valid.");
    }
});
