const fs = require('fs');
let content = fs.readFileSync('src/components/YouTubeProcessor.tsx', 'utf8');

content = content.replace(/const \[errorMsg, setErrorMsg\] = useState<string>\(''\);\n  const \[errorMsg, setErrorMsg\] = useState<string>\(''\);/, "const [errorMsg, setErrorMsg] = useState<string>('');");

fs.writeFileSync('src/components/YouTubeProcessor.tsx', content);
