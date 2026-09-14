const fs = require('fs');
let content = fs.readFileSync('src/components/VoiceModeModal.tsx', 'utf8');

// 1. Remove micStream state
content = content.replace(/  const \[micStream, setMicStream\] = useState<MediaStream \| null>\(null\);\n/, '');

// 2. Remove micStreamRef and related refs
content = content.replace(/  \/\/ Microphone Web Audio capture refs[\s\S]*?  const lastVisualizerSourceLoggedRef = useRef<string>\(''\);\n/, '');

// 3. Remove startMicAnalyser and stopMicAnalyser definitions
content = content.replace(/  \/\/ Initialize and connect Microphone for live user speech visualizer[\s\S]*?  const stopMicAnalyser = useCallback\(\(\) => \{[\s\S]*?  \}, \[\]\);\n/, '');

// 4. Remove stopMicAnalyser() calls
content = content.replace(/    stopMicAnalyser\(\);\n/g, '');

// 5. Replace startMicAnalyser calls in isOpen effect
content = content.replace(/      \/\/ Start live microphone frequency analyser for visualizer\n      startMicAnalyser\(\)\.then\(\(\) => \{\n        \/\/ Create a fresh SpeechRecognition instance and start\n        if \(isOpenRef\.current\) \{\n          createRecognitionInstance\(\);\n          startRecognitionSafe\(100\);\n        \}\n      \}\);/g, `      if (isOpenRef.current) {\n        addDebugLog('Visualizador em modo simulado (ouvindo).', 'info');\n        createRecognitionInstance();\n        startRecognitionSafe(100);\n      }`);

// 6. Replace startMicAnalyser calls in handleSend / toggle
content = content.replace(/      startMicAnalyser\(\)\.then\(\(\) => \{\n        if \(isOpenRef\.current\) \{\n          startRecognitionSafe\(50\);\n        \}\n      \}\);/g, `      if (isOpenRef.current) {\n        addDebugLog('Visualizador em modo simulado (ouvindo).', 'info');\n        startRecognitionSafe(50);\n      }`);

// 7. Replace startMicAnalyser calls in stopSpeaking
content = content.replace(/    startMicAnalyser\(\)\.then\(\(\) => \{\n      if \(isOpenRef\.current\) \{\n        startRecognitionSafe\(100\);\n      \}\n    \}\);/g, `    if (isOpenRef.current) {\n      addDebugLog('Visualizador em modo simulado (ouvindo).', 'info');\n      startRecognitionSafe(100);\n    }`);

// 8. Remove stopMicAnalyser from useEffect dependency arrays
content = content.replace(/, stopMicAnalyser/g, '');

// 9. Pass mediaStream={null} to AudioVisualizerCanvas
content = content.replace(/mediaStream=\{voiceState === 'listening' \? micStream : null\}/, 'mediaStream={null}');

fs.writeFileSync('src/components/VoiceModeModal.tsx', content);
console.log('VoiceModeModal cleaned up successfully');
