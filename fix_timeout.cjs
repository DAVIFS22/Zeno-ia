const fs = require('fs');
let content = fs.readFileSync('src/components/YouTubeProcessor.tsx', 'utf8');

content = content.replace(/setTimeout\(\(\) => controller\.abort\(\), 45000\)/g, "setTimeout(() => controller.abort(new Error('Timeout de processamento de vídeo (3 minutos). Tente um vídeo mais curto.')), 180000)");

fs.writeFileSync('src/components/YouTubeProcessor.tsx', content);
