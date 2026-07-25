const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

const warningBanner = `
            {/* Warning Banner */}
            {userSettings.plan === 'ZENO Free' && backendLimits && adminConfig && (
              (() => {
                const limit = adminConfig.messages;
                const used = backendLimits.messages;
                const remaining = Math.max(0, limit - used);
                if (remaining <= 10 && remaining > 0) {
                  return (
                    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 mb-2">
                      <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm py-2.5 px-4 rounded-xl flex items-center justify-between border border-amber-200 dark:border-amber-800/50">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">Restam apenas {remaining} mensage{remaining === 1 ? 'm' : 'ns'} hoje.</span>
                          <span className="hidden sm:inline opacity-80">Faça upgrade para o ZENO Pro para continuar sem interrupções.</span>
                        </div>
                        <button onClick={() => handleOpenSubscriptionModal()} className="font-semibold underline underline-offset-2 hover:opacity-80">
                          Upgrade
                        </button>
                      </div>
                    </div>
                  );
                }
                return null;
              })()
            )}
`;

app = app.replace(
  `{/* Plan Usage Card */}`,
  warningBanner + "\n            {/* Plan Usage Card */}"
);

fs.writeFileSync('src/App.tsx', app);
