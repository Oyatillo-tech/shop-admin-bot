const { bot, admins } = require('../config/adminBot');
const { db, admin } = require('../config/firebase');
const { getPaymentMethodText } = require('../paymentMethods');
const { BONUS_DISCOUNT_PERCENT } = require('../config/constants');

function registerOrderListener() {
    if (!db) return;
    const botStartTime = admin.firestore.Timestamp.now();
    console.log("🔔 Order listener faol...");

    db.collection('orders')
        .where('status', '==', 'new')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const orderData = change.doc.data();
                    const orderId = change.doc.id;
                    let isNew = false;
                    if (orderData.createdAt) {
                        const orderTime = orderData.createdAt.toMillis ? orderData.createdAt.toMillis() : new Date(orderData.createdAt).getTime();
                        if (orderTime > botStartTime.toMillis()) isNew = true;
                    } else {
                        isNew = true;
                    }
                    if (isNew) notifyAdminsNewOrder(orderId, orderData);
                }
            });
        }, error => console.error("❌ Order listener xatosi:", error));
}

function notifyAdminsNewOrder(orderId, orderData) {
    let itemsText = '';
    if (orderData.items && orderData.items.length > 0) {
        itemsText = orderData.items.map(item => {
            const totalPrice = (item.price * item.quantity).toLocaleString("uz-UZ");
            return `- ${item.quantity} x ${item.name} — ${totalPrice} so'm`;
        }).join('\n');
    } else {
        itemsText = "Mahsulotlar yo'q";
    }

    const paymentMethodText = getPaymentMethodText(orderData.paymentMethod);

    let bonusBlock = '';
    if (orderData.orderType === 'discount') {
        bonusBlock = `🎁 Buyurtma turi: 2-buyurtma — ${BONUS_DISCOUNT_PERCENT}% chegirma\n\n`;
    } else if (orderData.orderType === 'bonus') {
        const bonusName = orderData.bonusItem?.name || "Bonus mahsulot";
        bonusBlock = `🎁 Buyurtma turi: 3-buyurtma — 1+1 BONUS\n🎁 Bonus mahsulot: ${bonusName}\n\n`;
    } else {
        bonusBlock = `🎁 Buyurtma turi: 1-buyurtma — to'liq narx\n\n`;
    }

    let deliveryBlock = '';
    if (orderData.deliveryMethod === 'pickup') {
        deliveryBlock = `📦 Yetkazib berish: O'zim olib ketaman\n🏪 Manzil: ${orderData.pickupAddress || 'Belgilanmagan'}\n\n`;
    } else if (orderData.deliveryMethod === 'delivery') {
        const distance = orderData.distanceKm ? `${orderData.distanceKm.toFixed(1)} km` : "Noma'lum";
        const deliveryFeeUZS = orderData.deliveryFee || 0;
        const deliveryFeeText = deliveryFeeUZS === 0 ? "Bepul" : `${deliveryFeeUZS.toLocaleString("uz-UZ")} so'm`;
        deliveryBlock = `📦 Yetkazib berish: Yetkazib berish\n📏 Masofa: ~${distance}\n🚚 Narx: ${deliveryFeeText}\n📍 Manzil: ${orderData.deliveryAddress || 'Kiritilmagan'}\n\n`;
    } else {
        deliveryBlock = `📍 Manzil: ${orderData.deliveryAddress || 'Kiritilmagan'}\n\n`;
    }

    const message =
        `🛒 YANGI BUYURTMA!\n\n` +
        `👤 Mijoz: ${orderData.customerName || 'Noma\'lum'}\n` +
        `📞 Telefon: ${orderData.customerPhone || 'Noma\'lum'}\n` +
        `🆔 Telegram ID: ${orderData.customerTelegramId || 'Yo\'q'}\n\n` +
        bonusBlock + deliveryBlock +
        `🛍 Mahsulotlar:\n${itemsText}\n\n` +
        `💰 Jami: ${(orderData.totalUZS || 0).toLocaleString("uz-UZ")} so'm\n` +
        `💳 To'lov: ${paymentMethodText}`;

    const inlineKeyboard = {
        inline_keyboard: [[
            { text: "✅ Tasdiqlash", callback_data: `confirm_order_${orderId}` },
            { text: "❌ Bekor qilish", callback_data: `cancel_order_${orderId}` },
        ]],
    };

    admins.forEach(adminId => {
        bot.sendMessage(adminId, message, { reply_markup: inlineKeyboard }).catch(err => {
            console.error(`Admin ${adminId} ga xabar yuborishda xato:`, err.message);
        });
    });
}

module.exports = { registerOrderListener };
