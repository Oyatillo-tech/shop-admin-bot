const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: "🛍 Mahsulot qo'shish" }, { text: "📂 Kategoriya qo'shish" }],
            [{ text: "📂 Kategoriya yangilash" }, { text: "🔄 Mahsulotni yangilash" }],
            [{ text: "👥 Mijoz qo'shish" }, { text: "👥 Mijozlar ro'yxati" }],
            [{ text: "📊 Statistika" }, { text: "📦 Buyurtmalar" }],
            [{ text: "❌ Bekor qilish" }],
        ],
        resize_keyboard: true,
    },
};

const backKeyboard = {
    reply_markup: { keyboard: [["Orqaga"]], resize_keyboard: true },
};

const mainBackKeyboard = {
    reply_markup: {
        keyboard: [
            ...mainKeyboard.reply_markup.keyboard.slice(0, -1),
            [{ text: "❌ Bekor qilish" }, { text: "Orqaga" }],
        ],
        resize_keyboard: true,
    },
};

const commandButtons = [
    "🛍 Mahsulot qo'shish", "📂 Kategoriya qo'shish", "📂 Kategoriya yangilash",
    "🔄 Mahsulotni yangilash", "👥 Mijoz qo'shish", "👥 Mijozlar ro'yxati",
    "📊 Statistika", "📦 Buyurtmalar", "❌ Bekor qilish",
];

module.exports = { mainKeyboard, backKeyboard, mainBackKeyboard, commandButtons };
