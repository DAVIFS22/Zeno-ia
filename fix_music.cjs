const fs = require('fs');
let content = fs.readFileSync('src/components/MusicStudioModal.tsx', 'utf8');

// remove emojis
content = content.replace(/useState\('Criando sua música\.\.\. 🎵'\)/g, "useState('Criando sua música...')");
content = content.replace(/setLoadingText\('Criando sua música\.\.\. 🎵'\)/g, "setLoadingText('Criando sua música...')");
content = content.replace(/⚠️/g, "");

fs.writeFileSync('src/components/MusicStudioModal.tsx', content);
