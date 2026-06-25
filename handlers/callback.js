const { bot, admins } = require('../config/adminBot');
const { db } = require('../config/firebase');
const { mainKeyboard, backKeyboard } = require('../keyboards');
const { userState } = require('../state/userState');
const { handleInlineBack } = require('./back');
const { showCategoryView, showCategoryUpdateSelect } = require('../views/category');
const { showProductView, showProductUpdateCategorySelect, showProductsInCategory, getProductsInCategory } = require('../views/product');
const { BONUS_DISCOUNT_PERCENT } = require('../config/constants');

function registerCallbackHandler() {
    bot.on('callback_query', async (cq) => {
        const chatId = cq.message.chat.id;
        const messageId = cq.message.message_id;
        const data = cq.data;
        if (!data || !admins.includes(chatId)) { bot.answerCallbackQuery(cq.id, { text: "Ruxsat yo'q!" }); return; }
        if (!db) { bot.answerCallbackQuery(cq.id, { text: "Database yo'q." }); return; }

        if (data.startsWith('order_detail_')) {
            const orderId = data.replace('order_detail_', '');
            try {
                const doc = await db.collection('orders').doc(orderId).get();
                if (!doc.exists) { bot.answerCallbackQuery(cq.id, { text: "Topilmadi!" }); return; }
                const o = doc.data();
                const itemsText = o.items?.map(item => `- ${item.quantity} x ${item.name} — ${(item.price * item.quantity).toLocaleString("uz-UZ")} so'm`).join('\n') || "Mahsulot yo'q";
                const bonusText = o.orderType === 'discount' ? `🎁 ${BONUS_DISCOUNT_PERCENT}% chegirma\n` : o.orderType === 'bonus' ? `🎁 1+1 bonus\n` : '';
                const statusEmoji = o.status === 'confirmed' ? "✅" : o.status === 'cancelled' ? "❌" : "🆕";
                const statusText = o.status === 'confirmed' ? "Tasdiqlangan" : o.status === 'cancelled' ? "Bekor qilingan" : "Yangi";
                const msg = `📋 BUYURTMA\n\n🆔 ${orderId}\n👤 ${o.customerName}\n📞 ${o.customerPhone}\n${bonusText}\n🛍 Mahsulotlar:\n${itemsText}\n\n💰 Jami: ${(o.totalUZS || 0).toLocaleString("uz-UZ")} so'm\n📊 Status: ${statusEmoji} ${statusText}`;
                const kb = { inline_keyboard: [] };
                if (o.status === 'new') kb.inline_keyboard.push([{ text: "✅ Tasdiqlash", callback_data: `confirm_order_${orderId}` }, { text: "❌ Bekor", callback_data: `cancel_order_${orderId}` }]);
                kb.inline_keyboard.push([{ text: "⬅️ Orqaga", callback_data: "back_to_orders" }]);
                bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, reply_markup: kb });
                bot.answerCallbackQuery(cq.id);
            } catch (error) { bot.answerCallbackQuery(cq.id, { text: "Xato!" }); }
            return;
        }

        if (data === 'back_to_orders') {
            try {
                const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').limit(10).get();
                if (snapshot.empty) { bot.editMessageText("Buyurtmalar yo'q.", { chat_id: chatId, message_id: messageId }); bot.answerCallbackQuery(cq.id); return; }
                const kb = { inline_keyboard: [] };
                snapshot.docs.forEach(d => {
                    const o = d.data();
                    const emoji = o.status === 'confirmed' ? "✅" : o.status === 'cancelled' ? "❌" : "🆕";
                    kb.inline_keyboard.push([{ text: `${emoji} ${o.customerName || 'Noma\'lum'} — ${(o.totalUZS || 0).toLocaleString("uz-UZ")} so'm`, callback_data: `order_detail_${d.id}` }]);
                });
                bot.editMessageText("So'nggi 10 ta buyurtma:", { chat_id: chatId, message_id: messageId, reply_markup: kb });
                bot.answerCallbackQuery(cq.id);
            } catch (error) { bot.answerCallbackQuery(cq.id, { text: "Xato!" }); }
            return;
        }

        if (data.startsWith('confirm_order_') || data.startsWith('cancel_order_')) {
            const isConfirm = data.startsWith('confirm_order_');
            const orderId = isConfirm ? data.replace('confirm_order_', '') : data.replace('cancel_order_', '');
            try {
                const orderRef = db.collection('orders').doc(orderId);
                const doc = await orderRef.get();
                if (!doc.exists) { bot.answerCallbackQuery(cq.id, { text: "Topilmadi!" }); return; }
                const orderData = doc.data();
                if (orderData.status !== 'new') { bot.answerCallbackQuery(cq.id, { text: `Allaqachon ${orderData.status}!` }); return; }
                await orderRef.update({ status: isConfirm ? 'confirmed' : 'cancelled' });
                if (isConfirm && orderData.customerTelegramId) {
                    const customerRef = db.collection('customers').doc(String(orderData.customerTelegramId));
                    const customerDoc = await customerRef.get();
                    if (customerDoc.exists) {
                        const c = customerDoc.data();
                        const currentCount = c.ordersCount || 0;
                        const newCount = currentCount >= 2 ? 0 : currentCount + 1;
                        await customerRef.update({ ordersCount: newCount, totalOrders: (c.totalOrders || 0) + 1 });
                        console.log(`✅ Mijoz ${orderData.customerTelegramId}: ordersCount ${currentCount} → ${newCount}`);
                    }
                }
                const adminName = cq.from.first_name || "Admin";
                const statusText = isConfirm ? `✅ Tasdiqlandi — ${adminName}` : `❌ Bekor qilindi — ${adminName}`;
                bot.editMessageText(`${cq.message.text}\n\n=================\n${statusText}`, { chat_id: chatId, message_id: messageId });
                bot.answerCallbackQuery(cq.id, { text: isConfirm ? "Tasdiqlandi" : "Bekor qilindi" });
                admins.forEach(aId => {
                    if (aId !== chatId) bot.sendMessage(aId, `Buyurtma ${orderId} ${isConfirm ? 'tasdiqlandi' : 'bekor'} → ${adminName}`);
                });
            } catch (error) {
                console.error("Buyurtma xato:", error);
                bot.answerCallbackQuery(cq.id, { text: "Xato!" });
            }
            return;
        }

        if (data === 'back_to_prev') { await handleInlineBack(chatId, messageId); bot.answerCallbackQuery(cq.id); return; }

        if (data.startsWith('cat_select_')) {
            const id = parseInt(data.replace('cat_select_', ''));
            const state = userState[chatId] || { step: 'none', data: {}, steps: [] };
            state.steps.push(state.step); state.step = 'category_update_view';
            state.data.categoryId = id; state.data.messageId = messageId;
            userState[chatId] = state;
            await showCategoryView(chatId, id, messageId);
            bot.answerCallbackQuery(cq.id); return;
        }
        if (data.startsWith('cat_update_name_')) {
            const id = parseInt(data.replace('cat_update_name_', ''));
            const state = userState[chatId] || { step: 'none', data: {}, steps: [] };
            userState[chatId] = { step: 'update_category_name', data: { categoryId: id, messageId }, steps: state.steps || [] };
            bot.sendMessage(chatId, 'Yangi nomni kiriting:', backKeyboard);
            bot.answerCallbackQuery(cq.id); return;
        }
        if (data.startsWith('cat_update_icon_')) {
            const id = parseInt(data.replace('cat_update_icon_', ''));
            const state = userState[chatId] || { step: 'none', data: {}, steps: [] };
            userState[chatId] = { step: 'update_category_icon', data: { categoryId: id, messageId }, steps: state.steps || [] };
            bot.sendMessage(chatId, 'Yangi ikonkani kiriting:', backKeyboard);
            bot.answerCallbackQuery(cq.id); return;
        }
        if (data.startsWith('delete_category_')) {
            const id = parseInt(data.replace('delete_category_', ''));
            try {
                const doc = await db.collection('categories').doc(String(id)).get();
                if (!doc.exists) { bot.answerCallbackQuery(cq.id, { text: "Topilmadi!" }); return; }
                const cat = doc.data();
                const count = await getProductsInCategory(cat.name);
                if (count === 0) {
                    await db.collection('categories').doc(String(id)).delete();
                    bot.editMessageText(`✅ "${cat.name}" o'chirildi.`, { chat_id: chatId, message_id: messageId });
                } else {
                    bot.editMessageText(`⚠️ "${cat.name}" ichida ${count} ta mahsulot bor. Avval ularni boshqa kategoriyaga o'tkazing yoki o'chiring.`, { chat_id: chatId, message_id: messageId });
                }
                bot.answerCallbackQuery(cq.id);
            } catch (error) { bot.answerCallbackQuery(cq.id, { text: "Xato!" }); }
            return;
        }
        if (data.startsWith('select_category_')) {
            const id = parseInt(data.replace('select_category_', ''));
            try {
                const doc = await db.collection('categories').doc(String(id)).get();
                if (!doc.exists) { bot.answerCallbackQuery(cq.id, { text: "Topilmadi!" }); return; }
                const cat = doc.data();
                const state = userState[chatId] || { step: 'none', data: {}, steps: [] };
                state.steps.push(state.step); state.step = 'product_update_product_select';
                state.data.selectedCategory = cat.name; state.data.messageId = messageId;
                userState[chatId] = state;
                await showProductsInCategory(chatId, cat.name, messageId);
                bot.answerCallbackQuery(cq.id);
            } catch (error) { bot.answerCallbackQuery(cq.id, { text: "Xato!" }); }
            return;
        }
        if (data.startsWith('update_product_')) {
            const id = parseInt(data.replace('update_product_', ''));
            try {
                const doc = await db.collection('products').doc(String(id)).get();
                if (!doc.exists) { bot.answerCallbackQuery(cq.id, { text: "Topilmadi!" }); return; }
                const state = userState[chatId] || { step: 'none', data: {}, steps: [] };
                state.steps.push(state.step); state.step = 'product_update_view';
                state.data.productId = id; state.data.messageId = messageId;
                userState[chatId] = state;
                await showProductView(chatId, id, messageId);
                bot.answerCallbackQuery(cq.id);
            } catch (error) { bot.answerCallbackQuery(cq.id, { text: "Xato!" }); }
            return;
        }

        if (data.startsWith('update_field_')) {
            if (data.startsWith('update_field_discountStart_') || data.startsWith('update_field_discountEnd_')) {
                const isStart = data.startsWith('update_field_discountStart_');
                const id = parseInt(isStart ? data.replace('update_field_discountStart_', '') : data.replace('update_field_discountEnd_', ''));
                const fieldName = isStart ? 'discountStartDate' : 'discountEndDate';
                const fieldLabel = isStart ? 'Chegirma boshlanish sanasi' : 'Chegirma tugash sanasi';
                const cur = userState[chatId] || { step: 'none', data: {}, steps: [] };
                userState[chatId] = { step: 'update_discount_date', data: { productId: id, dateField: fieldName, dateLabel: fieldLabel, selectedCategory: cur.data.selectedCategory, messageId }, steps: cur.steps || [] };
                bot.sendMessage(chatId, `${fieldLabel}ni kiriting:\nFormat: DD.MM.YYYY (mas: 13.05.2026)\nO'chirish uchun: 0`, backKeyboard);
                bot.answerCallbackQuery(cq.id); return;
            }
            const parts = data.split('_');
            const fieldType = parts[2];
            const id = parseInt(parts[3]);
            const cur = userState[chatId] || { step: 'none', data: {}, steps: [] };
            const preserve = { selectedCategory: cur.data.selectedCategory, messageId };
            if (fieldType === 'name') {
                userState[chatId] = { step: 'update_product_name', data: { productId: id, ...preserve }, steps: cur.steps || [] };
                bot.sendMessage(chatId, 'Yangi nomni kiriting:', backKeyboard);
            } else if (fieldType === 'description') {
                userState[chatId] = { step: 'update_product_description', data: { productId: id, ...preserve }, steps: cur.steps || [] };
                bot.sendMessage(chatId, 'Yangi tavsifni kiriting:', backKeyboard);
            } else if (fieldType === 'image') {
                userState[chatId] = { step: 'update_product_image', data: { productId: id, ...preserve }, steps: cur.steps || [] };
                const { mainBackKeyboard } = require('../keyboards');
                bot.sendMessage(chatId, 'Yangi rasm yuboring:', mainBackKeyboard);
            } else {
                userState[chatId] = { step: 'update_value', data: { productId: id, field: fieldType, ...preserve }, steps: cur.steps || [] };
                const labelMap = { price: "Narx (so'm)", discount: 'Chegirma (%)', stock: 'Stock' };
                bot.sendMessage(chatId, `${labelMap[fieldType] || fieldType} uchun yangi qiymatni yuboring:`, backKeyboard);
            }
            bot.answerCallbackQuery(cq.id); return;
        }

        if (data.startsWith('delete_product_')) {
            const id = parseInt(data.replace('delete_product_', ''));
            try {
                const doc = await db.collection('products').doc(String(id)).get();
                if (!doc.exists) { bot.answerCallbackQuery(cq.id, { text: "Topilmadi!" }); return; }
                const p = doc.data();
                await db.collection('products').doc(String(id)).delete();
                bot.editMessageText(`✅ "${p.name}" o'chirildi.`, { chat_id: chatId, message_id: messageId });
                bot.answerCallbackQuery(cq.id);
            } catch (error) { bot.answerCallbackQuery(cq.id, { text: "Xato!" }); }
            return;
        }
    });
}

module.exports = { registerCallbackHandler };
