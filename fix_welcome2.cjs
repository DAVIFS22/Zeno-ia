const fs = require('fs');
let code = fs.readFileSync('src/components/WelcomeScreen.tsx', 'utf8');
code = code.replace(/const containerVariants = {/g, 'const containerVariants: any = {');
fs.writeFileSync('src/components/WelcomeScreen.tsx', code);
