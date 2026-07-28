const bufferStr = `data: {"text":"Olá! Como posso ajudar?"}\n\ndata: [DONE]\n\n`;
let buffer = bufferStr;
let accumulatedText = "";
while (buffer.includes('\n\n')) {
  const eventIndex = buffer.indexOf('\n\n');
  const eventStr = buffer.slice(0, eventIndex);
  buffer = buffer.slice(eventIndex + 2);
  
  const lines = eventStr.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('data:')) {
      const dataStr = line.substring(line.indexOf('data:') + 5).trim();
      if (dataStr === '[DONE]') continue;
      try {
        const data = JSON.parse(dataStr);
        if (data.text) accumulatedText = data.text;
      } catch (e) {
        accumulatedText += dataStr;
      }
    }
  }
}
console.log("Result:", accumulatedText);
