const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

if (!code.includes('firebase/firestore')) {
  code = "import { collection, onSnapshot, query, orderBy, updateDoc, doc } from 'firebase/firestore';\nimport { db } from '../lib/firebase';\n" + code;
  fs.writeFileSync('src/components/AdminPanel.tsx', code);
}
