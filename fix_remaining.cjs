const fs = require('fs');

function replace(file, from, to) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(from, to);
  fs.writeFileSync(file, content);
}

replace('src/components/AdaptiveLearningModal.tsx', /🎨 Foco em Criatividade/g, 'Foco em Criatividade');
replace('src/components/AdminPanel.tsx', /⚙️ Sistema\/Admin/g, 'Sistema/Admin');
replace('src/components/AdminPanel.tsx', /❌ Erros e Falhas/g, 'Erros e Falhas');
replace('src/components/AdminPanel.tsx', /\{log.type === 'info' && '⚙️ '\}/g, '');
replace('src/components/AdminPanel.tsx', /\{log.type === 'error' && '❌ '\}/g, '');
replace('src/components/MessageList.tsx', /✕/g, 'X');
replace('src/lib/imageLibraryStorage.ts', /📦/g, 'Box');
replace('src/lib/imageLibraryStorage.ts', /💼/g, 'Briefcase');

