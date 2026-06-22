const paymentMethodMap = {
    cash:  '💵 Naqt',
    card:  '💳 Karta',
    click: '📱 Click',
    payme: '📱 Payme',
    uzum:  '📱 Uzum Pay',
};

function getPaymentMethodText(method) {
    return paymentMethodMap[method] || '💳 Karta';
}

module.exports = { paymentMethodMap, getPaymentMethodText };
