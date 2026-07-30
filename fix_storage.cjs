const fs = require('fs');
let content = fs.readFileSync('src/lib/imageLibraryStorage.ts', 'utf8');

// remove emojis
content = content.replace(/icon: '📁'/g, "icon: 'Folder'");
content = content.replace(/icon = '📁'/g, "icon = 'Folder'");
content = content.replace(/icon: '🏷️'/g, "icon: 'Tag'");
content = content.replace(/icon: '🎨'/g, "icon: 'Palette'");
content = content.replace(/icon: '🖼️'/g, "icon: 'Image'");
content = content.replace(/icon: '👤'/g, "icon: 'User'");

fs.writeFileSync('src/lib/imageLibraryStorage.ts', content);
