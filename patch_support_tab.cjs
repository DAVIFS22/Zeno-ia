const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

const supportContent = `
              {activeCategory === 'support' && (
                <SupportChatTab />
              )}
`;

code = code.replace(/(\{activeCategory === 'developer' && \()/g, supportContent + "$1");
fs.writeFileSync('src/components/SettingsModal.tsx', code);
