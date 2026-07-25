const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

server = server.replace(
  'isLimitReached: true }',
  'isLimitReached: true, actionType: actionType }'
);

fs.writeFileSync('server.ts', server);
