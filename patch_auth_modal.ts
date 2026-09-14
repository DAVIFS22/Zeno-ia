import fs from 'fs';

const content = fs.readFileSync('src/components/AuthModal.tsx', 'utf-8');
console.log(content.length);
