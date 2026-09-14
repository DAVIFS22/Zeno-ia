const fs = require('fs');

const itemContent = fs.readFileSync('src/components/MessageItem.tsx', 'utf8');

const interfaceStart = itemContent.indexOf("interface MessageListProps {");
if (interfaceStart === -1) {
  console.log("Interface not found");
  process.exit(1);
}

const propsContent = itemContent.substring(interfaceStart);
const newItemContent = itemContent.substring(0, interfaceStart);
fs.writeFileSync('src/components/MessageItem.tsx', newItemContent);

const listContent = fs.readFileSync('src/components/MessageList.tsx', 'utf8');
const exportIndex = listContent.indexOf("export const MessageList");

const newListContent = listContent.substring(0, exportIndex) + "export " + propsContent + "\n" + listContent.substring(exportIndex);
fs.writeFileSync('src/components/MessageList.tsx', newListContent);
console.log("Fix successful");
