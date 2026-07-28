const fs = require('fs');
let code = fs.readFileSync('src/components/WelcomeScreen.tsx', 'utf8');

// Insert new props to interface
code = code.replace(
`interface WelcomeScreenProps {
  theme: 'dark' | 'light';`,
`interface WelcomeScreenProps {
  showSuggestions?: boolean;
  recentSessions?: any[];
  onSelectSession?: (id: string) => void;
  theme: 'dark' | 'light';`
);

// Destructure new props
code = code.replace(
`export const WelcomeScreen: React.FC<WelcomeScreenProps> = React.memo(({ 
  theme, `,
`export const WelcomeScreen: React.FC<WelcomeScreenProps> = React.memo(({ 
  showSuggestions = false,
  recentSessions = [],
  onSelectSession,
  theme, `
);

fs.writeFileSync('src/components/WelcomeScreen.tsx', code);
