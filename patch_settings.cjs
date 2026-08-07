const fs = require('fs');

let settings = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

// Insert import
if (!settings.includes('SupportChatModal')) {
   settings = settings.replace(/import \{ motion, AnimatePresence \} from 'motion\/react';/, "import { motion, AnimatePresence } from 'motion/react';\nimport { SupportChatModal } from './SupportChatModal';\nimport { HelpCircle } from 'lucide-react';");
}

// Add state for support chat
if (!settings.includes('showSupportChat')) {
   settings = settings.replace(/const \[showAdaptiveLearning, setShowAdaptiveLearning\] = useState\(false\);/, "const [showAdaptiveLearning, setShowAdaptiveLearning] = useState(false);\n  const [showSupportChat, setShowSupportChat] = useState(false);");
}

// Add UI for Support button
// We'll look for "Receba alertas sobre atualizações" (notifications) or similar, or just append a new group before Danger Zone.
const supportGroup = `
            {/* Support Group */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl overflow-hidden mt-6">
              <div className="p-4 border-b border-neutral-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-blue-400" />
                </div>
                <span className="font-semibold text-neutral-200">Ajuda e Suporte</span>
              </div>
              <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="font-medium text-white text-sm">Falar com o Suporte</div>
                  <div className="text-xs text-neutral-400 mt-0.5">Tire dúvidas sobre planos, cobranças ou reporte um problema.</div>
                </div>
                <button 
                  onClick={() => setShowSupportChat(true)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-lg transition-colors border border-neutral-700"
                >
                  Abrir Chat de Suporte
                </button>
              </div>
            </div>
`;

if (!settings.includes('Ajuda e Suporte')) {
   // Add before Danger Zone
   settings = settings.replace(/({\/\* Danger Zone \*\/})/, supportGroup + "\n            $1");
}

// Render SupportChatModal
if (!settings.includes('<SupportChatModal')) {
   settings = settings.replace(/(<\/AnimatePresence>)/, "  <SupportChatModal isOpen={showSupportChat} onClose={() => setShowSupportChat(false)} />\n      $1");
}

fs.writeFileSync('src/components/SettingsModal.tsx', settings);
console.log("Settings updated.");
