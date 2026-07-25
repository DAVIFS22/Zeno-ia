const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(
  "import {",
  "import { getOrCreateUserId } from './lib/userId';\nimport {"
);

fs.writeFileSync('src/App.tsx', app);
