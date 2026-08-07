const fs = require('fs');

let admin = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

// Ensure lucide-react has LifeBuoy and CheckCircle
if (!admin.includes('LifeBuoy')) {
  admin = admin.replace(/FileText,/, "FileText, LifeBuoy, CheckCircle,");
}

// Support states
if (!admin.includes('supportTickets')) {
  admin = admin.replace(/const \[systemLogFilter, setSystemLogFilter\] = useState<string>\('all'\);/, "const [systemLogFilter, setSystemLogFilter] = useState<string>('all');\n  const [supportTickets, setSupportTickets] = useState<any[]>([]);");
}

// Add 'support' tab in activeTab
admin = admin.replace(/\| 'logs' \| 'debug'>\('stats'\);/, "| 'logs' | 'debug' | 'support'>('stats');");

// Fetch support tickets
const fetchTickets = `
      // Fetch Support Tickets
      if (activeTab === 'support') {
        const tixRes = await fetch('/api/admin/support-tickets', {
          headers: { 'x-user-email': userEmail }
        });
        if (tixRes.ok) {
          const tixData = await tixRes.json();
          setSupportTickets(tixData.tickets || []);
        }
      }
`;
if (!admin.includes('support-tickets')) {
   admin = admin.replace(/(const fetchConfig = async \(\) => \{[\s\S]*?if \(!res\.ok\) throw new Error\('Falha ao buscar configs'\);)/, fetchTickets + "\n      $1");
   // We also need to re-fetch when tab changes.
   // Let's modify the useEffect for config fetching to also trigger on activeTab if needed, or add a new useEffect.
   const newUseEffect = `
  useEffect(() => {
    if (activeTab === 'support' && isAdmin) {
      const fetchTix = async () => {
         const tixRes = await fetch('/api/admin/support-tickets', { headers: { 'x-user-email': userEmail } });
         if (tixRes.ok) {
           const tixData = await tixRes.json();
           setSupportTickets(tixData.tickets || []);
         }
      };
      fetchTix();
    }
  }, [activeTab, userEmail, isAdmin]);
`;
   admin = admin.replace(/(useEffect\(\(\) => \{[\s\S]*?fetchConfig\(\);\n  \}, \[isAdmin, userEmail\]\);)/, "$1\n" + newUseEffect);
}

// Add Resolve Ticket function
const resolveTix = `
  const handleResolveTicket = async (id: string) => {
    try {
      const res = await fetch(\`/api/admin/support-tickets/\${id}/resolve\`, {
        method: 'POST',
        headers: { 'x-user-email': userEmail }
      });
      if (res.ok) {
         setSupportTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'resolvido' } : t));
      }
    } catch (e) {
       console.error("Erro ao resolver ticket", e);
    }
  };
`;
if (!admin.includes('handleResolveTicket')) {
   admin = admin.replace(/(const handleSaveConfig = async \(\) => \{)/, resolveTix + "\n  $1");
}

// Add the 'support' tab to the UI
const supportTabButton = `
            <button
              onClick={() => setActiveTab('support')}
              className={\`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all \${
                activeTab === 'support' ? 'bg-[#232326] text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }\`}
            >
              <div className="flex items-center gap-3">
                <LifeBuoy className="w-4 h-4" />
                <span className="text-sm font-medium">Suporte</span>
              </div>
              {supportTickets.filter(t => t.status === 'aberto').length > 0 && (
                <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {supportTickets.filter(t => t.status === 'aberto').length}
                </div>
              )}
            </button>
`;
if (!admin.includes("setActiveTab('support')")) {
   admin = admin.replace(/(<button[\s\S]*?onClick=\{\(\) => setActiveTab\('logs'\)\}[\s\S]*?<\/button>)/, "$1\n" + supportTabButton);
}

// Support Tab Content
const supportTabContent = `
          {activeTab === 'support' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Tickets de Suporte</h3>
                  <p className="text-sm text-neutral-400 mt-1">Reclamações e solicitações de usuários via chatbot de suporte.</p>
                </div>
              </div>

              <div className="space-y-4">
                {supportTickets.length === 0 ? (
                  <div className="text-center py-10 bg-neutral-900/50 rounded-2xl border border-neutral-800">
                    <LifeBuoy className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                    <p className="text-neutral-400">Nenhum ticket de suporte registrado.</p>
                  </div>
                ) : (
                  supportTickets.map(ticket => (
                    <div key={ticket.id} className={\`p-5 rounded-2xl border \${ticket.status === 'aberto' ? 'bg-red-500/5 border-red-500/20' : 'bg-neutral-900/50 border-neutral-800'}\`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={\`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md \${ticket.category === 'billing' ? 'bg-orange-500/20 text-orange-400' : ticket.category === 'bug' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}\`}>
                              {ticket.category}
                            </span>
                            <span className="text-xs text-neutral-500">
                              {new Date(ticket.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-neutral-300">
                            Usuário: <span className="text-white">{ticket.email || ticket.userId}</span>
                          </div>
                        </div>
                        {ticket.status === 'aberto' ? (
                          <button onClick={() => handleResolveTicket(ticket.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg text-xs font-bold transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Resolver
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-lg flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Resolvido
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-neutral-400 bg-black/20 p-3 rounded-xl border border-white/5">
                        {ticket.details}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
`;
if (!admin.includes("activeTab === 'support'")) {
   admin = admin.replace(/({\/\* LOGS \*\/})/, supportTabContent + "\n          $1");
}

fs.writeFileSync('src/components/AdminPanel.tsx', admin);
console.log("Admin updated.");
