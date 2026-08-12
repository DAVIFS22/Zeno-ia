const fs = require('fs');
let code = fs.readFileSync('src/components/ImageLibraryModal.tsx', 'utf8');

if (!code.includes('HighlightText')) {
  code = code.replace(/import \{ hasPremiumAccess \} from '\.\.\/config\/admin';/g, "import { hasPremiumAccess } from '../config/admin';\nimport { HighlightText } from './HighlightText';");
  fs.writeFileSync('src/components/ImageLibraryModal.tsx', code);
}
