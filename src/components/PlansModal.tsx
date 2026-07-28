import React, { useState } from 'react';
import { X, Check, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { UserSettings } from '../types';

interface PlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onOpenCheckout?: (plan: string) => Promise<void> | void;
}

export const PlansModal: React.FC<PlansModalProps> = ({
  isOpen,
  onClose,
  settings,
  onOpenCheckout,
}) => {
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'annual' | null>(null);

  if (!isOpen) return null;

  const handleSubscribe = async (plan: 'monthly' | 'annual') => {
    setLoadingPlan(plan);
    try {
      if (onOpenCheckout) {
        await onOpenCheckout(plan);
      } else {
        const res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            plan: plan === 'annual' ? 'annual' : 'monthly', 
            email: settings?.userEmail || '', 
            hasUsedFreeTrial: settings?.hasUsedFreeTrial 
          })
        });
        const data = await res.json();
        if (data.url) {
          window.open(data.url, '_blank');
        } else {
          alert(data.error || 'Erro ao iniciar o checkout.');
        }
      }
    } catch (err) {
      alert('Erro ao processar assinatura. Tente novamente.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn" 
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl bg-[#121215] rounded-t-[32px] sm:rounded-3xl shadow-2xl p-6 sm:p-10 max-h-[92vh] overflow-y-auto border border-neutral-800 animate-slideUp sm:animate-none" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle */}
        <div className="w-full flex justify-center pb-4 sm:hidden">
          <div className="w-12 h-1.5 bg-neutral-700 rounded-full"></div>
        </div>

        <div className="flex justify-between items-start mb-8">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ZENO Pro Oficial</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">Escolha seu plano</h2>
            <p className="text-neutral-400 text-sm">Desbloqueie todo o poder dos modelos avançados, geração de imagens e recursos ilimitados.</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1 - Mensal */}
          <div className="border border-neutral-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:border-neutral-700 transition-all duration-300 bg-neutral-950/60 shadow-lg relative group">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Plano Mensal</h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-300 font-medium">Flexível</span>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
                R$ 39,90 <span className="text-sm font-normal text-neutral-400">/mês</span>
              </div>
              <p className="text-neutral-400 text-sm mb-6">Ideal para quem deseja flexibilidade total sem compromisso de longo prazo.</p>
              
              <ul className="space-y-3.5 mb-8">
                {[
                  'Todos os modelos Premium (Claude 3.5, GPT-4o, Gemini Pro)',
                  'Respostas prioritárias na velocidade máxima',
                  'Geração de imagens ilimitada em alta definição',
                  'Pesquisa Web avançada em tempo real',
                  'Upload de arquivos e documentos',
                  'Cancelamento a qualquer momento'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start text-neutral-300 text-sm">
                    <Check className="w-4 h-4 text-white mr-3 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 pt-4 border-t border-neutral-800/80">
              <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                <span>Teste grátis de 30 dias</span>
                <span className="text-emerald-400 font-medium">Sem compromisso</span>
              </div>
              <button
                onClick={() => handleSubscribe('monthly')}
                disabled={loadingPlan !== null}
                className="w-full bg-white text-black py-4 rounded-2xl font-semibold hover:bg-neutral-200 active:scale-[0.98] transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                {loadingPlan === 'monthly' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processando assinatura...</span>
                  </>
                ) : (
                  <span>Assinar Plano Mensal</span>
                )}
              </button>
            </div>
          </div>

          {/* Card 2 - Anual */}
          <div className="border border-neutral-600 rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative bg-gradient-to-b from-neutral-900 to-neutral-950 text-white shadow-2xl group ring-1 ring-white/20">
            <div className="absolute -top-3.5 left-6 bg-white text-black text-[11px] uppercase tracking-wider px-3.5 py-1 rounded-full font-bold shadow-md flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>⭐ Melhor Custo-Benefício</span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4 mt-2">
                <h3 className="text-lg font-semibold">Plano Anual</h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-emerald-400 font-medium border border-emerald-500/30">Economize ~17%</span>
              </div>
              <div className="text-3xl sm:text-4xl font-bold mb-2 tracking-tight">
                R$ 399,90 <span className="text-sm font-normal text-neutral-400">/ano</span>
              </div>
              <p className="text-neutral-300 text-sm mb-6">Para usuários dedicados que buscam máxima produtividade com desconto exclusivo.</p>
              
              <ul className="space-y-3.5 mb-8">
                {[
                  'Todos os recursos Premium ilimitados',
                  'Prioridade máxima no servidor e menor latência',
                  'Acesso antecipado a novos recursos e modelos',
                  'Suporte VIP prioritário 24/7',
                  'Economia de quase dois meses no ano'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start text-neutral-200 text-sm">
                    <Check className="w-4 h-4 text-emerald-400 mr-3 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 pt-4 border-t border-neutral-800">
              <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                <span>Teste grátis de 30 dias</span>
                <span className="text-emerald-400 font-medium">Garantia de 30 dias</span>
              </div>
              <button
                onClick={() => handleSubscribe('annual')}
                disabled={loadingPlan !== null}
                className="w-full bg-white text-black py-4 rounded-2xl font-semibold hover:bg-neutral-200 active:scale-[0.98] transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2 text-sm shadow-xl"
              >
                {loadingPlan === 'annual' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Processando assinatura anual...</span>
                  </>
                ) : (
                  <span>Assinar Plano Anual</span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-neutral-400 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Pagamento 100% seguro processado pelo Stripe com criptografia SSL.</span>
          </div>
          <span>Cancele a qualquer momento nas configurações da conta.</span>
        </div>
      </div>
    </div>
  );
};

