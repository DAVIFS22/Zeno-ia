const fs = require('fs');
let content = fs.readFileSync('src/components/MusicStudioModal.tsx', 'utf8');
content = content.replace(/\\s\*\\\[\?Aviso:\[\^\\\]\\n\]\*\\\]\?\\n\*/g, "/\\s*\\[?Aviso:[^\\]\\n]*\\]?\\n*/");
fs.writeFileSync('src/components/MusicStudioModal.tsx', content);
