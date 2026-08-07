const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

// fix tool types
server = server.replace(/type: "OBJECT"/g, 'type: "OBJECT" as any');
server = server.replace(/type: "STRING"/g, 'type: "STRING" as any');

// fix status
server = server.replace(/sub\.status = 'cancel_at_period_end';/g, "sub.status = 'active'; // cancelAtPeriodEnd handles this");

fs.writeFileSync('server.ts', server);
