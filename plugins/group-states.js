const { cmd, commands } = require('../command')
const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const path = require('path')
const os = require('os')

/**
 * Helper: Media download function
 * මෙහිදී ඕනෑම media type එකක් buffer එකක් ලෙස ලබාගනී.
 */
const downloadMedia = async (message, type) => {
    const stream = await downloadContentFromMessage(message, type)
    let buffer = Buffer.from([])
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
    }
    return buffer
}

/**
 * WhatsApp status වලට ගැලපෙන Random Colors
 */
const statusColors = [
    '#075E54', '#128C7E', '#25D366', '#34B7F1', '#F44336', 
    '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', 
    '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', 
    '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', 
    '#795548', '#607D8B', '#000000'
]

cmd({
    pattern: "togroupstatus",
    alias: ["groupstatus", "statusgroup", "togcstatus"],
    react: "📢",
    category: "group",
    description: "Send text or quoted media to group status. Owner only.",
    filename: __filename
},
async (conn, mek, m, { from, isGroup, isOwner, text: q, reply }) => {

    // 1. මූලික පරීක්ෂාවන්
    if (!isGroup) return reply("❌ This command can only be used in Groups!")
    if (!isOwner) return reply("❌ Only the Bot Owner can use this command!")

    // 2. Quoted message එක සහ Media type එක වඩාත් නිවැරදිව හඳුනාගැනීම
    const quoted = m.quoted ? m.quoted : (mek.message?.extendedTextMessage?.contextInfo?.quotedMessage || null)
    const mime = quoted ? Object.keys(quoted)[0] : null

    if (!q && !quoted) {
        return reply(
            `📌 *Usage:*\n\n` +
            `• *Text Status:* .togroupstatus Hello World\n` +
            `• *Media Status:* Reply to Image/Video/Audio with .togroupstatus\n` +
            `• *Reply Text:* Reply to any text message with .togroupstatus`
        )
    }

    // --- Media Processing Functions (with proper error handling) ---

    const formatVideo = (buffer) => new Promise((resolve, reject) => {
        const tmpIn = path.join(os.tmpdir(), `vin_${Date.now()}.mp4`)
        const tmpOut = path.join(os.tmpdir(), `vout_${Date.now()}.mp4`)
        fs.writeFileSync(tmpIn, buffer)
        ffmpeg(tmpIn)
            .outputOptions(['-c:v libx264', '-c:a aac', '-movflags +faststart', '-pix_fmt yuv420p'])
            .save(tmpOut)
            .on('end', () => { 
                const outBuf = fs.readFileSync(tmpOut)
                if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn)
                if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut)
                resolve(outBuf)
            })
            .on('error', (e) => {
                if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn)
                reject(e)
            })
    })

    const formatAudio = (buffer) => new Promise((resolve, reject) => {
        const tmpIn = path.join(os.tmpdir(), `ain_${Date.now()}.mp3`)
        const tmpOut = path.join(os.tmpdir(), `aout_${Date.now()}.mp4`)
        fs.writeFileSync(tmpIn, buffer)
        ffmpeg(tmpIn)
            .loop(1)
            .outputOptions(['-c:a aac', '-b:a 128k', '-shortest'])
            .format('mp4')
            .save(tmpOut)
            .on('end', () => {
                const outBuf = fs.readFileSync(tmpOut)
                if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn)
                if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut)
                resolve(outBuf)
            })
            .on('error', (e) => {
                if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn)
                reject(e)
            })
    })

    try {
        let statusPayload = {}

        if (quoted) {
            // Media පණිවිඩයක් නම් (Image, Video, Audio)
            if (/image/.test(mime)) {
                const buffer = await downloadMedia(quoted[mime] || quoted, 'image')
                statusPayload = { 
                    image: buffer, 
                    caption: q || (quoted[mime] && quoted[mime].caption) || "" 
                }
            } 
            else if (/video/.test(mime)) {
                let buffer = await downloadMedia(quoted[mime] || quoted, 'video')
                buffer = await formatVideo(buffer)
                statusPayload = { 
                    video: buffer, 
                    caption: q || (quoted[mime] && quoted[mime].caption) || "" 
                }
            } 
            else if (/audio/.test(mime)) {
                let buffer = await downloadMedia(quoted[mime] || quoted, 'audio')
                buffer = await formatAudio(buffer)
                statusPayload = { 
                    video: buffer, 
                    mimetype: 'video/mp4', 
                    ptt: true 
                }
            } 
            else {
                // Quoted Text message එකක් නම්
                const textContent = q || quoted.conversation || quoted.extendedTextMessage?.text || quoted.text
                if (!textContent) return reply("❌ Could not find any text to upload!")
                statusPayload = { 
                    text: textContent,
                    backgroundColor: statusColors[Math.floor(Math.random() * statusColors.length)],
                    font: Math.floor(Math.random() * 5) + 1
                }
            }
        } else {
            // කෙලින්ම text එකක් පමණක් එවුවා නම්
            statusPayload = { 
                text: q,
                backgroundColor: statusColors[Math.floor(Math.random() * statusColors.length)],
                font: Math.floor(Math.random() * 5) + 1
            }
        }

        // --- වැදගත්ම කොටස: Status යැවීම ---
        // statusJidList හරහා අදාළ Group එකේ සාමාජිකයින්ට පමණක් පෙනෙන සේ යැවීම.
        await conn.sendMessage('status@broadcast', statusPayload, {
            statusJidList: [from] 
        })

        await m.react("✅")
        reply("✅ *Status Successfully Uploaded to this Group.*")

    } catch (error) {
        console.error("togroupstatus error:", error)
        await m.react("❌")
        return reply(`❌ Error sending status: ${error.message}`)
    }
})


/*const { cmd, commands } = require('../command')
const { downloadContentFromMessage } = require('@whiskeysockets/baileys')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const path = require('path')
const os = require('os')

// Helper: download media function
const downloadMedia = async (message, type) => {
    const stream = await downloadContentFromMessage(message, type)
    let buffer = Buffer.from([])
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
    }
    return buffer
}

cmd({
    pattern: "togroupstatus",
    alias: ["groupstatus", "statusgroup", "togcstatus"],
    react: "📢",
    category: "group",
    description: "Send text or quoted media to group status. Owner only.",
    filename: __filename
},
async (conn, mek, m, { from, isGroup, isOwner, text: q, reply }) => {

    if (!isGroup) return reply("❌ Group only command!")
    if (!isOwner) return reply("❌ Owner Only Command!")

    const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const quotedParticipant = mek.message?.extendedTextMessage?.contextInfo?.participant

    const hasQuoted = !!quoted

    if (!q && !hasQuoted) {
        return reply(
            `📌 *Usage:*\n` +
            `• .togroupstatus <text>\n` +
            `• Reply to image/video/audio with .togroupstatus <caption>\n` +
            `• Or just .togroupstatus to forward quoted media`
        )
    }

    // Helper: format video buffer to mp4 using ffmpeg
    const formatVideo = (buffer) => new Promise((resolve, reject) => {
        const tmpIn = path.join(os.tmpdir(), `vin_${Date.now()}.mp4`)
        const tmpOut = path.join(os.tmpdir(), `vout_${Date.now()}.mp4`)
        fs.writeFileSync(tmpIn, buffer)
        ffmpeg(tmpIn)
            .outputOptions(['-c:v libx264', '-c:a aac', '-movflags +faststart'])
            .save(tmpOut)
            .on('end', () => { resolve(fs.readFileSync(tmpOut)); fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut) })
            .on('error', reject)
    })

    // Helper: format audio buffer to mp4/aac using ffmpeg
    const formatAudio = (buffer) => new Promise((resolve, reject) => {
        const tmpIn = path.join(os.tmpdir(), `ain_${Date.now()}.ogg`)
        const tmpOut = path.join(os.tmpdir(), `aout_${Date.now()}.mp4`)
        fs.writeFileSync(tmpIn, buffer)
        ffmpeg(tmpIn)
            .outputOptions(['-c:a aac'])
            .save(tmpOut)
            .on('end', () => { resolve(fs.readFileSync(tmpOut)); fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut) })
            .on('error', reject)
    })

    try {
        let statusPayload = {}

        if (hasQuoted) {
            if (quoted?.imageMessage) {
                const caption = q || quoted.imageMessage.caption || ""
                const buffer = await downloadMedia(quoted.imageMessage, 'image')
                statusPayload = { image: buffer, mimetype: "image/jpeg" }
                if (caption) statusPayload.caption = caption

            } else if (quoted?.videoMessage) {
                const caption = q || quoted.videoMessage.caption || ""
                let buffer = await downloadMedia(quoted.videoMessage, 'video')
                buffer = await formatVideo(buffer)
                statusPayload = { video: buffer, mimetype: "video/mp4" }
                if (caption) statusPayload.caption = caption

            } else if (quoted?.audioMessage) {
                let buffer = await downloadMedia(quoted.audioMessage, 'audio')
                buffer = await formatAudio(buffer)
                statusPayload = { audio: buffer, mimetype: "audio/mp4", ptt: true }

            } else if (quoted?.conversation || quoted?.extendedTextMessage?.text) {
                statusPayload.text = quoted.conversation || quoted.extendedTextMessage.text

            } else {
                return reply("❌ Unsupported media type for group status.")
            }

            if (q && !statusPayload.caption && !statusPayload.text) {
                statusPayload.caption = q
            }
        } else {
            statusPayload.text = q
        }

        // Send as status to group
        await conn.sendMessage('status@broadcast', statusPayload, {
            statusJidList: [from]
        })

        // මෙතනින් Reaction එක සහ Success Message එක යවයි
        await m.react("✅")
        reply("✅ *Status Uploaded Successfully.*")

    } catch (error) {
        console.error("togroupstatus error:", error)
        await m.react("❌")
        return reply(`❌ Error sending group status: ${error.message}`)
    }
})*/


cmd({
    pattern: "groupstates",
    alias: ["gstates"],
    desc: "Safe group analytics",
    category: "group",
    react: "📊",
    filename: __filename
}, async (conn, mek, m, { groupMetadata, reply }) => {
    try {
        if (!m.isGroup) return reply("❌ Group only command");
        if (!groupMetadata || !groupMetadata.participants)
            return reply("⚠️ Could not fetch group metadata. Try again later.");

        const members = groupMetadata.participants;
        const stats = {
            total: members.length,
            admins: members.filter(p => p.admin === 'admin' || p.admin === 'superadmin').length,
        };
        stats.users = stats.total - stats.admins;

        const activeMembers = members.filter(
            p => p.lastSeen && (Date.now() - p.lastSeen) < 7 * 86400 * 1000
        ).length || 0;

        const analysis = [
            `👥 *Total Members:* ${stats.total}`,
            `👑 *Admins:* ${stats.admins}`,
            `👤 *Regular Users:* ${stats.users}`,
            `💬 *Recently Active:* ${activeMembers}`
        ];

        await reply(`📊 *Group States*\n\n${analysis.join('\n')}`);

    } catch (error) {
        console.error('GroupStats Error:', error);
        reply("❌ Error generating stats. Try again later.");
    }
});
