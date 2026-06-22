const TelegramBot = require('node-telegram-bot-api');

const USER_BOT_TOKEN = process.env.USER_BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://spiffy-dusk-9fbdd8.netlify.app/';

function startUserBot() {
    if (!USER_BOT_TOKEN) {
        console.warn("⚠️ USER_BOT_TOKEN topilmadi — user bot ishlamaydi.");
        return;
    }

    const userBot = new TelegramBot(USER_BOT_TOKEN, { polling: true });
    console.log("✅ User bot ishga tushdi...");

    userBot.on('polling_error', (error) => {
        console.error("User bot polling xatosi:", error.message);
    });

    userBot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const firstName = msg.from.first_name || 'mijoz';
        const welcomeMessage =
            `Salom, ${firstName}! 👋\n\n` +
            `🚗 *Nanokill* botiga xush kelibsiz!\n\n` +
            `Sifatli avtomobil ehtiyot qismlari va tezkor yetkazib berish.\n\n` +
            `Do'kondan foydalanish uchun pastdagi tugmani bosing 👇`;
        const inlineKeyboard = {
            inline_keyboard: [[{ text: "🛍 Ilovani ochish", web_app: { url: MINI_APP_URL } }]],
        };
        userBot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown', reply_markup: inlineKeyboard })
            .catch(err => console.error("User botga xabar yuborishda xato:", err.message));
    });
}

module.exports = { startUserBot };
