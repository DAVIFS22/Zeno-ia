const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const anchor = "let modelTemperature = modelCfg.temperature;";
const injection = `
      if (isSearchIntent) {
        modelSystemPrompt += "\\n\\n[REGRA DE PESQUISA]: IMPORTANTE: NUNCA crie uma seção 'Fontes:', 'Referências:' nem liste domínios, URLs ou links soltos ao final da sua resposta. NUNCA diga de onde tirou a informação no texto (a menos que seja estritamente necessário para o contexto). A interface do usuário já exibirá automaticamente os sites utilizados em um componente visual separado. Apenas forneça a resposta de forma direta.";
      }
`;

if (code.includes(anchor) && !code.includes("[REGRA DE PESQUISA]")) {
  code = code.replace(anchor, injection + '\n      ' + anchor);
  fs.writeFileSync('server.ts', code);
  console.log("Patched server.ts successfully");
} else {
  console.log("Could not patch server.ts or already patched");
}
