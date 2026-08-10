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
  
  const regex = /(hover:|focus:|active:|group-hover:)?shadow-(sky|blue|cyan|indigo)-([0-9]{3})(\/[0-9]+)?/g;
  
  content = content.replace(regex, (match, state, colorName, shade, opacity) => {
    state = state || '';
    opacity = opacity || '';
    return `${state}shadow-zeno${opacity}`;
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
});
