require('dotenv').config();
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey:  process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://opsmate.zerops.app',
    'X-Title': 'OpsMate Test',
  },
});

async function test() {
  console.log('Testing OpenRouter with key:', process.env.OPENROUTER_API_KEY?.slice(0, 20) + '...');
  try {
    const res = await client.chat.completions.create({
      model:      'nvidia/nemotron-3-super-120b-a12b:free',
      max_tokens: 20,
      messages:   [{ role: 'user', content: 'Say "OK" and nothing else.' }],
    });
    console.log('SUCCESS:', res.choices[0].message.content);
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error('Code:', err.code);
    console.error('Status:', err.status);
    if (err.cause) console.error('Cause:', err.cause);
  }
}

test();
