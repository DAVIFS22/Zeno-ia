const fs = require('fs');
let content = fs.readFileSync('src/components/ImageStudioModal.tsx', 'utf8');
content = content.replace(/<span>\{ratio\.icon\}<\/span>/g, '<ratio.icon className="w-4 h-4" />');
fs.writeFileSync('src/components/ImageStudioModal.tsx', content);
