const { cmd } = require('../command');
const fs = require('fs');

// FakevCard
const fkontak = {
    "key": {
        "participant": '0@s.whatsapp.net',
        "remoteJid": '0@s.whatsapp.net',
        "fromMe": false,
        "id": "Helo"
    },
    "message": {
        "conversation": "𝙳𝙰𝚁𝙺-𝙺𝙽𝙸𝙶𝙷𝚃"
    }
};

const getContextInfo = (m) => {
    return {
        mentionedJid: [m.sender],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363400240662312@newsletter',
            newsletterName: '𝙳𝙰𝚁𝙺-𝙺𝙽𝙸𝙶𝙷𝚃',
            serverMessageId: 143,
        },
    };
};

// ============ GSTATUS COMMAND (Fixed version) ============
cmd({
    pattern: "gstatus",
    alias: ["groupstatus", "statusgc", "gcstatus"],
    react: "📢",
    desc: "Post status to group profile (appears in status/story)",
    category: "group",
    filename: __filename
},
async(conn, mek, m, {from, l, prefix, quoted, isGroup, sender, isAdmins, isBotAdmins, reply, args}) => {
try{
    if (!isGroup) return await conn.sendMessage(from, {
        text: `❌ This command can only be used in group chats`,
        contextInfo: getContextInfo({ sender: sender })
    }, { quoted: fkontak });
    
    if (!isAdmins) return await conn.sendMessage(from, {
        text: `❌ You need to be an admin to post group status`,
        contextInfo: getContextInfo({ sender: sender })
    }, { quoted: fkontak });
    
    // Get group metadata
    const groupMetadata = await conn.groupMetadata(from);
    const groupName = groupMetadata.subject;
    
    const quotedMsg = m.quoted ? m.quoted : m;
    const mime = (quotedMsg.msg || quotedMsg).mimetype || '';
    const caption = args.join(' ').trim();
    
    const defaultCaption = 
`📢 *GROUP STATUS*
━━━━━━━━━━━━━
👥 *Group:* ${groupName}
⏰ *Time:* ${new Date().toLocaleTimeString()}
━━━━━━━━━━━━━`;

    if (!/image|video|audio/.test(mime) && !caption) {
        return await conn.sendMessage(from, {
            text: `Post status that appears on group
*Examples:*
▸ Reply to image/video/audio/text
▸ Reply to .gcstatus hi`,
            contextInfo: getContextInfo({ sender: sender })
        }, { quoted: fkontak });
    }
    
    // Send processing message
    await conn.sendMessage(from, {
        text: `⏳ Posting to group status/story...`,
        contextInfo: getContextInfo({ sender: sender })
    }, { quoted: fkontak });
    
    // Prepare status text
    const statusText = caption || defaultCaption;
    
    try {
        // Method 1: Using sendPresenceUpdate
        await conn.sendPresenceUpdate('composing', from);
        
        // Handle different media types for status
        if (/image/.test(mime)) {
            const buffer = await conn.downloadMediaMessage(quotedMsg);
            
            // Post as image status using group update
            await conn.sendMessage(from, {
                image: buffer,
                caption: statusText,
                contextInfo: {
                    mentionedJid: [sender],
                    forwardingScore: 999,
                    isForwarded: true,
                    externalAdReply: {
                        title: "📢 GROUP STATUS",
                        body: groupName,
                        mediaType: 1,
                        thumbnail: buffer.slice(0, 100),
                        sourceUrl: "https://chat.whatsapp.com",
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: fkontak });
            
        } else if (/video/.test(mime)) {
            const buffer = await conn.downloadMediaMessage(quotedMsg);
            
            // Post as video status
            await conn.sendMessage(from, {
                video: buffer,
                caption: statusText,
                contextInfo: {
                    mentionedJid: [sender],
                    forwardingScore: 999,
                    isForwarded: true,
                    externalAdReply: {
                        title: "📢 GROUP STATUS",
                        body: groupName,
                        mediaType: 1,
                        sourceUrl: "https://chat.whatsapp.com",
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: fkontak });
            
        } else if (/audio/.test(mime)) {
            const buffer = await conn.downloadMediaMessage(quotedMsg);
            
            // Post as audio status
            await conn.sendMessage(from, {
                audio: buffer,
                mimetype: 'audio/mp4',
                ptt: false,
                contextInfo: {
                    mentionedJid: [sender],
                    forwardingScore: 999,
                    isForwarded: true,
                    externalAdReply: {
                        title: "📢 GROUP STATUS",
                        body: groupName,
                        mediaType: 1
                    }
                }
            }, { quoted: fkontak });
            
        } else if (caption) {
            // Post text only status
            await conn.sendMessage(from, {
                text: statusText,
                contextInfo: {
                    mentionedJid: [sender],
                    forwardingScore: 999,
                    isForwarded: true,
                    externalAdReply: {
                        title: "📢 GROUP STATUS",
                        body: groupName,
                        mediaType: 1
                    }
                }
            }, { quoted: fkontak });
        }
        
        // Send confirmation to group chat
        await conn.sendMessage(from, {
            text: `┏━❑ GSTATUS COMPLETE ━━━━━━━━━
┃ ✅ Status posted successfully
┃ 📌 Check group profile to view
┗━━━━━━━━━━━━━━━━━━━`,
            contextInfo: getContextInfo({ sender: sender })
        }, { quoted: fkontak });
        
    } catch (statusError) {
        console.log('Status error:', statusError);
        
        // Method 2: Alternative using broadcast
        try {
            // Create a broadcast message
            await conn.sendMessage("status@broadcast", {
                text: `📢 *${groupName}*\n\n${statusText}`,
                contextInfo: {
                    mentionedJid: [sender],
                    forwardingScore: 999,
                    isForwarded: true
                }
            });
            
            await conn.sendMessage(from, {
                text: `✅ Status posted as broadcast`,
                contextInfo: getContextInfo({ sender: sender })
            }, { quoted: fkontak });
            
        } catch (broadcastError) {
            throw statusError;
        }
    }

} catch (e) {
    console.log('GSTATUS ERROR:', e);
    await conn.sendMessage(from, {
        text: `❌ Failed to post group status: ${e.message}`,
        contextInfo: getContextInfo({ sender: sender })
    }, { quoted: fkontak });
    l(e);
}
});


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
