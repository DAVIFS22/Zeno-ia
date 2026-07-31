const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/        'gemini-1\.5-flash-8b',\n        'gemini-1\.5-flash'/g, "        'gemini-2.5-pro',\n        'gemini-3.1-pro-preview'");

fs.writeFileSync('server.ts', content);
