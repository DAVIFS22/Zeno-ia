const fs = require('fs');
let settings = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

settings = settings.replace(
  "const categories = [",
  `const isAdmin = settings.userEmail === 'davifernandes0024509@gmail.com';
  const categories = [`
);

settings = settings.replace(
  "    { id: 'privacy', label: 'Privacidade', icon: Shield },\n  ];",
  `    { id: 'privacy', label: 'Privacidade', icon: Shield },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: Lock }] : []),
  ];`
);

const adminConfigState = `
  const [adminLimitsForm, setAdminLimitsForm] = React.useState(adminConfig || {
    messages: 50, search: 20, image: 10, doc: 5, vision: 10
  });

  const handleSaveAdminConfig = async () => {
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { limits: adminLimitsForm } })
      });
      if (res.ok) alert('Configurações do Admin salvas com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar configurações do Admin.');
    }
  };
`;

settings = settings.replace(
  "const isPro = settings.plan === 'ZENO Pro';",
  "const isPro = settings.plan === 'ZENO Pro';\n" + adminConfigState
);

const adminUI = `
            {activeCategory === 'admin' && isAdmin && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 text-red-500 mb-6">
                  <Lock className="w-5 h-5" />
                  <h3 className="text-xl font-semibold">Painel Administrativo</h3>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-neutral-400">Limites do Plano Gratuito (Diário)</h4>
                  
                  <div className="space-y-4 bg-white/5 dark:bg-black/20 p-4 rounded-xl border border-gray-200 dark:border-white/10">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Mensagens</span>
                      <input type="number" className="w-20 bg-gray-100 dark:bg-[#232323] border border-gray-300 dark:border-[#313131] rounded-lg px-2 py-1 text-sm outline-none focus:border-red-500" value={adminLimitsForm.messages} onChange={(e) => setAdminLimitsForm({...adminLimitsForm, messages: Number(e.target.value)})} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Pesquisa Web</span>
                      <input type="number" className="w-20 bg-gray-100 dark:bg-[#232323] border border-gray-300 dark:border-[#313131] rounded-lg px-2 py-1 text-sm outline-none focus:border-red-500" value={adminLimitsForm.search} onChange={(e) => setAdminLimitsForm({...adminLimitsForm, search: Number(e.target.value)})} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Imagens</span>
                      <input type="number" className="w-20 bg-gray-100 dark:bg-[#232323] border border-gray-300 dark:border-[#313131] rounded-lg px-2 py-1 text-sm outline-none focus:border-red-500" value={adminLimitsForm.image} onChange={(e) => setAdminLimitsForm({...adminLimitsForm, image: Number(e.target.value)})} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Análise de PDF</span>
                      <input type="number" className="w-20 bg-gray-100 dark:bg-[#232323] border border-gray-300 dark:border-[#313131] rounded-lg px-2 py-1 text-sm outline-none focus:border-red-500" value={adminLimitsForm.doc} onChange={(e) => setAdminLimitsForm({...adminLimitsForm, doc: Number(e.target.value)})} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Visão</span>
                      <input type="number" className="w-20 bg-gray-100 dark:bg-[#232323] border border-gray-300 dark:border-[#313131] rounded-lg px-2 py-1 text-sm outline-none focus:border-red-500" value={adminLimitsForm.vision} onChange={(e) => setAdminLimitsForm({...adminLimitsForm, vision: Number(e.target.value)})} />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                  <button onClick={handleSaveAdminConfig} className="w-full bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl py-3 transition-colors">
                    Salvar Configurações do Servidor
                  </button>
                </div>
              </div>
            )}
`;

settings = settings.replace(
  "{activeCategory === 'privacy' && (",
  adminUI + "\n            {activeCategory === 'privacy' && ("
);

// We need to support 'admin' category in types
settings = settings.replace(
  "const [activeCategory, setActiveCategory] = useState<'account' | 'customization' | 'ai' | 'privacy'>('account');",
  "const [activeCategory, setActiveCategory] = useState<'account' | 'customization' | 'ai' | 'privacy' | 'admin'>('account');"
);

fs.writeFileSync('src/components/SettingsModal.tsx', settings);
