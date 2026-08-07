const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

css = css.replace(
  /\.voice-mic-blob-animation \{\n    transition: transform 0\.3s cubic-bezier\(0\.16, 1, 0\.3, 1\), opacity 0\.3s ease-out;\n    transform: scale\(0\);\n    opacity: 0;\n  \}/g,
  `@keyframes micPulseOrganic {
    0% { transform: scale(0.95); opacity: 0.3; }
    50% { transform: scale(1.15); opacity: 0.6; }
    100% { transform: scale(0.95); opacity: 0.3; }
  }
  
  .voice-mic-blob-animation {
    animation: micPulseOrganic 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }`
);

fs.writeFileSync('src/index.css', css);
