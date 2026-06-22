const { bot } = require('../config/adminBot');
const { db } = require('../config/firebase');
const { mainKeyboard } = require('../keyboards');

async function showCategoryView(chatId, categoryId, messageId) {
    try {
        const doc = await db.collection('categories').doc(String(categoryId)).get();
        if (!doc.exists) {
            if (messageId) bot.editMessageText("Kategoriya topilmadi!", { chat_id: chatId, message_id: messageId });
            bot.sendMessage(chatId, "Bosh menyu.", mainKeyboard);
            return;
        }
        const categoryData = doc.data();
        const updateKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: `Nomi: ${categoryData.name}`, callback_data: `cat_update_name_${categoryId}` }],
                    [{ text: `Ikonka: ${categoryData.icon}`, callback_data: `cat_update_icon_${categoryId}` }],
                    [{ text: "🗑 Kategoriyani o'chirish", callback_data: `delete_category_${categoryId}` }],
                    [{ text: "⬅️ Orqaga", callback_data: 'back_to_prev' }],
                ],
            },
        };
        const message = `📝 Kategoriya: ${categoryData.icon} ${categoryData.name} (ID: ${categoryId})\nQaysi maydonni yangilashni xohlaysiz?`;
        if (messageId) {
            bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: updateKeyboard.reply_markup });
        } else {
            bot.sendMessage(chatId, message, updateKeyboard);
        }
    } catch (error) {
        console.error("Kategoriya view xato:", error);
    }
}

async function showCategoryUpdateSelect(chatId, messageId = null) {
    try {
        const snapshot = await db.collection('categories').get();
        if (snapshot.empty) {
            const text = "Hech qanday kategoriya topilmadi.";
            if (messageId) bot.editMessageText(text, { chat_id: chatId, message_id: messageId });
            bot.sendMessage(chatId, "Bosh menyu.", mainKeyboard);
            return;
        }
        const cats = snapshot.docs.map(d => { const x = d.data(); return { id: x.id, name: x.name, icon: x.icon }; });
        const kb = { reply_markup: { inline_keyboard: [] } };
        for (let i = 0; i < cats.length; i += 2) {
            const row = [{ text: `${cats[i].icon} ${cats[i].name}`, callback_data: `cat_select_${cats[i].id}` }];
            if (i + 1 < cats.length) row.push({ text: `${cats[i + 1].icon} ${cats[i + 1].name}`, callback_data: `cat_select_${cats[i + 1].id}` });
            kb.reply_markup.inline_keyboard.push(row);
        }
        const text = "Qaysi kategoriyani yangilashni xohlaysiz?";
        if (messageId) bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: kb.reply_markup });
        else bot.sendMessage(chatId, text, kb);
    } catch (error) {
        console.error("Kategoriyalarni olishda xato:", error);
    }
}

module.exports = { showCategoryView, showCategoryUpdateSelect };
