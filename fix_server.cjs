const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');
server = server.replace(/import \{ GoogleGenAI \} from '@google\/genai';\n/, ""); // Remove from where I added it

fs.writeFileSync('server.ts', server);
