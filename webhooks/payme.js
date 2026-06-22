const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

const PAYME_KEY = process.env.PAYME_KEY;

function checkAuth(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth) {
        return res.json({ error: { code: -32504, message: "Insufficient privilege" } });
    }
    const decoded = Buffer.from(auth.replace('Basic ', ''), 'base64').toString('utf-8');
    const key = decoded.split(':')[1];
    if (key !== PAYME_KEY) {
        return res.json({ error: { code: -32504, message: "Insufficient privilege" } });
    }
    next();
}

router.post('/', checkAuth, async (req, res) => {
    const { id, method, params } = req.body;

    try {
        // ─── CheckPerformTransaction ─────────────────────────────────
        if (method === 'CheckPerformTransaction') {
            const orderId = params.account.orderId;
            const orderDoc = await db.collection('orders').doc(orderId).get();

            if (!orderDoc.exists) {
                return res.json({ id, error: { code: -31050, message: { uz: "Buyurtma topilmadi", ru: "Заказ не найден", en: "Order not found" } } });
            }
            const order = orderDoc.data();
            const expectedAmount = (order.totalUZS || 0) * 100; // so'm → tiyin
            if (params.amount !== expectedAmount) {
                return res.json({ id, error: { code: -31001, message: { uz: "Summa noto'g'ri", ru: "Неверная сумма", en: "Wrong amount" } } });
            }
            return res.json({ id, result: { allow: true } });
        }

        // ─── CreateTransaction ───────────────────────────────────────
        if (method === 'CreateTransaction') {
            const transactionId = params.id;
            const orderId = params.account.orderId;

            const existingDoc = await db.collection('payme_transactions').doc(transactionId).get();
            if (existingDoc.exists) {
                const existing = existingDoc.data();
                if (existing.state !== 1) {
                    return res.json({ id, error: { code: -31008, message: "Unable to complete operation" } });
                }
                return res.json({ id, result: { create_time: existing.createTime, transaction: transactionId, state: 1 } });
            }

            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                return res.json({ id, error: { code: -31050, message: "Buyurtma topilmadi" } });
            }

            const transaction = {
                id: transactionId,
                orderId,
                amount: params.amount,
                createTime: params.time, // ms
                performTime: null,
                cancelTime: null,
                state: 1,
                reason: null,
            };
            await db.collection('payme_transactions').doc(transactionId).set(transaction);

            return res.json({ id, result: { create_time: params.time, transaction: transactionId, state: 1 } });
        }

        // ─── PerformTransaction ──────────────────────────────────────
        if (method === 'PerformTransaction') {
            const transactionId = params.id;
            const transDoc = await db.collection('payme_transactions').doc(transactionId).get();

            if (!transDoc.exists) {
                return res.json({ id, error: { code: -31003, message: "Transaction not found" } });
            }
            const trans = transDoc.data();

            if (trans.state === 2) {
                return res.json({ id, result: { transaction: transactionId, perform_time: trans.performTime, state: 2 } });
            }
            if (trans.state !== 1) {
                return res.json({ id, error: { code: -31008, message: "Unable to complete operation" } });
            }

            const performTime = Date.now();
            await db.collection('payme_transactions').doc(transactionId).update({ state: 2, performTime });
            await db.collection('orders').doc(trans.orderId).update({ paymentStatus: 'paid', status: 'confirmed' });

            return res.json({ id, result: { transaction: transactionId, perform_time: performTime, state: 2 } });
        }

        // ─── CancelTransaction ───────────────────────────────────────
        if (method === 'CancelTransaction') {
            const transactionId = params.id;
            const transDoc = await db.collection('payme_transactions').doc(transactionId).get();

            if (!transDoc.exists) {
                return res.json({ id, error: { code: -31003, message: "Transaction not found" } });
            }
            const trans = transDoc.data();

            if (trans.state === -1) {
                return res.json({ id, result: { transaction: transactionId, cancel_time: trans.cancelTime, state: -1 } });
            }
            if (trans.state === 2) {
                return res.json({ id, error: { code: -31007, message: "Could not cancel. Order is already paid." } });
            }

            const cancelTime = Date.now();
            await db.collection('payme_transactions').doc(transactionId).update({ state: -1, cancelTime, reason: params.reason ?? null });
            await db.collection('orders').doc(trans.orderId).update({ paymentStatus: 'cancelled' });

            return res.json({ id, result: { transaction: transactionId, cancel_time: cancelTime, state: -1 } });
        }

        // ─── CheckTransaction ────────────────────────────────────────
        if (method === 'CheckTransaction') {
            const transactionId = params.id;
            const transDoc = await db.collection('payme_transactions').doc(transactionId).get();

            if (!transDoc.exists) {
                return res.json({ id, error: { code: -31003, message: "Transaction not found" } });
            }
            const trans = transDoc.data();
            return res.json({
                id,
                result: {
                    create_time: trans.createTime,
                    perform_time: trans.performTime ?? 0,
                    cancel_time: trans.cancelTime ?? 0,
                    transaction: transactionId,
                    state: trans.state,
                    reason: trans.reason ?? null,
                },
            });
        }

        return res.json({ id, error: { code: -32601, message: "Method not found" } });

    } catch (error) {
        console.error('Payme webhook xato:', error);
        return res.json({ id, error: { code: -32400, message: error.message } });
    }
});

module.exports = router;
