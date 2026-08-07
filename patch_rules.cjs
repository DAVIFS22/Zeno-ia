const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

const newRule = `
    match /supportTickets/{docId} {
      allow read, write: if isAuthenticated() && (
        request.auth.token.email.lower() == 'davifernandes0024509@gmail.com' ||
        exists(/databases/$(database)/documents/admins/$(request.auth.token.email.lower()))
      );
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
    }
`;

if (!rules.includes('/supportTickets/')) {
  rules = rules.replace(/(\/\/ Default deny)/, newRule + "\n    $1");
  fs.writeFileSync('firestore.rules', rules);
  console.log('patched');
}
