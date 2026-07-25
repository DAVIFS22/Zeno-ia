const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Import userId and types
app = app.replace(
  "import { getTodayString",
  "import { getOrCreateUserId } from './lib/userId';\nimport { getTodayString"
);

// 2. Add backend limits states
const usageState = `
  const userId = getOrCreateUserId();
  const [backendLimits, setBackendLimits] = useState<any>(null);
  const [adminConfig, setAdminConfig] = useState<any>(null);
  const [limitReachedScreen, setLimitReachedScreen] = useState<string | null>(null); // 'messages', 'image', etc

  const fetchLimits = async () => {
    try {
      const res = await fetch(\`/api/limits?userId=\${userId}\`);
      if (res.ok) {
        const data = await res.json();
        setBackendLimits(data.usage.usage);
        setAdminConfig(data.config.limits);
      }
    } catch (e) {
      console.error("Failed to fetch limits:", e);
    }
  };

  useEffect(() => {
    fetchLimits();
    // Poll every 30s to keep countdown/limits fresh if needed, but fetch on mount is enough
    const interval = setInterval(fetchLimits, 60000);
    return () => clearInterval(interval);
  }, []);
`;

// we inject it right before `const [dailyUsage`
app = app.replace(
  "const [dailyUsage, setDailyUsage] = useState<DailyUsage>(() => {",
  usageState + "\n  const [dailyUsage, setDailyUsage] = useState<DailyUsage>(() => {"
);

fs.writeFileSync('src/App.tsx', app);
