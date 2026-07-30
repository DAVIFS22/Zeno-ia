const fs = require('fs');
let content = fs.readFileSync('src/components/YouTubeProcessor.tsx', 'utf8');

content = content.replace(/const \[status, setStatus\] = useState<'idle' \| 'processing' \| 'success' \| 'error'>\('idle'\);/, "const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');\n  const [errorMsg, setErrorMsg] = useState<string>('');");

content = content.replace(/} catch \(err: any\) \{/g, "} catch (err: any) {\n      setErrorMsg(err.message || 'Erro desconhecido');");

content = content.replace(/<p className="text-\[13px\] font-medium text-neutral-300">Não foi possível processar este vídeo no momento\.<\/p>/g, "<p className=\"text-[13px] font-medium text-neutral-300\">{errorMsg || 'Não foi possível processar este vídeo no momento.'}</p>");

fs.writeFileSync('src/components/YouTubeProcessor.tsx', content);
