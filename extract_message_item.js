const fs = require('fs');

const content = fs.readFileSync('src/components/MessageList.tsx', 'utf8');

// The marker where StreamingProgress starts
const startMarker = "const StreamingProgress = ({ theme }";
const endMarker = "export const MessageList = React.memo";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Markers not found");
  process.exit(1);
}

const importsBlock = content.substring(0, startIndex);
const extractedContent = content.substring(startIndex, endIndex);
const remainingContent = content.substring(endIndex);

const messageItemContent = importsBlock + extractedContent;

fs.writeFileSync('src/components/MessageItem.tsx', messageItemContent);

const newMessageListContent = importsBlock + `import { MessageItem } from './MessageItem';\n\n` + remainingContent;

fs.writeFileSync('src/components/MessageList.tsx', newMessageListContent);
console.log("Extraction successful");
