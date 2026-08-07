const fs = require('fs');
let content = fs.readFileSync('src/components/ComposerInput.tsx', 'utf8');
const logic = fs.readFileSync('audio_logic.ts', 'utf8');

const lines = content.split('\n');
const newLines = [
  ...lines.slice(0, 95),
  logic,
  ...lines.slice(230)
];

fs.writeFileSync('src/components/ComposerInput.tsx', newLines.join('\n'));
console.log("Replaced successfully.");
