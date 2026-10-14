const jwt = require('/srv/trikonekt/tri-academy/backend/node_modules/jsonwebtoken');
const token = jwt.sign({ id: 'USER_8095918105', phone: '8095918105', role: 'user' }, 'trikonekt_captain_academy_super_secret_key_2026');
const http = require('http');
const req = http.request({
  host: 'localhost',
  port: 5005,
  path: '/api/auth/profile',
  headers: { Authorization: 'Bearer ' + token }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log('STATUS:', res.statusCode, '\nBODY:', d));
});
req.end();
