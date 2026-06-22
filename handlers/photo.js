const { bot, admins } = require('../config/adminBot');
const { db } = require('../config/firebase');
const { backKeyboard } = require('../keyboards');
const { userState } = require('../state/userState');
const { uploadToImgBB } = require('../utils/imgbb');
const { showProductView } = require('../views/product');

function registerPhotoHandler() {
    bot.on('photo', async (msg) => {
        const chatId = msg.chat.id;
        if (!admins.includes(chatId)) return;
        if (!db) return;
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const state = userState[chatId];
        if (state && (state.step === 'product_image' || state.step === 'update_product_image')) {
            const waitMsg = await bot.sendMessage(chatId, "Rasm yuklanmoqda... ⏳");
            const imageUrl = await uploadToImgBB(fileId);
            if (imageUrl) {
                state.data.image = imageUrl;
                if (state.step === 'product_image') {
                    state.steps.push(state.step);
                    state.step = 'product_description';
                    bot.editMessageText("✅ Rasm yuklandi!\n6/8. Tavsifni kiriting:", { chat_id: chatId, message_id: waitMsg.message_id });
                    bot.sendMessage(chatId, "Tavsif:", backKeyboard);
                } else {
                    try {
                        await db.collection('products').doc(String(state.data.productId)).update({ image: imageUrl });
                        state.step = 'product_update_view';
                        await showProductView(chatId, state.data.productId, state.data.messageId);
                        bot.editMessageText("✅ Rasm yangilandi!", { chat_id: chatId, message_id: waitMsg.message_id });
                        bot.sendMessage(chatId, "Davom eting.", backKeyboard);
                    } catch (error) {
                        bot.editMessageText("❌ Xato!", { chat_id: chatId, message_id: waitMsg.message_id });
                    }
                }
            } else {
                bot.editMessageText("❌ Rasm yuklashda xato!", { chat_id: chatId, message_id: waitMsg.message_id });
            }
        } else {
            const { mainKeyboard } = require('../keyboards');
            bot.sendMessage(chatId, "Rasm kutilmayapti.", mainKeyboard);
        }
    });
}

module.exports = { registerPhotoHandler };
