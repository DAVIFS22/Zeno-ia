const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  const neutralColors = ['rose', 'red', 'amber', 'yellow', 'purple', 'fuchsia', 'pink', 'orange'];
  const primaryColors = ['emerald', 'green', 'teal', 'cyan', 'indigo', 'blue']; // let's map all to sky

  neutralColors.forEach(color => {
    content = content.replace(new RegExp(`text-${color}-([0-9]{2,3})`, 'g'), 'text-neutral-$1');
    content = content.replace(new RegExp(`bg-${color}-([0-9]{2,3})`, 'g'), 'bg-neutral-$1');
    content = content.replace(new RegExp(`border-${color}-([0-9]{2,3})`, 'g'), 'border-neutral-$1');
    content = content.replace(new RegExp(`ring-${color}-([0-9]{2,3})`, 'g'), 'ring-neutral-$1');
    content = content.replace(new RegExp(`shadow-${color}-([0-9]{2,3})`, 'g'), 'shadow-neutral-$1');
    content = content.replace(new RegExp(`from-${color}-([0-9]{2,3})`, 'g'), 'from-neutral-$1');
    content = content.replace(new RegExp(`to-${color}-([0-9]{2,3})`, 'g'), 'to-neutral-$1');
  });

  primaryColors.forEach(color => {
    content = content.replace(new RegExp(`text-${color}-([0-9]{2,3})`, 'g'), 'text-sky-$1');
    content = content.replace(new RegExp(`bg-${color}-([0-9]{2,3})`, 'g'), 'bg-sky-$1');
    content = content.replace(new RegExp(`border-${color}-([0-9]{2,3})`, 'g'), 'border-sky-$1');
    content = content.replace(new RegExp(`ring-${color}-([0-9]{2,3})`, 'g'), 'ring-sky-$1');
    content = content.replace(new RegExp(`shadow-${color}-([0-9]{2,3})`, 'g'), 'shadow-sky-$1');
    content = content.replace(new RegExp(`from-${color}-([0-9]{2,3})`, 'g'), 'from-sky-$1');
    content = content.replace(new RegExp(`to-${color}-([0-9]{2,3})`, 'g'), 'to-sky-$1');
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walk(dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
      processFile(full);
    }
  }
}

walk('src');
