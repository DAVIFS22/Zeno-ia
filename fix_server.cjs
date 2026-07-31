const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/        'gemini-2\.0-flash',\n        'gemini-2\.0-flash',\n        'gemini-2\.0-flash'/g, "        'gemini-3.6-flash',\n        'gemini-1.5-flash-8b',\n        'gemini-1.5-flash'");

fs.writeFileSync('server.ts', content);
