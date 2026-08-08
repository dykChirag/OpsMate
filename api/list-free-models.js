require('dotenv').config();
const https = require('https');

const key = process.env.OPENROUTER_API_KEY;

const req = https.request({
  hostname: 'openrouter.ai',
  path:     '/api/v1/models',
  method:   'GET',
  headers:  { Authorization: `Bearer ${key}` },
}, (res) => {
  let body = '';
  res.on('data', (c) => body += c);
  res.on('end', () => {
    const data = JSON.parse(body);
    const free = data.data
      .filter((m) => m.pricing && (m.pricing.prompt === '0' || parseFloat(m.pricing.prompt) === 0))
      .map((m) => `${m.id}  (ctx: ${m.context_length})`);
    console.log('Free models:\n' + free.join('\n'));
  });
});
req.on('error', (e) => console.error(e));
req.end();
