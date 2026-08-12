const fs = require('fs');
let code = fs.readFileSync('src/components/SidebarNav.tsx', 'utf8');

code = code.replace(
  /{showMenu && coords && createPortal\(/,
  '<AnimatePresence>{showMenu && coords && createPortal('
);

code = code.replace(
  /<div \n                ref={menuRef}\n                style={{/g,
  '<motion.div \n                ref={menuRef}\n                initial={{ opacity: 0, scale: 0.95, y: -5 }}\n                animate={{ opacity: 1, scale: 1, y: 0 }}\n                exit={{ opacity: 0, scale: 0.95, y: -5 }}\n                transition={{ duration: 0.15, ease: "easeOut" }}\n                style={{'
);

code = code.replace(
  /                  <span>Excluir<\/span>\n                <\/button>\n              <\/div>,\n              document.body\n            \)}/,
  '                  <span>Excluir</span>\n                </button>\n              </motion.div>,\n              document.body\n            )}</AnimatePresence>'
);

fs.writeFileSync('src/components/SidebarNav.tsx', code);
