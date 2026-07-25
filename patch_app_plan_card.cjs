const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(
  "import { LimitReachedScreen } from './components/LimitReachedScreen';",
  "import { LimitReachedScreen } from './components/LimitReachedScreen';\nimport { PlanUsageCard } from './components/PlanUsageCard';"
);

app = app.replace(
  "const [limitReachedScreen, setLimitReachedScreen] = useState<string | null>(null);",
  "const [limitReachedScreen, setLimitReachedScreen] = useState<string | null>(null);\n  const [showUsageCard, setShowUsageCard] = useState(true);"
);

app = app.replace(
  "const handleNewChat = () => {",
  "const handleNewChat = () => {\n    setShowUsageCard(true);"
);

app = app.replace(
  `{/* Home / Welcome Screen if no user messages */}`,
  `{/* Plan Usage Card */}
            {!limitReachedScreen && showUsageCard && userSettings.plan === 'ZENO Free' && (messages.length === 0 || (messages.length === 1 && messages[0].id.startsWith('welcome'))) && (
              <div className="w-full max-w-4xl px-4 sm:px-6 flex flex-col pt-4">
                <PlanUsageCard 
                  plan={userSettings.plan} 
                  limits={adminConfig} 
                  usage={backendLimits} 
                  onClose={() => setShowUsageCard(false)} 
                  onUpgrade={() => handleOpenSubscriptionModal()} 
                />
              </div>
            )}
            
            {/* Home / Welcome Screen if no user messages */}`
);

fs.writeFileSync('src/App.tsx', app);
