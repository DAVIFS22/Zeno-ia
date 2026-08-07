const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  console.log('STATUS:', res.statusCode);
  res.on('data', (chunk) => {
    console.log('BODY:', chunk.toString());
  });
  res.on('end', () => {
    console.log('No more data in response.');
  });
});

req.on('error', (e) => {
  console.error('problem with request:', e.message);
});

req.write(JSON.stringify({
  message: "Oi",
  speed: "ZENO",
  isSmartMode: true,
  language: "pt",
  userId: "anon_123",
  history: []
}));
req.end();
