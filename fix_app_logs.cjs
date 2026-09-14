const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const logEffectRegex = /useEffect\(\(\) => \{\n\s*console\.log\('\[DEBUG - App\.tsx\] Messages state updated:'[\s\S]*?\}, \[messages, currentSessionId\]\);\n\n/;
content = content.replace(logEffectRegex, '');
fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx log effect fixed');
