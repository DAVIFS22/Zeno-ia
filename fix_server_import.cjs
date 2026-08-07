const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

if (!server.includes("import { GoogleGenAI } from '@google/genai';")) {
  server = "import { GoogleGenAI } from '@google/genai';\n" + server;
  fs.writeFileSync('server.ts', server);
}
