const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const listenerEffect = `
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSupportTickets(tickets);
    });
    return () => unsubscribe();
  }, [isAdmin]);
`;

if (!code.includes('onSnapshot(q, (snapshot)')) {
  code = code.replace(/(return \(\) => clearInterval\(interval\);\n  \}, \[userEmail\]\);)/, "$1\n" + listenerEffect);
  fs.writeFileSync('src/components/AdminPanel.tsx', code);
}
