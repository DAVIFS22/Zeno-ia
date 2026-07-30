const fs = require('fs');
let content = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

// remove emojis
content = content.replace(/🔑 Autenticação/g, "Autenticação");
content = content.replace(/🤖 inferência IA/g, "Inferência IA");
content = content.replace(/💳 Pagamentos/g, "Pagamentos");

content = content.replace(/\{log.type === 'auth' && '🔑 '\}/g, "");
content = content.replace(/\{log.type === 'ia' && '🤖 '\}/g, "");
content = content.replace(/\{log.type === 'payment' && '💳 '\}/g, "");

fs.writeFileSync('src/components/AdminPanel.tsx', content);
