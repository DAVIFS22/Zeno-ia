const fs = require('fs');
let code = fs.readFileSync('src/components/WelcomeScreen.tsx', 'utf8');
code = code.replace(/const itemVariants = {/g, 'const itemVariants: any = {');
fs.writeFileSync('src/components/WelcomeScreen.tsx', code);
