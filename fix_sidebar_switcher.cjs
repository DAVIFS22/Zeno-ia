const fs = require('fs');
let code = fs.readFileSync('src/components/SidebarNav.tsx', 'utf8');

code = code.replace(
  /{showAccountSwitcher && session\?\.accounts\?\.length > 1 && \(/g,
  '<AnimatePresence>{showAccountSwitcher && session?.accounts?.length > 1 && ('
);

code = code.replace(
  /<div className={`absolute bottom-full left-0 w-full mb-2 p-2 rounded-xl border shadow-xl z-50   \${/g,
  `<motion.div
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={\`absolute bottom-full left-0 w-full mb-2 p-2 rounded-xl border shadow-xl z-50   \${`
);

code = code.replace(
  /                  <\/button>\n                \)\)}\n              <\/div>\n            <\/div>\n          \)}/g,
  '                  </button>\n                ))}\n              </div>\n            </motion.div>\n          )}</AnimatePresence>'
);

fs.writeFileSync('src/components/SidebarNav.tsx', code);
