const fs = require('fs');
let content = fs.readFileSync('src/components/ImageStudioModal.tsx', 'utf8');

// replace icons
content = content.replace(/icon: '📸'/g, 'icon: Camera');
content = content.replace(/icon: '📷'/g, 'icon: Camera');
content = content.replace(/icon: '🎨'/g, 'icon: Palette');
content = content.replace(/icon: '✏️'/g, 'icon: PenTool');
content = content.replace(/icon: '🌸'/g, 'icon: Flower');
content = content.replace(/icon: '🎬'/g, 'icon: Clapperboard');
content = content.replace(/icon: '🧊'/g, 'icon: Box');
content = content.replace(/icon: '🌆'/g, 'icon: Building2');
content = content.replace(/icon: '🐉'/g, 'icon: Flame');
content = content.replace(/icon: '🚀'/g, 'icon: Rocket');
content = content.replace(/icon: '🖼️'/g, 'icon: Image');
content = content.replace(/icon: '🖌️'/g, 'icon: Brush');
content = content.replace(/icon: '📐'/g, 'icon: Triangle');
content = content.replace(/icon: '🏷️'/g, 'icon: Tag');
content = content.replace(/icon: '💎'/g, 'icon: Diamond');
content = content.replace(/icon: '⚪'/g, 'icon: Circle');
content = content.replace(/icon: '🔷'/g, 'icon: Hexagon');

content = content.replace(/icon: '⬛'/g, 'icon: Square');
content = content.replace(/icon: '📺'/g, 'icon: Monitor');
content = content.replace(/icon: '📱'/g, 'icon: Smartphone');

// Add imports
const icons = ['Camera', 'Palette', 'PenTool', 'Flower', 'Clapperboard', 'Box', 'Building2', 'Flame', 'Rocket', 'Image', 'Brush', 'Triangle', 'Tag', 'Diamond', 'Circle', 'Hexagon', 'Square', 'Monitor', 'Smartphone'];

if (!content.includes('Camera')) {
  content = content.replace(/import {([^}]+)} from 'lucide-react';/, "import { $1, " + icons.join(', ') + " } from 'lucide-react';");
} else {
  // It probably already has some. Just append to existing import.
  const match = content.match(/import {([^}]+)} from 'lucide-react';/);
  if (match) {
    let existing = match[1].split(',').map(s => s.trim());
    icons.forEach(i => { if (!existing.includes(i)) existing.push(i); });
    content = content.replace(/import {([^}]+)} from 'lucide-react';/, `import { ${existing.join(', ')} } from 'lucide-react';`);
  }
}

// In the render:
content = content.replace(/<span className="text-2xl mb-2 block">\{style\.icon\}<\/span>/g, '<style.icon className="w-8 h-8 mb-2 text-neutral-400" />');
content = content.replace(/<span className="text-xl">\{ratio\.icon\}<\/span>/g, '<ratio.icon className="w-6 h-6 text-neutral-400" />');

fs.writeFileSync('src/components/ImageStudioModal.tsx', content);
