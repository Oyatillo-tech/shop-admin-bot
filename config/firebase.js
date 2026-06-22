require('dotenv').config();
const admin = require('firebase-admin');

let db;
try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON topilmadi.");
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    console.log("✅ Firebase ulangan.");
} catch (error) {
    console.error("❌ Firebase sozlashda xato!", error.message);
}

module.exports = { db, admin };
