const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const scanEffectRegex = /\/\/ Scan active chat messages for generated images to populate library automatically[\s\S]*?\}, \[messages, currentSessionId, activeSession\?\.title, speed, userId\]\);/;

const newScanEffect = `// Scan active chat messages for generated images to populate library automatically
  const scannedMessagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      if (messages && messages.length > 0 && currentSessionId) {
        messages.forEach(msg => {
          if (msg.role === 'model' && msg.text && msg.text.includes('![') && !msg.isStreaming && !scannedMessagesRef.current.has(msg.id)) {
            scanAndSaveImagesFromText(msg.text, currentSessionId, activeSession?.title || 'Conversa', speed, userId);
            scannedMessagesRef.current.add(msg.id);
          }
        });
      }
    } catch (err) {
      console.error('[CRITICAL] Error in image scanning effect:', err);
    }
  }, [messages, currentSessionId, activeSession?.title, speed, userId]);`;

content = content.replace(scanEffectRegex, newScanEffect);
fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx scanner fixed');
