const fs = require('fs');
let content = fs.readFileSync('src/components/VoiceModeModal.tsx', 'utf8');

const onendedRegex = /sourceNode\.onended = \(\) => \{\n\s*const idx = activeSourceNodesRef\.current\.indexOf\(sourceNode\);\n\s*if \(idx !== -1\) \{\n\s*activeSourceNodesRef\.current\.splice\(idx, 1\);\n\s*\}\n\s*\};/;

const newOnended = `sourceNode.onended = () => {
        const idx = activeSourceNodesRef.current.indexOf(sourceNode);
        if (idx !== -1) {
          activeSourceNodesRef.current.splice(idx, 1);
        }
        try { sourceNode.disconnect(); } catch (e) {}
      };`;

content = content.replace(onendedRegex, newOnended);
fs.writeFileSync('src/components/VoiceModeModal.tsx', content);
console.log('VoiceModeModal audio node cleanup fixed');
