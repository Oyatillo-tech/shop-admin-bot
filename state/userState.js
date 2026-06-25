const userState = {};

function resetUserState(chatId) {
    userState[chatId] = { step: 'none', data: {}, steps: [] };
}

module.exports = { userState, resetUserState };
