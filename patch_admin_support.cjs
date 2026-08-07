const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const supportContent = `
      {/* SUB-TAB: SUPORTE */}
      {activeTab === 'support' && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Tickets de Suporte</h3>
            <p className="text-sm text-neutral-400 mt-1">Reclamações e solicitações de usuários via chatbot de suporte.</p>
          </div>

          <div className="space-y-4">
            {supportTickets.length === 0 ? (
              <div className="text-center py-12 bg-white/5 border border-white/10 rounded-2xl">
                <LifeBuoy className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
                <p className="text-neutral-400 font-medium">Nenhum ticket de suporte registrado.</p>
              </div>
            ) : (
              supportTickets.map(ticket => (
                <div key={ticket.id} className={\`p-5 rounded-2xl border \${ticket.status === 'aberto' ? 'bg-white/[0.02] border-white/10' : 'bg-transparent border-white/5'}\`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={\`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md \${ticket.category === 'billing' ? 'bg-neutral-800 text-neutral-300' : ticket.category === 'bug' ? 'bg-red-500/10 text-red-400' : 'bg-white/10 text-neutral-300'}\`}>
                          {ticket.category}
                        </span>
                        <span className="text-xs text-neutral-500 font-medium">
                          {new Date(ticket.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-neutral-300">
                        Usuário: <span className="text-white">{ticket.email || ticket.userId}</span>
                      </div>
                    </div>
                    {ticket.status === 'aberto' ? (
                      <button onClick={() => handleResolveTicket(ticket.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-neutral-200 rounded-lg text-xs font-bold transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Marcar Resolvido
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-neutral-500 bg-white/5 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Resolvido
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-neutral-300 bg-[#121214] p-4 rounded-xl border border-white/5 leading-relaxed">
                    {ticket.details}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
`;

code = code.replace(/(\{ \/\* SUB-TAB 7: RBAC CONTROL \*\/ \})/g, supportContent + "\n      $1");
fs.writeFileSync('src/components/AdminPanel.tsx', code);
