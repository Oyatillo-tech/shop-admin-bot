const { db } = require('../config/firebase');

async function getNextId(collectionName) {
    if (!db) return -1;
    try {
        const snapshot = await db.collection(collectionName).orderBy('id', 'desc').limit(1).get();
        if (snapshot.empty) return 1;
        const lastId = snapshot.docs[0].data().id;
        const lastIdNum = parseInt(lastId);
        if (isNaN(lastIdNum) || lastIdNum <= 0) return 1;
        return lastIdNum + 1;
    } catch (error) {
        console.error(`getNextId xato:`, error);
        return -1;
    }
}

function parseNumberInput(input, isPrice = false) {
    if (typeof input !== 'string') return null;
    let normalized = input.replace(/,/g, '.');
    const parsed = parseFloat(normalized);
    if (isNaN(parsed) || parsed < 0) return null;
    if (isPrice) {
        const parts = normalized.split('.');
        if (parts.length === 2 && parts[1].length > 3) {
            normalized = parts[0] + '.' + parts[1].substring(0, 3);
        }
        return parseFloat(normalized);
    }
    return parsed;
}

function formatTimestamp(ts) {
    if (!ts) return "Yo'q";
    try {
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return `${dd}.${mm}.${date.getFullYear()}`;
    } catch (e) {
        return "Yo'q";
    }
}

function parseDateDDMMYYYY(text) {
    const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) return null;
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2024 || year > 2100) return null;
    const dateObj = new Date(year, month - 1, day, 0, 0, 0);
    if (dateObj.getDate() !== day || dateObj.getMonth() !== month - 1 || dateObj.getFullYear() !== year) return null;
    return dateObj;
}

module.exports = { getNextId, parseNumberInput, formatTimestamp, parseDateDDMMYYYY };
