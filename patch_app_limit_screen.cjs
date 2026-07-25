const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(
  "import { WelcomeScreen } from './components/WelcomeScreen';",
  "import { WelcomeScreen } from './components/WelcomeScreen';\nimport { LimitReachedScreen } from './components/LimitReachedScreen';"
);

app = app.replace(
  "{/* Home / Welcome Screen if no user messages */}",
  `{/* Limit Reached Screen */}
            {limitReachedScreen && (
              <LimitReachedScreen 
                actionType={limitReachedScreen} 
                onUpgrade={() => { setLimitReachedScreen(null); handleOpenSubscriptionModal('Faça upgrade para o ZENO Pro para utilizar sem limites.'); }} 
                onBack={() => setLimitReachedScreen(null)} 
              />
            )}
            {/* Home / Welcome Screen if no user messages */}`
);

app = app.replace(
  `{(messages.length === 0 || (messages.length === 1 && messages[0].id.startsWith('welcome'))) && (`,
  `{!limitReachedScreen && (messages.length === 0 || (messages.length === 1 && messages[0].id.startsWith('welcome'))) && (`
);

app = app.replace(
  `{messages.filter(msg => !(msg.id.startsWith('welcome') && messages.length === 1)).length > 0 && (`,
  `{!limitReachedScreen && messages.filter(msg => !(msg.id.startsWith('welcome') && messages.length === 1)).length > 0 && (`
);

fs.writeFileSync('src/App.tsx', app);
