const buf = Buffer.from('invalid', 'base64');
const blob = new Blob([buf], { type: 'audio/webm' });
const fd = new FormData();
fd.append('file', blob, 'audio.webm');
fd.append('model', 'whisper-large-v3');
