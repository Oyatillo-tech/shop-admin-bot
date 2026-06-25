const express = require('express');
const paymeRouter = require('./webhooks/payme');

function startServer() {
    const app = express();
    app.use(express.json());

    app.use('/payme/webhook', paymeRouter);

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`✅ Server ${PORT}-portda ishlamoqda`);
    });
}

module.exports = { startServer };
