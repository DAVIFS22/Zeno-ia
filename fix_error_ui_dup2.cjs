const fs = require('fs');
let content = fs.readFileSync('src/components/YouTubeProcessor.tsx', 'utf8');

content = content.replace(/setErrorMsg\(err\.message \|\| 'Erro desconhecido'\);\n      setErrorMsg\(err\.message \|\| 'Erro desconhecido'\);/, "setErrorMsg(err.message || 'Erro desconhecido');");

fs.writeFileSync('src/components/YouTubeProcessor.tsx', content);
