const fs = require('fs');

let settings = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

settings = settings.replace(
  "onUpdateSettings: (settings: UserSettings) => void;",
  "onUpdateSettings: (settings: UserSettings) => void;\n  backendLimits?: any;\n  adminConfig?: any;"
);

settings = settings.replace(
  "onOpenSubscriptionModal }: SettingsModalProps) {",
  "onOpenSubscriptionModal,\n  backendLimits,\n  adminConfig }: SettingsModalProps) {\n  const [timeLeft, setTimeLeft] = React.useState<{hours: number, minutes: number}>({hours:0, minutes:0});\n  React.useEffect(() => { const calcTime = () => { const now = new Date(); const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999); const diff = endOfDay.getTime() - now.getTime(); setTimeLeft({ hours: Math.floor(diff / (1000 * 60 * 60)), minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)) }); }; calcTime(); const interval = setInterval(calcTime, 60000); return () => clearInterval(interval); }, []);"
);

const usageUI = `
                  {!isPro && adminConfig && backendLimits && (
                    <div className="mt-6 border border-[#313131] rounded-xl p-4 bg-[#232323]">
                      <h4 className="text-white font-medium mb-4">Uso Diário (Plano Gratuito)</h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-400">Mensagens</span>
                          <span className="text-white">{backendLimits.messages} / {adminConfig.messages}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-400">Pesquisa Web</span>
                          <span className="text-white">{backendLimits.search} / {adminConfig.search}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-400">Imagens</span>
                          <span className="text-white">{backendLimits.image} / {adminConfig.image}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-400">Análise de PDF</span>
                          <span className="text-white">{backendLimits.doc} / {adminConfig.doc}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-400">Análise Visual</span>
                          <span className="text-white">{backendLimits.vision} / {adminConfig.vision}</span>
                        </div>
                        <div className="pt-3 mt-3 border-t border-[#313131] flex justify-between items-center">
                          <span className="text-neutral-400">Próxima renovação:</span>
                          <span className="text-white font-medium">{String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m</span>
                        </div>
                      </div>
                    </div>
                  )}
`;

settings = settings.replace(
  "{onOpenSubscriptionModal && (",
  usageUI + "\n                  {onOpenSubscriptionModal && ("
);

fs.writeFileSync('src/components/SettingsModal.tsx', settings);

let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(
  "<SettingsModal",
  "<SettingsModal backendLimits={backendLimits} adminConfig={adminConfig}"
);
fs.writeFileSync('src/App.tsx', app);
