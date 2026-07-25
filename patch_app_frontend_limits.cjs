const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

// The original limit check block:
const blockToRemove = `
    // 2. Subscription & Usage Check: Daily Message Limit for ZENO Free
    if (userSettings.plan === 'ZENO Free') {
      const msgCheck = checkUsageLimit(userSettings.plan, dailyUsage, 'message');
      if (!msgCheck.allowed) {
        handleOpenSubscriptionModal(\`Você atingiu o limite de \${FREE_LIMITS.MESSAGES_PER_DAY} mensagens diárias do plano ZENO Free. Faça upgrade para ZENO Pro e continue conversando sem limites.\`);
        return;
      }

      if (attachments.length > 0) {
        const docCheck = checkUsageLimit(userSettings.plan, dailyUsage, 'doc');
        if (!docCheck.allowed) {
          handleOpenSubscriptionModal(\`Você atingiu o limite de upload do plano Free (\${FREE_LIMITS.DOCS_PER_DAY} documentos/dia). Assine o ZENO Pro para análises ilimitadas.\`);
          return;
        }
      }
    }
`;

// It might be slightly different in the file, let's just use regex or replace parts
app = app.replace(/\/\/ 2\. Subscription & Usage Check: Daily Message Limit for ZENO Free[\s\S]*?let textToSend/m, 'let textToSend');

fs.writeFileSync('src/App.tsx', app);
