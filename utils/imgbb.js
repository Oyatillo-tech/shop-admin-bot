const axios = require('axios');
const FormData = require('form-data');
const { bot, TOKEN } = require('../config/adminBot');

async function uploadToImgBB(fileId) {
    try {
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const form = new FormData();
        form.append('key', process.env.IMGBB_API_KEY);
        form.append('image', buffer, { filename: 'product_image.jpg', contentType: 'image/jpeg' });
        const uploadResponse = await axios.post('https://api.imgbb.com/1/upload', form, {
            headers: { ...form.getHeaders() },
        });
        if (uploadResponse.data.success) return uploadResponse.data.data.url;
        return null;
    } catch (error) {
        console.error('ImgBB xato:', error.message);
        return null;
    }
}

module.exports = { uploadToImgBB };
