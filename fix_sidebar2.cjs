const fs = require('fs');
let code = fs.readFileSync('src/components/SidebarNav.tsx', 'utf8');

// replace the inline HighlightText definition
code = code.replace(/const HighlightText = \(\{\s*text,\s*query,\s*isDark,\s*snippetMode\s*\}[\s\S]*?<\/>\s*\);\s*\};/g, '');

// add the import at the top
code = code.replace(/import \{ GoogleLogo \} from '\.\/GoogleLogo';/g, "import { GoogleLogo } from './GoogleLogo';\nimport { HighlightText } from './HighlightText';");

fs.writeFileSync('src/components/SidebarNav.tsx', code);
