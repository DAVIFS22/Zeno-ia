const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
const startIndex = code.indexOf('  // Secure Backend Gamification (ZP) Endpoints');
const endIndex = code.indexOf('  // Vite/Prod middleware', startIndex);
if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + code.substring(endIndex);
  fs.writeFileSync('server.ts', code);
  console.log('Removed gamification endpoints');
} else {
  console.log('Could not find markers');
}
