const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const replaceStr = `  const handleResolveTicket = async (id: string) => {
    try {
      await updateDoc(doc(db, 'supportTickets', id), {
        status: 'resolvido',
        resolvedAt: Date.now()
      });
    } catch (e) {
       console.error("Erro ao resolver ticket", e);
    }
  };`;

code = code.replace(/const handleResolveTicket = async \(id: string\) => \{[\s\S]*?console\.error\("Erro ao resolver ticket", e\);\n    \}\n  \};/, replaceStr);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
