const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

code = code.replace(
  "onOpenSubscriptionModal?: () => void;",
  "onOpenSubscriptionModal?: () => void;\n  backendLimits?: any;\n  adminConfig?: any;"
);

code = code.replace(
  "  onOpenSubscriptionModal\n}: SettingsModalProps) {",
  "  onOpenSubscriptionModal,\n  backendLimits,\n  adminConfig\n}: SettingsModalProps) {\n  const [timeLeft, setTimeLeft] = React.useState<{hours: number, minutes: number}>({hours:0, minutes:0});\n  React.useEffect(() => { const calcTime = () => { const now = new Date(); const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999); const diff = endOfDay.getTime() - now.getTime(); setTimeLeft({ hours: Math.floor(diff / (1000 * 60 * 60)), minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)) }); }; calcTime(); const interval = setInterval(calcTime, 60000); return () => clearInterval(interval); }, []);"
);

fs.writeFileSync('src/components/SettingsModal.tsx', code);
