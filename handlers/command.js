const { bot } = require('../config/adminBot');
const { db } = require('../config/firebase');
const { mainKeyboard, backKeyboard } = require('../keyboards');
const { userState, resetUserState } = require('../state/userState');
const { showCategoryUpdateSelect } = require('../views/category');
const { showProductUpdateCategorySelect } = require('../views/product');

async function handleCommand(chatId, text) {
    resetUserState(chatId);
    if (!db) { bot.sendMessage(chatId, "❌ Database ulanmagan.", mainKeyboard); return; }

    if (text === "🛍 Mahsulot qo'shish") {
        const snapshot = await db.collection('categories').get();
        const categoryNames = snapshot.docs.map(d => d.data().name);
        if (categoryNames.length === 0) { bot.sendMessage(chatId, "Avval kategoriya qo'shing.", mainKeyboard); return; }
        userState[chatId] = { step: 'product_name', data: { categoryNames }, steps: [] };
        bot.sendMessage(chatId, "1/8. Mahsulot nomini kiriting:", backKeyboard);
        return;
    }
    if (text === "📂 Kategoriya qo'shish") {
        userState[chatId] = { step: 'category_name', data: {}, steps: [] };
        bot.sendMessage(chatId, "1/2. Kategoriya nomini kiriting:", backKeyboard);
        return;
    }
    if (text === "📂 Kategoriya yangilash") {
        userState[chatId] = { step: 'category_update_select', data: {}, steps: [] };
        await showCategoryUpdateSelect(chatId);
        return;
    }
    if (text === "🔄 Mahsulotni yangilash") {
        userState[chatId] = { step: 'product_update_category_select', data: {}, steps: [] };
        await showProductUpdateCategorySelect(chatId);
        return;
    }
    if (text === "👥 Mijoz qo'shish") {
        userState[chatId] = { step: 'customer_firstName', data: {}, steps: [] };
        bot.sendMessage(chatId, "1/5. Mijozning ismini kiriting:", backKeyboard);
        return;
    }
    if (text === "👥 Mijozlar ro'yxati") {
        try {
            const snapshot = await db.collection('customers').orderBy('createdAt', 'desc').limit(20).get();
            if (snapshot.empty) { bot.sendMessage(chatId, "Hali mijozlar yo'q.", mainKeyboard); return; }
            let msg = `👥 Mijozlar ro'yxati (oxirgi 20):\n\n`;
            snapshot.docs.forEach((doc, idx) => {
                const c = doc.data();
                const tgStatus = c.telegramId ? `✅ TG: ${c.telegramId}` : `⏳ Hali kirmagan`;
                msg += `${idx + 1}. ${c.firstName} ${c.lastName}\n`;
                msg += `   📞 ${c.phone}\n`;
                msg += `   🔑 Login: ${c.login} | Parol: ${c.password}\n`;
                msg += `   ${tgStatus}\n`;
                msg += `   📦 Buyurtmalar: ${c.totalOrders || 0} ta (bonus: ${c.ordersCount || 0}/3)\n\n`;
            });
            bot.sendMessage(chatId, msg, mainKeyboard);
        } catch (error) {
            console.error("Mijozlarni olishda xato:", error);
            bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
        }
        return;
    }
    if (text === "❌ Bekor qilish") {
        resetUserState(chatId);
        bot.sendMessage(chatId, "Bekor qilindi.", mainKeyboard);
        return;
    }
    if (text === "📊 Statistika") {
        try {
            const p = await db.collection('products').get();
            const c = await db.collection('categories').get();
            const o = await db.collection('orders').get();
            const cust = await db.collection('customers').get();
            bot.sendMessage(chatId,
                `📊 Statistika:\n` +
                `🔹 Mahsulotlar: ${p.size}\n` +
                `🔹 Kategoriyalar: ${c.size}\n` +
                `🔹 Buyurtmalar: ${o.size}\n` +
                `🔹 Mijozlar: ${cust.size}`,
                mainKeyboard
            );
        } catch (error) {
            bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
        }
        return;
    }
    if (text === "📦 Buyurtmalar") {
        try {
            const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').limit(10).get();
            if (snapshot.empty) { bot.sendMessage(chatId, "Buyurtmalar yo'q.", mainKeyboard); return; }
            const kb = { inline_keyboard: [] };
            snapshot.docs.forEach(doc => {
                const o = doc.data();
                let emoji = o.status === 'confirmed' ? "✅" : o.status === 'cancelled' ? "❌" : "🆕";
                const btn = `${emoji} ${o.customerName || 'Noma\'lum'} — ${(o.totalUZS || 0).toLocaleString("uz-UZ")} so'm`;
                kb.inline_keyboard.push([{ text: btn, callback_data: `order_detail_${doc.id}` }]);
            });
            bot.sendMessage(chatId, "So'nggi 10 ta buyurtma:", { reply_markup: kb });
        } catch (error) {
            bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
        }
        return;
    }
    bot.sendMessage(chatId, "Tugmalardan tanlang:", mainKeyboard);
}

module.exports = { handleCommand };
