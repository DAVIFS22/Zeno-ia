const fs = require('fs');
let code = fs.readFileSync('src/hooks/useAudioLevel.ts', 'utf8');

code = code.replace(
  /\(blob as HTMLElement\)\.style\.transform = `scale\(\$\{1 \+ smoothVolume \* 0\.6\}\)`;\s+\(blob as HTMLElement\)\.style\.opacity = '1';/g,
  `// (blob as HTMLElement).style.transform = \`scale(\${1 + smoothVolume * 0.6})\`;
        // (blob as HTMLElement).style.opacity = '1';`
);

code = code.replace(
  /\(blob as HTMLElement\)\.style\.transform = `scale\(0\)`([^]*?)\(blob as HTMLElement\)\.style\.opacity = `0`;/g,
  `// (blob as HTMLElement).style.transform = \`scale(0)\`$1// (blob as HTMLElement).style.opacity = \`0\`;`
);

fs.writeFileSync('src/hooks/useAudioLevel.ts', code);
