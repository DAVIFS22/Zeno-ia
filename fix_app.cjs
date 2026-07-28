const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
`                return null;
              })()}`,
`                return null;
              })()
            )}`
);

fs.writeFileSync('src/App.tsx', code);
