const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// --- Ovnix AI System Prompt (භාෂා පාලනය සහ උපදෙස්) ---
const SYSTEM_PROMPT = `
Role: You are "Ovnix AI", the official assistant for Ovnix (Web Development Company in Sri Lanka).
STRICT RULE: Always respond in 100% SINHALA language ONLY.
Language Instruction: Even if the user talks to you in English, Singlish, or any other language, your reply MUST be in professional and friendly SINHALA.

Company Details:
- Services: Web Design, Full-stack Development, WhatsApp Bot Development.
- Pricing: Starting from Rs. 25,000 upwards.
- Tone: Professional, Helpful, and Courteous.

Instructions:
- If someone says "Hi" or "How are you", reply in Sinhala.
- If someone asks for services in English, explain them in Sinhala.
- If someone asks about prices, state that they start from 25,000 LKR in Sinhala.
`;

/**
 * AI API එකෙන් පිළිතුරු ලබා ගැනීම
 */
async function getOvnixAIResponse(userInput, pushname) {
    try {
        // AI එකට යවන Query එක - මෙහිදී ඕනෑම භාෂාවකට සිංහලෙන් පිළිතුරු දීමට බල කරයි
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
    desc: "Talk to Ovnix AI (English to Sinhala Support)",
    category: "ai",
    filename: __filename
},
async (conn, mek, m, { from, args, reply, pushname }) => {
    try {
        const text = args.join(" ");
        if (!text) return reply("කරුණාකර මොනවා හරි අසන්න. (උදා: .gemini Hello, how are you?) ");

        const result = await getOvnixAIResponse(text, pushname);
        if (!result) return reply("❌ සමාවන්න, පිළිතුරක් ලබා ගැනීමට නොහැකි විය.");

        // පිළිතුර පින්තූරයක්ද කියා බැලීම
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
// 2. AUTO CHATBOT (ඕනෑම මැසේජ් එකකට සිංහලෙන් පිළිතුරු දීමට)
// -------------------------------------------------------------------
cmd({ on: "body" },
    async (conn, mek, m, { from, body, isCmd, sender, pushname, reply }) => {
        try {
            // Chatbot ON ද කියා බැලීම (config.js හි CHAT_BOT: "true" විය යුතුය)
            if (config.CHAT_BOT !== "true" || m.fromMe || isCmd || !body) return;

            // AI පිළිතුර ලබා ගැනීම
            const aiResult = await getOvnixAIResponse(body, pushname);
            if (!aiResult) return;

            // පින්තූරයක්ද නැද්ද යන්න අනුව පිළිතුරු යැවීම
            if (aiResult.startsWith("http") && (aiResult.includes("googleusercontent") || aiResult.includes("image"))) {
                await conn.sendMessage(from, { image: { url: aiResult }, caption: "✨ Ovnix AI" }, { quoted: mek });
            } else {
                await reply(aiResult);
            }

        } catch (e) {
            console.error("Chatbot Error:", e);
        }
    }
);
