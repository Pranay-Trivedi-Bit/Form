const axios = require('axios');

const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const apiVersion = process.env.WA_API_VERSION || 'v21.0';

function getBaseUrl() {
  return `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;
}

function getHeaders() {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
}

async function sendTextMessage(phone, text) {
  const url = `${getBaseUrl()}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: text }
  };
  const res = await axios.post(url, body, { headers: getHeaders() });
  return res.data;
}

module.exports = { sendTextMessage };
