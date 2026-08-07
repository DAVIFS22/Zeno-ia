const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

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

if (!code.includes("Tickets de Suporte")) {
  code = code.replace(/(\{\/\* LOGS \*\/\})/, supportTabContent + "\n          $1");
  fs.writeFileSync('src/components/AdminPanel.tsx', code);
}
