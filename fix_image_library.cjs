const fs = require('fs');
let code = fs.readFileSync('src/components/ImageLibraryModal.tsx', 'utf8');

if (!code.includes('HighlightText')) {
  code = code.replace(/import \{ X, Search/g, "import { HighlightText } from './HighlightText';\nimport { X, Search");
}

code = code.replace(
  /<p className="text-\[11px\] font-normal text-white line-clamp-2 leading-tight">\s*\{img\.prompt\}\s*<\/p>/g,
  '<p className="text-[11px] font-normal text-white line-clamp-2 leading-tight">\n                          <HighlightText text={img.prompt || \'\'} query={searchQuery} isDark={true} />\n                        </p>'
);

fs.writeFileSync('src/components/ImageLibraryModal.tsx', code);
