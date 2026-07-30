const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace common colored Tailwind classes with neutral or blue
  content = content.replace(/emerald-\d+/g, 'blue-500');
  content = content.replace(/green-\d+/g, 'blue-500');
  content = content.replace(/teal-\d+/g, 'blue-500');
  content = content.replace(/cyan-\d+/g, 'blue-500');
  content = content.replace(/red-\d+/g, 'neutral-400');
  content = content.replace(/rose-\d+/g, 'neutral-400');
  content = content.replace(/amber-\d+/g, 'neutral-400');
  content = content.replace(/yellow-\d+/g, 'neutral-400');
  content = content.replace(/purple-\d+/g, 'blue-500');
  content = content.replace(/violet-\d+/g, 'blue-500');
  content = content.replace(/indigo-\d+/g, 'blue-500');
  content = content.replace(/pink-\d+/g, 'neutral-400');

  // Background and border harmonization to strictly gray/blue/white
  content = content.replace(/bg-neutral-900/g, 'bg-[#1C1C1E]');
  content = content.replace(/bg-neutral-950/g, 'bg-[#121212]');
  content = content.replace(/bg-neutral-800/g, 'bg-[#232326]');
  content = content.replace(/border-neutral-800/g, 'border-[#2C2C2E]');
  content = content.replace(/border-neutral-700/g, 'border-[#2C2C2E]');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Harmonized:', filePath);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        walk(fullPath);
      }
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walk(path.join(__dirname, 'src'));
console.log('Palette harmonization complete.');
