const fs = require('fs');
let content = fs.readFileSync('src/components/AdaptiveLearningModal.tsx', 'utf8');

// replace emojis
content = content.replace(/label: '🎯 Foco em Precisão'/g, "label: 'Foco em Precisão'");
content = content.replace(/label: '⚖️ Equilibrado'/g, "label: 'Equilibrado'");

fs.writeFileSync('src/components/AdaptiveLearningModal.tsx', content);
