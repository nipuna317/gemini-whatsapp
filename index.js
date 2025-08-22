require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require("node-fetch");

// Gemini AI setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const imageModel = genAI.getGenerativeModel({ model: "imagen-3.0" }); // image model

// Conversation memory
let chatHistory = [];

// WhatsApp client setup
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// QR Code for login
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

// Bot ready
client.on('ready', () => {
    console.log('✅ WhatsApp Gemini Bot is ready!');
});

// Handle incoming messages
client.on('message', async (message) => {
    const text = message.body.toLowerCase();
    console.log("📩 Received:", text);

    // --- Custom Commands ---
    if (text === '/help') {
        message.reply("📌 Commands:\n\n/joke - Get a joke\n/reset - Clear memory\n/image <prompt> - Generate an image\n/help - Show commands\n\nOtherwise, I’ll reply with Gemini 🤖");
        return;
    }

    if (text === '/joke') {
        message.reply("😂 Here's a joke: Why don’t programmers like nature? It has too many bugs!");
        return;
    }

    if (text === '/reset') {
        chatHistory = [];
        message.reply("🧹 Memory cleared! Let's start fresh.");
        return;
    }

    // --- Image Generation Command ---
    if (text.startsWith('/image ')) {
        const prompt = message.body.replace('/image ', '').trim();
        if (!prompt) {
            message.reply("⚠️ Please provide a description, e.g., `/image a cat flying in space`");
            return;
        }

        try {
            message.reply("🎨 Generating image... please wait!");

            const result = await imageModel.generateContent(prompt);
            const imageBase64 = result.response.candidates[0].content.parts[0].inlineData.data;

            const media = new MessageMedia("image/png", imageBase64, "gemini.png");
            await message.reply(media);

        } catch (err) {
            console.error("❌ Image Gen Error:", err);
            message.reply("😔 Failed to generate image.");
        }
        return;
    }

    // --- Gemini AI Reply (Text) ---
    try {
        chatHistory.push({ role: "user", parts: [{ text: message.body }] });

        const chat = model.startChat({ history: chatHistory });
        const result = await chat.sendMessage(message.body);
        const reply = result.response.text();

        chatHistory.push({ role: "model", parts: [{ text: reply }] });
        message.reply(reply);

    } catch (err) {
        console.error("❌ Gemini Error:", err);
        message.reply("😔 AI is not responding right now.");
    }
});

// Start bot
client.initialize();
