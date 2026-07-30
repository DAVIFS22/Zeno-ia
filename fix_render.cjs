const fs = require('fs');

let content = fs.readFileSync('src/components/ImageStudioModal.tsx', 'utf8');
content = content.replace(/<span className="text-base">\{style\.icon\}<\/span>/g, '<style.icon className="w-5 h-5" />');
content = content.replace(/<span className="text-xl">\{ratio\.icon\}<\/span>/g, '<ratio.icon className="w-6 h-6" />');
fs.writeFileSync('src/components/ImageStudioModal.tsx', content);

let content2 = fs.readFileSync('src/components/MusicStudioModal.tsx', 'utf8');
content2 = content2.replace(/text\.replace\([^,]+, ''\)/g, "text.replace(/\\s*\\[?Aviso:[^\\]\\n]*\\]?\\n*/gi, '')");
fs.writeFileSync('src/components/MusicStudioModal.tsx', content2);

