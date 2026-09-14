const fs = require('fs');
let content = fs.readFileSync('src/components/VoiceModeModal.tsx', 'utf8');

const cleanupRegex = /stopRecognitionSafe\(\);\n\s*stopMicAnalyser\(\);\n\s*if \(silenceTimerRef\.current\) \{\n\s*clearTimeout\(silenceTimerRef\.current\);\n\s*silenceTimerRef\.current = null;\n\s*\}\n\s*if \(synthRef\.current\) \{\n\s*try \{ synthRef\.current\.cancel\(\); \} catch \(e\) \{\}\n\s*\}/;

const newCleanup = `stopRecognitionSafe();
      stopMicAnalyser();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (synthRef.current) {
        try { synthRef.current.cancel(); } catch (e) {}
      }
      if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
        try { inputAudioCtxRef.current.close(); } catch(e) {}
        inputAudioCtxRef.current = null;
      }
      if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
        try { outputAudioCtxRef.current.close(); } catch(e) {}
        outputAudioCtxRef.current = null;
      }`;

content = content.replace(cleanupRegex, newCleanup);
fs.writeFileSync('src/components/VoiceModeModal.tsx', content);
console.log('AudioContext memory leak fixed in VoiceModeModal');
