const fs = require('fs');
let content = fs.readFileSync('src/components/ImageLibraryModal.tsx', 'utf8');

// remove emojis
content = content.replace(/useState\('📁'\)/g, "useState('Folder')");
content = content.replace(/\{col\.icon \|\| '📁'\}/g, "{<Folder className=\"w-5 h-5 text-neutral-400\" />}");

const match = content.match(/import {([^}]+)} from 'lucide-react';/);
if (match && !match[1].includes('Folder')) {
  let existing = match[1].split(',').map(s => s.trim());
  existing.push('Folder');
  content = content.replace(/import {([^}]+)} from 'lucide-react';/, `import { ${existing.join(', ')} } from 'lucide-react';`);
}

content = content.replace(/<span>\{col\.icon \|\| '📁'\}<\/span>/g, `<span>{col.icon === '📁' || !col.icon ? <Folder className="w-5 h-5 text-neutral-400" /> : <Folder className="w-5 h-5 text-neutral-400" />}</span>`);

fs.writeFileSync('src/components/ImageLibraryModal.tsx', content);
