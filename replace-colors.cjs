const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', (filePath) => {
  if (!filePath.endsWith('.tsx')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  const regex = /(hover:|focus:|active:|group-hover:)?(bg|text|border|ring|fill|stroke)-(sky|blue|cyan|indigo)-([0-9]{3})/g;
  
  content = content.replace(regex, (match, state, property, colorName, shade) => {
    state = state || '';
    shade = parseInt(shade);
    
    // Backgrounds
    if (property === 'bg') {
        if (shade >= 800) return `${state}bg-zeno/20`; 
        if (shade <= 200) return `${state}bg-zeno/10`; 
        if (state === 'hover:' && shade > 500) return `hover:bg-zeno/90`;
        if (state === 'hover:' && shade < 500) return `hover:bg-zeno/10`; // hover:bg-sky-100 -> hover:bg-zeno/10
        return `${state}bg-zeno`;
    }
    
    // Borders
    if (property === 'border') {
        if (shade >= 800) return `${state}border-zeno/30`;
        if (shade <= 300) return `${state}border-zeno/30`;
        return `${state}border-zeno`;
    }
    
    // Text
    if (property === 'text') {
        // Just use zeno, maybe with opacity if it was very dark/light?
        // Actually, zeno text might be the standard. Let's just use text-zeno
        return `${state}text-zeno`;
    }
    
    // Ring, Fill, Stroke
    return `${state}${property}-zeno`;
  });
  
  if (content !== originalContent) {
    console.log(`Updated ${filePath}`);
    fs.writeFileSync(filePath, content, 'utf8');
  }
});
