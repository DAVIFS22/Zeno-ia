const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(/\/\/ Increment Usage Stats for Free Users[\s\S]*?const userMessage: Message = {/m, 'const userMessage: Message = {');

fs.writeFileSync('src/App.tsx', app);
