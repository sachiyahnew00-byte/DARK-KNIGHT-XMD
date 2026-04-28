const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// --- Ovnix AI System Prompt ---
const SYSTEM_PROMPT = `
Role: You are "Ovnix AI", the official assistant for Ovnix (Web Development Company in Sri Lanka).
STRICT RULE: Always respond in 100% SINHALA language ONLY.
Instruction: Even if the user talks to you in English, Singlish, or any other language, your reply MUST be in professional SINHALA.

Services: Web Design, Full-stack Development, WhatsApp Bot Development.
Pricing: Starting from Rs. 25,000 upwards.
Tone: Professional, Helpful, and Courteous.
`;

/**
 * AI API එකෙන් පිළිතුරු ලබා ගැනීම
 */
async function getOvnixAIResponse(userInput, pushname) {
    try {
        const query = `${SYSTEM_PROMPT}\n\nUser: ${pushname}\nMessage: ${userInput}\n(Important: Respond ONLY in Sinhala)`;
        const apiUrl = `https://d-ai-beige.vercel.app/api/gemini?q=${encodeURIComponent(query)}`;
        
        const response = await axios.get(apiUrl);
        if (response.data && response.data.success) {
            return response.data.result;
        }
        return null;
    } catch (e) {
        console.error("AI API Error:", e);
        return null;
    }
}

// -------------------------------------------------------------------
// 1. .gemini COMMAND (ප්‍රශ්න ඇසීමට)
// -------------------------------------------------------------------
cmd({
    pattern: "gemini",
    react: "🤖",
    desc: "Talk to Ovnix AI (English/Sinhala Support)",
    category: "ai",
    filename: __filename
},
async (conn, mek, m, { from, args, reply, pushname }) => {
    try {
        const text = args.join(" ");
        if (!text) return reply("කරුණාකර සිංහලෙන් හෝ ඉංග්‍රීසියෙන් ප්‍රශ්නයක් අසන්න.");

        const result = await getOvnixAIResponse(text, pushname);
        if (!result) return reply("❌ සමාවන්න, පිළිතුරක් ලබා ගැනීමට නොහැකි විය.");

        if (result.startsWith("http") && (result.includes("googleusercontent") || result.includes("image"))) {
            await conn.sendMessage(from, { image: { url: result }, caption: "✨ Ovnix AI" }, { quoted: mek });
        } else {
            await reply(result);
        }
    } catch (e) {
        console.error(e);
    }
});

// -------------------------------------------------------------------
// 2. AUTO CHATBOT (ස්වයංක්‍රීයව React කර පිළිතුරු දීමට)
// -------------------------------------------------------------------
cmd({ on: "body" },
    async (conn, mek, m, { from, body, isCmd, sender, pushname, reply }) => {
        try {
            // Chatbot ON ද කියා බැලීම
            if (config.CHAT_BOT !== "true" || m.fromMe || isCmd || !body) return;

            // 1. පණිවිඩයට Auto React කිරීම (🤖 Emoji එක භාවිතා කර ඇත)
            await conn.sendMessage(from, { 
                react: { 
                    text: "🤖", 
                    key: m.key 
                } 
            });

            // 2. AI පිළිතුර ලබා ගැනීම
            const aiResult = await getOvnixAIResponse(body, pushname);
            if (!aiResult) return;

            // 3. පිළිතුර පින්තූරයක්ද නැද්ද යන්න අනුව යැවීම
            if (aiResult.startsWith("http") && (aiResult.includes("googleusercontent") || aiResult.includes("image"))) {
                await conn.sendMessage(from, { 
                    image: { url: aiResult }, 
                    caption: "✨ Ovnix AI" 
                }, { quoted: mek });
            } else {
                await reply(aiResult);
            }

        } catch (e) {
            console.error("Chatbot Error:", e);
        }
    }
);
