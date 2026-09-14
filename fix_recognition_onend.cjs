const fs = require('fs');
let content = fs.readFileSync('src/components/VoiceModeModal.tsx', 'utf8');

const oldOnend = `      recognition.onend = () => {
        isSpeechRecognitionActiveRef.current = false;
        isStartingRef.current = false;
        addDebugLog('Reconhecimento finalizado pelo navegador.', 'info');
      };`;

const newOnend = `      recognition.onend = () => {
        isSpeechRecognitionActiveRef.current = false;
        isStartingRef.current = false;
        addDebugLog('Reconhecimento finalizado pelo navegador.', 'info');

        if (isOpenRef.current && voiceStateRef.current === 'listening') {
          startRecognitionSafe(250);
        }
      };`;

if (!content.includes(oldOnend)) {
  console.error('Could not find oldOnend block!');
  process.exit(1);
}

content = content.replace(oldOnend, newOnend);
fs.writeFileSync('src/components/VoiceModeModal.tsx', content);
console.log('VoiceModeModal onend updated successfully');
