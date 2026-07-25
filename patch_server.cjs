const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');

// 1. Add limits imports
server = server.replace(
  'import Stripe from "stripe";',
  'import Stripe from "stripe";\nimport { getUserUsage, updateUserUsage, getAdminConfig, setUserPlan } from "./src/lib/limits";'
);

// 2. Add limits routes before app.post("/api/chat")
const limitsRoutes = `
  app.get("/api/limits", (req, res) => {
    try {
      const userId = req.query.userId;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const usage = getUserUsage(userId);
      const config = getAdminConfig();
      res.json({ usage, config });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/config", (req, res) => {
    try {
      const { config } = req.body;
      const { updateAdminConfig } = require('./src/lib/limits');
      const updated = updateAdminConfig(config);
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
`;

server = server.replace(
  '  app.post("/api/chat", async (req, res) => {',
  limitsRoutes + '\n  app.post("/api/chat", async (req, res) => {'
);

// 3. Add limits check inside /api/chat
const checkLimits = `
      const { history, message, speed, attachments, userId, plan } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      if (userId) {
        setUserPlan(userId, plan || 'ZENO Free');
        if (plan !== 'ZENO Pro') {
          const config = getAdminConfig();
          const usage = getUserUsage(userId);
          let actionType = 'messages';
          if (speed === 'search' || speed === 'mega') actionType = 'search';
          else if (speed === 'vision') actionType = 'vision';
          else if (attachments && attachments.length > 0) actionType = 'doc';
          
          if (usage.usage[actionType] >= config.limits[actionType]) {
            return res.status(429).json({ error: \`Limite diário atingido. Você atingiu o limite de \${config.limits[actionType]} usos para \${actionType} hoje. Faça upgrade para o ZENO Pro para usar sem limites.\`, isLimitReached: true });
          }
          
          updateUserUsage(userId, actionType);
        }
      }
`;

server = server.replace(
  `      const { history, message, speed, attachments } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }`,
  checkLimits
);

// 4. Update /api/generate-title and /api/generate-image similarly?
// User said "Todos os recursos". But let's check chat first.

fs.writeFileSync('server.ts', server);
