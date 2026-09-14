const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /  \}, \[userId, ui\]\);/g;
content = content.replace(regex, '  // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [userId]);');
fs.writeFileSync('src/App.tsx', content);
console.log('Fixed reconcileAndCheckSubscription dependency');
