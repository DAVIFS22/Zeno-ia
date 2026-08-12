const fs = require('fs');
let code = fs.readFileSync('src/components/ImageLibraryModal.tsx', 'utf8');

if (!code.includes("import { HighlightText }")) {
  code = "import { HighlightText } from './HighlightText';\n" + code;
  fs.writeFileSync('src/components/ImageLibraryModal.tsx', code);
}
