const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');
const config = require('../config');
const os = require('os');
const axios = require('axios');
const mimeTypes = require("mime-types");
const fs = require('fs');
const path = require('path');
const { cmd, commands } = require('../command');
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('../lib/functions');

// API Key (Environment variable එකෙන් හෝ default එක භාවිතා කරයි)
const DEFAULT_API_KEY = "AIzaSyCvHqkCfXQP7JUl50HVFs0AaAz3G3lPWXQ";

// Ovnix AI System Prompt
let usp = `
    Persona & Tone:
    You are "Ovnix AI", the official virtual assistant for Ovnix (Web Development Company in Sri Lanka).
    - Company: Ovnix.
    - Services: Web Design, Full-stack Development, WhatsApp Bot Development.
    - Pricing: Starting from Rs. 25,000 upwards.
    - Language: Primary: Sinhala. Secondary: English/Singlish.
    - Tone: Professional, Helpful, and Courteous.

    Interaction Logic:
    1. Initial Inquiry: Greet and ask for their Name and Specific Requirement (අවශ්‍යතාවය).
    2. Pricing: If asked, mention packages start from Rs. 25,000.
    3. Lead Capture: Once they provide details, say: "ස්තූතියි! [User Name], ඔබ ලබාදුන් තොරතුරු අප වෙත ලැබුණා. අපේ නියෝජිතයෙකු ඉතා ඉක්මනින් ඔබව සම්බන්ධ කර ගනු ඇත. එතෙක් කරුණාකර රැඳී සිටින්න."
    4. Termination: After the thank you message, do not engage in further conversation.
`;

const chatHistory = new Map();
const rpmBlocklist = new Map();
const disabledChats = new Set(); // Chatbot එක off වූ අයගේ ලැයිස්තුව

// Models Configuration (Gemini 1.5 & 2.0 ලේටස්ට් මොඩල්ස්)
const modelConfig = {
    models: {
        "gemini_1_5_flash": { rpd_limit: 1500, day_count: 0 },
        "gemini_1_5_pro": { rpd_limit: 50, day_count: 0 },
        "gemini_2_0_flash_exp": { rpd_limit: 1500, day_count: 0 }
    },
    priority: [
        "gemini-1.5-flash",
        "gemini-2.0-flash-exp",
        "gemini-1.5-pro"
    ],
    last_reset_date: new Date().toISOString().split('T')[0]
};

// AI Client Initializer
function getAiClient() {
    return new GoogleGenerativeAI(DEFAULT_API_KEY);
}

function cleanRawGeminiOutput(text) {
    if (!text) return "";
    return text.replace(/<tool_code>[\s\S]*?<\/tool_code>/g, "")
               .replace(/\\`\\`\\`/g, "```")
               .replace(/\(AI response.*?\)/gi, "")
               .trim();
}

function getUserHistory(userId) {
    if (!chatHistory.has(userId)) chatHistory.set(userId, []);
    return chatHistory.get(userId);
}

function addToHistory(userId, role, text) {
    const history = getUserHistory(userId);
    history.push({ role, parts: [{ text }] });
    if (history.length > 12) history.shift(); // මෑතකදී කල chat 6ක් (user + model) තබා ගනී
}

// AI එකෙන් response එකක් ලබා ගැනීම
async function getGeminiResponse(prompt, userId, options = {}) {
    const { img } = options;
    const genAI = getAiClient();
    
    // Model එක තෝරාගැනීම
    const modelName = modelConfig.priority[0]; 
    const model = genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: usp
    });

    try {
        let history = getUserHistory(userId);
        let messageParts = [{ text: prompt }];

        // පින්තූරයක් තිබේ නම් එය එකතු කිරීම
        if (img) {
            messageParts.push({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: img.toString('base64')
                }
            });
        }

        // Chat එක ආරම්භ කිරීම
        const chatSession = model.startChat({
            history: history,
            generationConfig: { maxOutputTokens: 1000 }
        });

        const result = await chatSession.sendMessage(messageParts);
        const responseText = cleanRawGeminiOutput(result.response.text());

        // History එකට එකතු කිරීම
        addToHistory(userId, "user", prompt);
        addToHistory(userId, "model", responseText);

        return { status: true, text: responseText, model: modelName };

    } catch (error) {
        console.error("Gemini Error:", error);
        return { status: false, error: error.message };
    }
}

// COMMAND: .gemini
cmd({
    pattern: "gemini",
    react: "🤖",
    desc: "Talk to Ovnix AI",
    category: "ai",
    use: ".gemini <ප්‍රශ්නය>",
    filename: __filename
},
async (conn, mek, m, { from, args, reply, prefix, sender }) => {
    try {
        const userMessage = args.join(" ");
        if (!userMessage) return await reply(`*උදාහරණ:* \`.gemini වෙබ් අඩවියක් හදන්න කීයක් යනවද?\``);

        const response = await getGeminiResponse(userMessage, sender);
        if (response.status) {
            await reply(response.text);
        } else {
            await reply("❌ සමාවන්න, මට මේ වෙලාවේ පිළිතුරක් ලබා දිය නොහැක.");
        }
    } catch (e) {
        reply("❌ දෝෂයක් සිදු විය.");
    }
});

// AUTO CHATBOT LOGIC
const MY_NUMBER = "94763934860@s.whatsapp.net"; // ඔබේ WhatsApp අංකය

cmd({ on: "body" },
    async (conn, mek, m, { from, body, isCmd, sender, reply, pushname }) => {
        try {
            // කොන්දේසි: Chatbot එක On වෙන්න ඕන, Command එකක් නොවිය යුතුයි, Bot ගෙන්ම නොවිය යුතුයි
            if (config.CHAT_BOT !== "true" || m.fromMe || isCmd) return;
            if (!body) return;
            
            // මේ chat එක දැනටමත් disabled නම් ඉවත් වෙන්න
            if (disabledChats.has(sender)) return;

            // පින්තූරයක් තිබේදැයි බැලීම
            let imageBuffer = null;
            if (m.type === 'imageMessage' || (m.quoted && m.quoted.type === 'imageMessage')) {
                imageBuffer = await (m.download ? m.download() : m.quoted.download());
            }

            const response = await getGeminiResponse(body, sender, { img: imageBuffer });

            if (response.status) {
                await reply(response.text);

                // Lead එකක් ලැබුණාදැයි පරීක්ෂා කිරීම (System Prompt එකට අනුව)
                if (response.text.includes("ස්තූතියි!") && response.text.includes("නියෝජිතයෙකු")) {
                    
                    // 1. අයිතිකරුට (ඔබට) දැනුම් දීම
                    const notification = `🚀 *නව ව්‍යාපෘති අවස්ථාවක් (New Lead)* 🚀\n\n` +
                                       `👤 *නම:* ${pushname}\n` +
                                       `📱 *අංකය:* wa.me/${sender.split('@')[0]}\n` +
                                       `💬 *අවසාන පණිවිඩය:* ${body}\n\n` +
                                       `⚠️ මෙතැන් සිට Bot මෙම පරිශීලකයාට පිළිතුරු නොදේ. කරුණාකර ඔබ මැදිහත් වන්න.`;
                    
                    await conn.sendMessage(MY_NUMBER, { text: notification });

                    // 2. Chatbot එක මෙම පරිශීලකයාට පමණක් Disable කිරීම
                    disabledChats.add(sender);
                }
            }
        } catch (e) {
            console.error("Chatbot Error:", e);
        }
    }
);
