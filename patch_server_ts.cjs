const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

server = server.replace(
  "const usage = getUserUsage(userId);",
  "const usage = getUserUsage(userId as string);"
);

server = server.replace(
  "updateUserUsage(userId, actionType);",
  "updateUserUsage(userId, actionType as keyof typeof config.limits);"
);

fs.writeFileSync('server.ts', server);
