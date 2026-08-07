const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');
code = code.replace(/(\{ id: 'notifications', label: t.settings.notifications, icon: Bell \},)/, "$1\n    { id: 'support', label: 'Ajuda e Suporte', icon: LifeBuoy },");
fs.writeFileSync('src/components/SettingsModal.tsx', code);
