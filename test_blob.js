const buf = Buffer.from('aGVsbG8=', 'base64');
const blob = new Blob([buf], { type: 'audio/webm' });
console.log(blob.size, blob.type);
