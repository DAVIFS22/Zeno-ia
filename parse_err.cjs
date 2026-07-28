const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  'res.write(`data: ${JSON.stringify({ error: error.message || "Erro interno no servidor ZENO." })}\\n\\n`);',
  `let cleanError = error.message || "Erro interno no servidor ZENO.";
      try {
        const parsed = JSON.parse(cleanError);
        if (parsed.error && parsed.error.message) {
          cleanError = parsed.error.message;
        }
      } catch(e) {}
      if (cleanError.includes("exceeded your current quota") || cleanError.includes("429")) {
        cleanError = "A cota gratuita do modelo foi excedida. Por favor, tente novamente em alguns instantes ou atualize para o ZENO Pro.";
      }
      res.write(\`data: \${JSON.stringify({ error: cleanError })}\\n\\n\`);`
);
fs.writeFileSync('server.ts', code);
