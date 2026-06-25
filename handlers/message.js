const { bot, admins } = require('../config/adminBot');
const { db, admin } = require('../config/firebase');
const { mainKeyboard, backKeyboard, mainBackKeyboard, commandButtons } = require('../keyboards');
const { userState, resetUserState } = require('../state/userState');
const { parseNumberInput, parseDateDDMMYYYY, getNextId } = require('../utils/helpers');
const { handleBack } = require('./back');
const { handleCommand } = require('./command');
const { showProductView } = require('../views/product');
const { showCategoryView } = require('../views/category');

function registerMessageHandler() {
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;
        const photo = msg.photo;

        if (!admins.includes(chatId)) {
            bot.sendMessage(chatId, `Bu bot faqat administratorlar uchun.\nSizning ID: ${chatId}`);
            return;
        }
        if (!db) { bot.sendMessage(chatId, "❌ Database ulanmagan."); return; }
        if (text && text.startsWith('/')) {
            if (text === '/start') {
                resetUserState(chatId);
                bot.sendMessage(chatId, "Xush kelibsiz! Shop-bot admin paneli.", mainKeyboard);
            } else bot.sendMessage(chatId, "Noma'lum buyruq. /start ni bosing.", mainKeyboard);
            return;
        }
        if (text === "Orqaga") { await handleBack(chatId); return; }
        if (text && commandButtons.includes(text)) { await handleCommand(chatId, text); return; }
        if (photo && !text) { bot.emit('photo', msg); return; }
        if (!userState[chatId] || userState[chatId].step === 'none') {
            bot.sendMessage(chatId, "Tugmalardan tanlang:", mainKeyboard);
            return;
        }

        const state = userState[chatId];
        const step = state.step;
        let data = state.data;

        // MAHSULOT QO'SHISH
        if (step.startsWith('product_')) {
            const oldStep = step;
            switch (step) {
                case 'product_name':
                    data.name = text;
                    state.steps.push(oldStep);
                    state.step = 'product_price';
                    bot.sendMessage(chatId, "2/8. Narxni so'mda kiriting (mas: 250000):", backKeyboard);
                    break;
                case 'product_price': {
                    const price = parseNumberInput(text);
                    if (price === null || price <= 0) { bot.sendMessage(chatId, "Musbat son kiriting!"); return; }
                    data.price = Math.floor(price);
                    state.steps.push(oldStep);
                    state.step = 'product_discount';
                    bot.sendMessage(chatId, "3/8. Chegirma (0-100, mas: 10 yoki 0):", backKeyboard);
                    break;
                }
                case 'product_discount': {
                    if (!/^\d+$/.test(text) || parseInt(text) < 0 || parseInt(text) > 100) {
                        bot.sendMessage(chatId, "0 dan 100 gacha son kiriting!");
                        return;
                    }
                    data.discount = parseInt(text);
                    state.steps.push(oldStep);
                    state.step = 'product_category';
                    const ckb = {
                        reply_markup: {
                            keyboard: data.categoryNames.map(n => [{ text: n }]).concat([["Orqaga"]]),
                            resize_keyboard: true,
                            one_time_keyboard: true,
                        },
                    };
                    bot.sendMessage(chatId, "4/8. Kategoriyani tanlang:", ckb);
                    break;
                }
                case 'product_category':
                    if (!data.categoryNames.includes(text)) { bot.sendMessage(chatId, "Tugmalardan tanlang!"); return; }
                    data.category = text;
                    state.steps.push(oldStep);
                    state.step = 'product_image';
                    bot.sendMessage(chatId, "5/8. Rasm yuboring (photo formatida):", mainBackKeyboard);
                    break;
                case 'product_image':
                    return;
                case 'product_description':
                    data.description = text;
                    state.steps.push(oldStep);
                    state.step = 'product_stock';
                    bot.sendMessage(chatId, "7/8. Ombordagi miqdor (mas: 50):", backKeyboard);
                    break;
                case 'product_stock': {
                    if (!/^\d+$/.test(text) || parseInt(text) < 0) { bot.sendMessage(chatId, "0 yoki musbat son!"); return; }
                    data.stock = parseInt(text);
                    const newId = await getNextId('products');
                    if (newId === -1) { bot.sendMessage(chatId, "❌ ID xato!", mainKeyboard); resetUserState(chatId); return; }
                    const newProduct = {
                        id: newId, name: data.name, price: data.price,
                        discount: data.discount || 0, category: data.category,
                        image: data.image, description: data.description, stock: data.stock,
                    };
                    try {
                        await db.collection('products').doc(String(newId)).set(newProduct);
                        bot.sendMessage(chatId,
                            `✅ Mahsulot qo'shildi!\n\n` +
                            `📦 ${newProduct.name}\n` +
                            `💰 ${newProduct.price.toLocaleString('uz-UZ')} so'm\n` +
                            `🏷 Chegirma: ${newProduct.discount}%\n` +
                            `📂 ${newProduct.category}\n` +
                            `📊 Stock: ${newProduct.stock} ta\n\n` +
                            `Chegirma sanalari qo'shish uchun "Mahsulotni yangilash" → ushbu mahsulot → "Chegirma boshlanishi/tugashi" tugmalarini ishlating.`,
                            mainKeyboard
                        );
                    } catch (error) {
                        console.error("Saqlashda xato:", error);
                        bot.sendMessage(chatId, "❌ Saqlashda xato!", mainKeyboard);
                    }
                    resetUserState(chatId);
                    break;
                }
            }
            state.data = data;
            return;
        }

        // KATEGORIYA QO'SHISH
        if (step.startsWith('category_')) {
            const oldStep = step;
            if (step === 'category_name') {
                data.name = text;
                state.steps.push(oldStep);
                state.step = 'category_icon';
                bot.sendMessage(chatId, "2/2. Ikonka (emoji, mas: 🔧):", backKeyboard);
            } else if (step === 'category_icon') {
                data.icon = text;
                const newId = await getNextId('categories');
                if (newId === -1) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); return; }
                try {
                    await db.collection('categories').doc(String(newId)).set({ id: newId, name: data.name, icon: data.icon });
                    bot.sendMessage(chatId, `✅ Kategoriya qo'shildi!\n${data.icon} ${data.name}`, mainKeyboard);
                } catch (error) {
                    bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
                }
                resetUserState(chatId);
            }
            state.data = data;
            return;
        }

        // KATEGORIYA YANGILASH
        if (state.step === 'update_category_name') {
            try {
                await db.collection('categories').doc(String(state.data.categoryId)).update({ name: text });
                state.step = 'category_update_view';
                await showCategoryView(chatId, state.data.categoryId, state.data.messageId);
                bot.sendMessage(chatId, `✅ Nom yangilandi: ${text}`, backKeyboard);
            } catch (error) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); }
            return;
        }
        if (state.step === 'update_category_icon') {
            try {
                await db.collection('categories').doc(String(state.data.categoryId)).update({ icon: text });
                state.step = 'category_update_view';
                await showCategoryView(chatId, state.data.categoryId, state.data.messageId);
                bot.sendMessage(chatId, `✅ Ikonka yangilandi: ${text}`, backKeyboard);
            } catch (error) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); }
            return;
        }

        // CHEGIRMA SANASI
        if (state.step === 'update_discount_date') {
            const stateData = state.data;
            if (text === "0") {
                try {
                    await db.collection('products').doc(String(stateData.productId)).update({ [stateData.dateField]: admin.firestore.FieldValue.delete() });
                    state.step = 'product_update_view';
                    await showProductView(chatId, stateData.productId, stateData.messageId);
                    bot.sendMessage(chatId, `✅ ${stateData.dateLabel} o'chirildi.`, backKeyboard);
                } catch (error) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); }
                return;
            }
            const dateObj = parseDateDDMMYYYY(text);
            if (!dateObj) { bot.sendMessage(chatId, "❌ Format: DD.MM.YYYY (mas: 13.05.2026)\nO'chirish uchun: 0"); return; }
            try {
                const timestamp = admin.firestore.Timestamp.fromDate(dateObj);
                await db.collection('products').doc(String(stateData.productId)).update({ [stateData.dateField]: timestamp });
                state.step = 'product_update_view';
                await showProductView(chatId, stateData.productId, stateData.messageId);
                bot.sendMessage(chatId, `✅ ${stateData.dateLabel} yangilandi: ${text}`, backKeyboard);
            } catch (error) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); }
            return;
        }

        // MAHSULOT YANGILASH - VALUE
        if (state.step === 'update_value') {
            const stateData = state.data;
            const fieldType = stateData.field;
            let value;
            if (fieldType === 'price') {
                const parsed = parseNumberInput(text);
                if (parsed === null || parsed <= 0) { bot.sendMessage(chatId, "Musbat son kiriting!"); return; }
                value = Math.floor(parsed);
            } else if (fieldType === 'discount') {
                if (!/^\d+$/.test(text) || parseInt(text) < 0 || parseInt(text) > 100) { bot.sendMessage(chatId, "0-100 oralig'ida!"); return; }
                value = parseInt(text);
            } else if (fieldType === 'stock') {
                if (!/^\d+$/.test(text) || parseInt(text) < 0) { bot.sendMessage(chatId, "0 yoki musbat son!"); return; }
                value = parseInt(text);
            } else { bot.sendMessage(chatId, "Xato!"); resetUserState(chatId); return; }
            try {
                await db.collection('products').doc(String(stateData.productId)).update({ [fieldType]: value });
                state.step = 'product_update_view';
                await showProductView(chatId, stateData.productId, stateData.messageId);
                bot.sendMessage(chatId, `✅ Yangilandi: ${value}`, backKeyboard);
            } catch (error) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); }
            return;
        }
        if (state.step === 'update_product_description') {
            try {
                await db.collection('products').doc(String(state.data.productId)).update({ description: text });
                state.step = 'product_update_view';
                await showProductView(chatId, state.data.productId, state.data.messageId);
                bot.sendMessage(chatId, `✅ Tavsif yangilandi`, backKeyboard);
            } catch (error) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); }
            return;
        }
        if (state.step === 'update_product_name') {
            try {
                await db.collection('products').doc(String(state.data.productId)).update({ name: text });
                state.step = 'product_update_view';
                await showProductView(chatId, state.data.productId, state.data.messageId);
                bot.sendMessage(chatId, `✅ Nom yangilandi: ${text}`, backKeyboard);
            } catch (error) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); }
            return;
        }

        // MIJOZ QO'SHISH
        if (step.startsWith('customer_')) {
            const oldStep = step;
            switch (step) {
                case 'customer_firstName':
                    if (!text || text.length < 2) { bot.sendMessage(chatId, "Ism kamida 2 belgi bo'lsin!"); return; }
                    data.firstName = text.trim();
                    state.steps.push(oldStep);
                    state.step = 'customer_lastName';
                    bot.sendMessage(chatId, "2/5. Familiyasini kiriting:", backKeyboard);
                    break;
                case 'customer_lastName':
                    if (!text || text.length < 2) { bot.sendMessage(chatId, "Familiya kamida 2 belgi bo'lsin!"); return; }
                    data.lastName = text.trim();
                    state.steps.push(oldStep);
                    state.step = 'customer_phone';
                    bot.sendMessage(chatId, "3/5. Telefon raqamini kiriting (mas: +998901234567):", backKeyboard);
                    break;
                case 'customer_phone': {
                    const phoneRegex = /^\+?\d{9,15}$/;
                    if (!phoneRegex.test(text.replace(/\s/g, ''))) { bot.sendMessage(chatId, "❌ Telefon noto'g'ri! Format: +998901234567"); return; }
                    data.phone = text.replace(/\s/g, '');
                    state.steps.push(oldStep);
                    state.step = 'customer_login';
                    bot.sendMessage(chatId, "4/5. Login yarating (mas: jonibek_123, faqat lotin harflar/raqamlar/_, kamida 3 belgi):", backKeyboard);
                    break;
                }
                case 'customer_login': {
                    const loginRegex = /^[a-zA-Z0-9_]{3,30}$/;
                    if (!loginRegex.test(text)) { bot.sendMessage(chatId, "❌ Login noto'g'ri! Faqat lotin harflar, raqamlar, _. Kamida 3 belgi."); return; }
                    const login = text.toLowerCase().trim();
                    const existing = await db.collection('customers').doc(login).get();
                    if (existing.exists) { bot.sendMessage(chatId, "❌ Bunday login allaqachon mavjud! Boshqa login tanlang."); return; }
                    data.login = login;
                    state.steps.push(oldStep);
                    state.step = 'customer_password';
                    bot.sendMessage(chatId, "5/5. Parol yarating (kamida 4 belgi):", backKeyboard);
                    break;
                }
                case 'customer_password': {
                    if (!text || text.length < 4) { bot.sendMessage(chatId, "❌ Parol kamida 4 belgi bo'lsin!"); return; }
                    data.password = text;
                    const newCustomer = {
                        login: data.login, password: data.password,
                        firstName: data.firstName, lastName: data.lastName,
                        phone: data.phone, telegramId: null,
                        ordersCount: 0, totalOrders: 0,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    };
                    try {
                        await db.collection('customers').doc(data.login).set(newCustomer);
                        bot.sendMessage(chatId,
                            `✅ Mijoz qo'shildi!\n\n` +
                            `👤 ${data.firstName} ${data.lastName}\n` +
                            `📞 ${data.phone}\n\n` +
                            `🔑 LOGIN MA'LUMOTLARI (mijozga jo'nating):\n` +
                            `Login: ${data.login}\n` +
                            `Parol: ${data.password}\n\n` +
                            `📲 Mijoz Telegram Mini App orqali shu ma'lumotlar bilan kirsin.`,
                            mainKeyboard
                        );
                    } catch (error) {
                        console.error("Mijoz saqlashda xato:", error);
                        bot.sendMessage(chatId, "❌ Mijozni saqlashda xato!", mainKeyboard);
                    }
                    resetUserState(chatId);
                    break;
                }
            }
            state.data = data;
            return;
        }

        bot.sendMessage(chatId, "Tushunmadim. Tugmalardan tanlang:", mainKeyboard);
    });
}

module.exports = { registerMessageHandler };
