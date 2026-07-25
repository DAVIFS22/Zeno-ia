const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(
  `        body: JSON.stringify({
          message: userMessage.text,
          history: messages.map(m => ({ role: m.role, text: m.text })),
          speed: speed,
          customInstructions: userSettings.customInstructions,
          attachments: attachments,
        }),`,
  `        body: JSON.stringify({
          message: userMessage.text,
          history: messages.map(m => ({ role: m.role, text: m.text })),
          speed: speed,
          customInstructions: userSettings.customInstructions,
          attachments: attachments,
          userId: userId,
          plan: userSettings.plan
        }),`
);

app = app.replace(
  `      if (!response.body) throw new Error('Servidor não retornou dados de resposta');`,
  `      if (response.status === 429) {
        const errorData = await response.json();
        setLimitReachedScreen(errorData.actionType || 'messages');
        fetchLimits(); // refresh to get the latest usage
        setIsLoading(false);
        // We must remove the placeholder message and user message from the session
        setSessions(prev => prev.map(s => {
          if (s.id === activeId) {
            return { ...s, messages: s.messages.slice(0, -2) };
          }
          return s;
        }));
        return;
      }
      if (!response.body) throw new Error('Servidor não retornou dados de resposta');`
);

fs.writeFileSync('src/App.tsx', app);
