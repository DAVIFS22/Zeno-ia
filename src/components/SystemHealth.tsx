import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Info, XCircle, RefreshCw } from 'lucide-react';
import { ProviderName } from '../services/ai/types';

interface SystemHealthProps {
  isDark?: boolean;
}

export function SystemHealth({ isDark = true }: SystemHealthProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [healthData, setHealthData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  
  useEffect(() => {
    let mounted = true;
    const fetchHealth = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/admin/debug/health');
        if (!res.ok) throw new Error('Failed to fetch health');
        const data = await res.json();
        if (mounted) {
          setHealthData(data);
        }
      } catch (err) {
        console.error("Failed to fetch system health:", err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    fetchHealth();
    return () => { mounted = false; };
  }, [refreshKey]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'attention': return <Info className="w-4 h-4 text-yellow-500" />;
      case 'reduce_priority': 
      case 'avoid': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'exhausted':
      case 'billing_error':
      case 'rate_limited': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Activity className="w-4 h-4 text-neutral-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-green-500';
      case 'attention': return 'text-yellow-500';
      case 'reduce_priority': 
      case 'avoid': return 'text-orange-500';
      case 'exhausted':
      case 'billing_error':
      case 'rate_limited': return 'text-red-500';
      default: return 'text-neutral-400';
    }
  };

  const handleReset = async () => {
    if (confirm('Deseja resetar todos os circuitos e quotas?')) {
      setIsResetting(true);
      try {
        await fetch('/api/admin/reset-resilience', { method: 'POST' });
        setRefreshKey(prev => prev + 1);
      } catch (err) {
        console.error("Failed to reset resilience", err);
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#17171a] border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'} space-y-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${isDark ? 'text-zeno' : 'text-zeno'}`} />
          <h3 className="text-sm font-bold">Status dos Provedores IA</h3>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setRefreshKey(prev => prev + 1)}
            disabled={isLoading}
            className={`p-1.5 rounded-lg hover:bg-neutral-500/10 text-neutral-400 transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Atualizar Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isResetting ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleReset}
            disabled={isResetting || isLoading}
            className={`text-[10px] font-bold text-zeno hover:underline ${isResetting ? 'opacity-50' : ''}`}
          >
            {isResetting ? 'Resetando...' : 'Resetar Tudo'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading && healthData.length === 0 ? (
          <div className="text-xs text-neutral-500 text-center py-4">Carregando status...</div>
        ) : (
          healthData.map(item => (
            <div key={item.provider} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(item.quota?.status)}
                  <span className="text-xs font-bold uppercase tracking-tight">{item.provider}</span>
                </div>
                <span className={`text-[10px] font-bold uppercase ${getStatusColor(item.quota?.status)}`}>
                  {item.quota?.status?.replace('_', ' ')}
                </span>
              </div>
              
              <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    item.quota?.remainingPercentage > 50 ? 'bg-green-500' : item.quota?.remainingPercentage > 20 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${item.quota?.remainingPercentage || 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[9px] text-neutral-500 font-medium">
                <span>Cota: {item.quota?.remainingPercentage || 0}%</span>
                <span>Saúde: {((item.metrics?.healthScore || 0) * 100).toFixed(0)}%</span>
                <span>Erros: {item.metrics?.errors || 0}/{item.metrics?.requests || 0}</span>
              </div>

              {item.quota?.lastError && (
                <div className="mt-1 p-1.5 rounded bg-red-500/5 border border-red-500/10">
                  <p className="text-[9px] text-red-400 leading-tight italic truncate" title={item.quota.lastError}>
                    Último erro: {item.quota.lastError}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="pt-2 border-t border-[#2C2C2E]/60">
        <p className="text-[10px] text-neutral-500 leading-relaxed italic">
          * ZENO utiliza um sistema de redundância inteligente. Se um provedor falha, o sistema alterna automaticamente para o próximo melhor disponível.
        </p>
      </div>
    </div>
  );
}
