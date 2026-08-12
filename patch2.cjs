const fs = require('fs');
let code = fs.readFileSync('src/components/WelcomeScreen.tsx', 'utf8');

code = code.replace(/<button\n                key={idx}/g, '<motion.button\n                variants={itemVariants}\n                key={idx}');
code = code.replace(/<\/button>\n            \);/g, '</motion.button>\n            );');

code = code.replace(/<button\n              onClick={onOpenMusicStudio}/g, '<motion.button\n              variants={itemVariants}\n              onClick={onOpenMusicStudio}');
code = code.replace(/<\/button>\n          \)}/g, '</motion.button>\n          )}');

fs.writeFileSync('src/components/WelcomeScreen.tsx', code);
