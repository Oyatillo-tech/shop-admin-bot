const { bot } = require('../config/adminBot');
const { db } = require('../config/firebase');
const { mainKeyboard } = require('../keyboards');
const { formatTimestamp } = require('../utils/helpers');
const { userState, resetUserState } = require('../state/userState');

async function showProductView(chatId, productId, messageId) {
    try {
        const doc = await db.collection('products').doc(String(productId)).get();
        if (!doc.exists) {
            if (messageId) bot.editMessageText("Mahsulot topilmadi!", { chat_id: chatId, message_id: messageId });
            return;
        }
        const p = doc.data();
        const startDateText = formatTimestamp(p.discountStartDate);
        const endDateText = formatTimestamp(p.discountEndDate);
        const updateKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: `Nomi: ${p.name}`, callback_data: `update_field_name_${productId}` }],
                    [{ text: `Narx: ${(p.price || 0).toLocaleString('uz-UZ')} so'm`, callback_data: `update_field_price_${productId}` }],
                    [{ text: `Chegirma: ${p.discount || 0}%`, callback_data: `update_field_discount_${productId}` }],
                    [{ text: `📅 Chegirma boshlanishi: ${startDateText}`, callback_data: `update_field_discountStart_${productId}` }],
                    [{ text: `📅 Chegirma tugashi: ${endDateText}`, callback_data: `update_field_discountEnd_${productId}` }],
                    [{ text: `Stock: ${(p.stock || 0).toLocaleString()} dona`, callback_data: `update_field_stock_${productId}` }],
                    [{ text: `Tavsif: ${p.description ? p.description.substring(0, 20) + '...' : 'Yo\'q'}`, callback_data: `update_field_description_${productId}` }],
                    [{ text: `Rasm: ${p.image ? 'Bor' : 'Yo\'q'}`, callback_data: `update_field_image_${productId}` }],
                    [{ text: "🗑 Mahsulotni o'chirish", callback_data: `delete_product_${productId}` }],
                    [{ text: "⬅️ Orqaga", callback_data: 'back_to_prev' }],
                ],
            },
        };
        const message =
            `📝 Mahsulot: ${p.name} (ID: ${productId})\n` +
            `• Narx: ${(p.price || 0).toLocaleString('uz-UZ')} so'm\n` +
            `• Chegirma: ${p.discount || 0}%\n` +
            `• Chegirma boshlanishi: ${startDateText}\n` +
            `• Chegirma tugashi: ${endDateText}\n` +
            `• Stock: ${(p.stock || 0).toLocaleString()} dona\n` +
            `• Kategoriya: ${p.category}\n` +
            `• Tavsif: ${p.description || 'Belgilanmagan'}\n` +
            `• Rasm: ${p.image ? 'URL mavjud' : 'Yo\'q'}\n` +
            `Qaysi maydonni yangilashni xohlaysiz?`;
        if (messageId) {
            bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: updateKeyboard.reply_markup });
        } else {
            bot.sendMessage(chatId, message, updateKeyboard);
        }
    } catch (error) {
        console.error("Mahsulot view xato:", error);
    }
}

async function showProductUpdateCategorySelect(chatId, messageId = null) {
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
            const row = [{ text: `${cats[i].icon} ${cats[i].name}`, callback_data: `select_category_${cats[i].id}` }];
            if (i + 1 < cats.length) row.push({ text: `${cats[i + 1].icon} ${cats[i + 1].name}`, callback_data: `select_category_${cats[i + 1].id}` });
            kb.reply_markup.inline_keyboard.push(row);
        }
        const text = "Qaysi kategoriyadagi mahsulotni yangilashni xohlaysiz?";
        if (messageId) bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: kb.reply_markup });
        else bot.sendMessage(chatId, text, kb);
    } catch (error) {
        console.error("Xato:", error);
    }
}

async function showProductsInCategory(chatId, categoryName, messageId = null) {
    try {
        const snapshot = await db.collection('products').where('category', '==', categoryName).get();
        if (snapshot.empty) {
            const text = `"${categoryName}" kategoriyasida mahsulot yo'q.`;
            if (messageId) bot.editMessageText(text, { chat_id: chatId, message_id: messageId });
            bot.sendMessage(chatId, text, mainKeyboard);
            resetUserState(chatId);
            return;
        }
        const products = snapshot.docs.map(d => { const x = d.data(); return { id: x.id, name: x.name }; });
        const kb = { reply_markup: { inline_keyboard: [] } };
        for (let i = 0; i < products.length; i += 2) {
            const row = [{ text: products[i].name, callback_data: `update_product_${products[i].id}` }];
            if (i + 1 < products.length) row.push({ text: products[i + 1].name, callback_data: `update_product_${products[i + 1].id}` });
            kb.reply_markup.inline_keyboard.push(row);
        }
        kb.reply_markup.inline_keyboard.push([{ text: "⬅️ Orqaga", callback_data: 'back_to_prev' }]);
        const text = `"${categoryName}" kategoriyasidagi mahsulotlar:`;
        if (messageId) bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: kb.reply_markup });
        else bot.sendMessage(chatId, text, kb);
        const state = userState[chatId];
        if (state) state.data.selectedCategory = categoryName;
    } catch (error) {
        console.error("Xato:", error);
    }
}

async function getProductsInCategory(categoryName) {
    if (!db) return 0;
    try {
        const snapshot = await db.collection('products').where('category', '==', categoryName).get();
        return snapshot.size;
    } catch (error) {
        return 0;
    }
}

module.exports = { showProductView, showProductUpdateCategorySelect, showProductsInCategory, getProductsInCategory };
