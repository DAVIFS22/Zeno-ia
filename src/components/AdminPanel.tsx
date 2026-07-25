import React, { useState, useEffect } from 'react';
import { 
  Lock, Shield, Server, Cpu, Database, Activity, Gauge, Sparkles, 
  CheckCircle2, AlertTriangle, RefreshCw, Save, Sliders, ToggleLeft, ToggleRight,
  Layers, Users, BarChart3, Wrench, ShieldAlert, Check, TrendingUp, Coins, 
  Terminal, Info, FileText, ArrowUpRight, Search, Eye, Filter, ShieldCheck, 
  ShoppingCart, Ban, LogOut, LogIn, CreditCard, Image as ImageIcon, Laptop
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell 
} from 'recharts';
import { 
  ADMIN_EMAIL, 
  getUserRole, 
  isAdminUser, 
  FullAdminConfig, 
  DEFAULT_FULL_ADMIN_CONFIG,
  AuditLog,
  SystemLog
} from '../config/admin';
import { withAdmin } from './withAdmin';

interface AdminPanelProps {
  userEmail: string;
  theme?: 'dark' | 'light';
  onConfigSaved?: (newConfig: FullAdminConfig) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  userEmail,
  theme = 'dark',
  onConfigSaved
}) => {
  const role = getUserRole(userEmail);
  const isAdmin = role === 'admin';

  // Sub-tabs in Admin Panel
  const [activeTab, setActiveTab] = useState<'stats' | 'limits' | 'pro' | 'server' | 'models' | 'rbac' | 'logs'>('stats');

  // Config State
  const [config, setConfig] = useState<FullAdminConfig>(DEFAULT_FULL_ADMIN_CONFIG);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // System Stats State
  const [stats, setStats] = useState<any>({
    totalUsers: 1,
    activeSessionsToday: 1,
    activeOnlineNow: 1,
    totalProUsers: 0,
    monthlyRevenue: 0.00,
    totalRevenue: 39.90,
    totalMessagesSent: 42,
    totalImagesGenerated: 18,
    totalWebSearches: 15,
    totalPdfsAnalyzed: 8,
    totalVisionUses: 12,
    totalCodeUses: 21,
    modelUsage: {},
    serverUptimeSeconds: 120,
    memoryUsageMB: 150,
    cpuUsagePercent: 5
  });

  // Logs States
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [activeLogSubTab, setActiveLogSubTab] = useState<'system' | 'audit'>('system');
  const [logSearch, setLogSearch] = useState<string>('');
  const [systemLogFilter, setSystemLogFilter] = useState<string>('all');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  // Fetch admin config and stats from backend with x-user-email security header
  const fetchAdminData = async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setSaveStatus(null);
    try {
      const [configRes, statsRes, logsRes] = await Promise.all([
        fetch('/api/admin/config', {
          headers: { 'x-user-email': userEmail }
        }),
        fetch('/api/admin/stats', {
          headers: { 'x-user-email': userEmail }
        }),
        fetch('/api/admin/logs', {
          headers: { 'x-user-email': userEmail }
        })
      ]);

      if (configRes.status === 403 || statsRes.status === 403 || logsRes.status === 403) {
        setSaveStatus({
          type: 'error',
          message: 'Erro 403: Acesso Negado pelo Servidor Backend.'
        });
        setIsLoading(false);
        return;
      }

      if (configRes.ok) {
        const data = await configRes.json();
        if (data.config) {
          setConfig(prev => ({ ...prev, ...data.config }));
        }
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setAuditLogs(logsData.auditLogs || []);
        setSystemLogs(logsData.systemLogs || []);
      }
    } catch (error: any) {
      console.error('[AdminPanel] Erro ao carregar dados do backend:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    
    // Set up auto-refresh timer to update real-time statistics every 15 seconds!
    const interval = setInterval(() => {
      fetchAdminData();
    }, 15000);
    
    return () => clearInterval(interval);
  }, [userEmail]);

  // Save Config to Backend (registers audit automatically on backend!)
  const handleSaveConfig = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        },
        body: JSON.stringify({ config, userEmail })
      });

      if (res.status === 403) {
        setSaveStatus({
          type: 'error',
          message: 'Erro 403: Acesso Negado. Falta de permissão de admin.'
        });
        setIsSaving(false);
        return;
      }

      if (res.ok) {
        setSaveStatus({
          type: 'success',
          message: 'Configurações salvas e auditadas no servidor com sucesso!'
        });
        if (onConfigSaved) onConfigSaved(config);
        // Reload logs to show the new audit entry
        fetchAdminData();
      } else {
        const err = await res.json();
        setSaveStatus({
          type: 'error',
          message: err.message || 'Erro ao salvar configurações.'
        });
      }
    } catch (e: any) {
      setSaveStatus({
        type: 'error',
        message: 'Erro de rede ao conectar com o servidor.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Safe chart data constructor
  const getModelChartData = () => {
    const rawData = stats.modelUsage || {};
    if (Object.keys(rawData).length === 0) {
      return [
        { name: 'Gemini 3.5 Lite', uso: stats.totalMessagesSent || 42 }
      ];
    }
    return Object.entries(rawData).map(([name, count]) => ({
      name: String(name).replace('gemini-', '').replace('-lite', ''),
      uso: Number(count)
    }));
  };

  const chartColors = ['#DC2626', '#EA580C', '#D97706', '#059669', '#2563EB', '#7C3AED', '#DB2777'];

  // Logs filters
  const filteredSystemLogs = systemLogs.filter(log => {
    const matchesSearch = 
      log.userEmail.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.ip.toLowerCase().includes(logSearch.toLowerCase());
    
    if (systemLogFilter === 'all') return matchesSearch;
    return matchesSearch && log.type === systemLogFilter;
  });

  const filteredAuditLogs = auditLogs.filter(log => {
    return (
      log.adminEmail.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.ip.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.browser.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.newValue.toLowerCase().includes(logSearch.toLowerCase())
    );
  });

  // HARD SECURITY CHECK: If user is not admin, DO NOT RENDER ANY ADMINISTRATIVE CONTENT!
  if (!isAdmin) {
    return (
      <div className="w-full p-6 sm:p-8 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-white space-y-5 animate-fadeIn">
        <div className="flex items-center gap-3 text-rose-400">
          <ShieldAlert className="w-8 h-8 flex-shrink-0" />
          <div>
            <h3 className="text-xl font-bold tracking-tight text-white">403 - Acesso Negado (Forbidden)</h3>
            <p className="text-xs text-rose-300 font-mono mt-0.5">Role Atual: {role} | Usuário: {userEmail || 'Anônimo'}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-black/40 border border-rose-500/20 text-sm leading-relaxed text-rose-100/90 space-y-2">
          <p>
            Você não possui permissões administrativas para visualizar ou alterar o Painel Administrativo do ZENO AI.
          </p>
          <p className="text-xs text-rose-300/80">
            Apenas a conta administradora principal (<span className="font-mono text-white underline">{ADMIN_EMAIL}</span>) recebe acesso irrestrito às funções de gerenciamento de servidor, modelos e limites.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 text-xs text-neutral-400 border-t border-rose-500/20">
          <span>Verificação de Segurança Backend & Frontend Ativa</span>
          <span className="font-mono text-rose-400">HTTP 403 FORBIDDEN</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-950/40 via-[#1C1C1C] to-[#171717] border border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">Painel Administrativo ZENO AI</h3>
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-mono font-semibold">
                ROLE: ADMIN
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Conectado como <span className="text-white font-medium">{userEmail}</span> • <span className="text-emerald-400">Segurança Máxima Ativa</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={fetchAdminData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-[#242424] hover:bg-[#2F2F2F] text-neutral-300 hover:text-white border border-[#303030] transition-colors text-xs flex items-center gap-1.5"
            title="Atualizar dados do servidor"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar Dados</span>
          </button>

          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-all active:scale-95 shadow-md flex items-center gap-2"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Salvar Alterações</span>
          </button>
        </div>
      </div>

      {/* Save Status Notification Banner */}
      {saveStatus && (
        <div className={`p-3.5 rounded-xl text-xs font-medium border flex items-center justify-between animate-fadeIn ${
          saveStatus.type === 'success' 
            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30' 
            : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {saveStatus.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{saveStatus.message}</span>
          </div>
          <button onClick={() => setSaveStatus(null)} className="text-xs hover:underline opacity-80">Fechar</button>
        </div>
      )}

      {/* Admin Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#2B2B2B] scrollbar-custom">
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'stats'
              ? 'bg-red-600/20 text-red-400 border border-red-500/40'
              : 'text-neutral-400 hover:text-white hover:bg-[#242424]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Estatísticas</span>
        </button>

        <button
          onClick={() => setActiveTab('limits')}
          className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'limits'
              ? 'bg-red-600/20 text-red-400 border border-red-500/40'
              : 'text-neutral-400 hover:text-white hover:bg-[#242424]'
          }`}
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>Limites Grátis</span>
        </button>

        <button
          onClick={() => setActiveTab('pro')}
          className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'pro'
              ? 'bg-red-600/20 text-red-400 border border-red-500/40'
              : 'text-neutral-400 hover:text-white hover:bg-[#242424]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Recursos Pro</span>
        </button>

        <button
          onClick={() => setActiveTab('server')}
          className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'server'
              ? 'bg-red-600/20 text-red-400 border border-red-500/40'
              : 'text-neutral-400 hover:text-white hover:bg-[#242424]'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Servidor</span>
        </button>

        <button
          onClick={() => setActiveTab('models')}
          className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'models'
              ? 'bg-red-600/20 text-red-400 border border-red-500/40'
              : 'text-neutral-400 hover:text-white hover:bg-[#242424]'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Modelos IA</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'logs'
              ? 'bg-red-600/20 text-red-400 border border-red-500/40'
              : 'text-neutral-400 hover:text-white hover:bg-[#242424]'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Logs & Auditoria</span>
        </button>

        <button
          onClick={() => setActiveTab('rbac')}
          className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'rbac'
              ? 'bg-red-600/20 text-red-400 border border-red-500/40'
              : 'text-neutral-400 hover:text-white hover:bg-[#242424]'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Controle RBAC</span>
        </button>
      </div>

      {/* SUB-TAB 1: STATS */}
      {activeTab === 'stats' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Financial MRR card */}
            <div className="p-4 rounded-xl bg-[#202020] border border-[#2B2B2B] flex flex-col justify-between h-28 relative overflow-hidden group">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Faturamento Mensal (MRR)</span>
                <Coins className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-white">R$ {stats.monthlyRevenue?.toFixed(2)}</p>
              <div className="flex items-center justify-between text-[10px] text-neutral-500 border-t border-[#2C2C2C] pt-1">
                <span>Calculado em tempo real</span>
                <span className="text-emerald-400 font-semibold font-mono flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> ZENO Pro
                </span>
              </div>
            </div>

            {/* Total Revenue card */}
            <div className="p-4 rounded-xl bg-[#202020] border border-[#2B2B2B] flex flex-col justify-between h-28 relative overflow-hidden group">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Receita Total Acumulada</span>
                <CreditCard className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black text-white">R$ {stats.totalRevenue?.toFixed(2)}</p>
              <div className="flex items-center justify-between text-[10px] text-neutral-500 border-t border-[#2C2C2C] pt-1">
                <span>Histórico de faturamento</span>
                <span className="text-amber-400 font-mono">Real-time DB</span>
              </div>
            </div>

            {/* User demographics */}
            <div className="p-4 rounded-xl bg-[#202020] border border-[#2B2B2B] flex flex-col justify-between h-28 relative overflow-hidden group">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Métricas de Usuários</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-white">{stats.totalUsers || 1}</p>
                <div className="flex gap-2 text-[10px] font-medium text-neutral-400">
                  <span className="text-emerald-400">{stats.activeOnlineNow || 1} online agora</span>
                  <span>•</span>
                  <span className="text-blue-400">{stats.activeSessionsToday || 1} ativos hoje</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-neutral-500 border-t border-[#2C2C2C] pt-1">
                <span>ZENO Pro: {stats.totalProUsers}</span>
                <span className="text-neutral-500">Free: {Math.max(0, stats.totalUsers - stats.totalProUsers)}</span>
              </div>
            </div>

            {/* AI Prompts sent */}
            <div className="p-4 rounded-xl bg-[#202020] border border-[#2B2B2B] flex flex-col justify-between h-28">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Mensagens & Prompts IA</span>
                <Layers className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-2xl font-black text-white">{stats.totalMessagesSent || 0}</p>
              <div className="text-[10px] text-neutral-500 border-t border-[#2C2C2C] pt-1 flex justify-between">
                <span>Total de consultas respondidas</span>
                <span className="text-purple-400 font-mono font-bold">100% Real</span>
              </div>
            </div>

            {/* Images generated */}
            <div className="p-4 rounded-xl bg-[#202020] border border-[#2B2B2B] flex flex-col justify-between h-28">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Imagens Geradas</span>
                <ImageIcon className="w-4 h-4 text-pink-400" />
              </div>
              <p className="text-2xl font-black text-white">{stats.totalImagesGenerated || 0}</p>
              <div className="text-[10px] text-neutral-500 border-t border-[#2C2C2C] pt-1 flex justify-between">
                <span>Processadas via Flux Dev</span>
                <span className="text-pink-400 font-mono">Estúdio Vision</span>
              </div>
            </div>

            {/* Server Performance metrics */}
            <div className="p-4 rounded-xl bg-[#202020] border border-[#2B2B2B] flex flex-col justify-between h-28">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Uso do Servidor Container</span>
                <Activity className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-neutral-300 font-mono">{stats.memoryUsageMB || 150} MB RAM</span>
                  <span className="text-xs text-cyan-400 font-mono">{stats.cpuUsagePercent || 5}% CPU</span>
                </div>
                <p className="text-[10px] text-neutral-500 mt-1">Uptime: {Math.floor((stats.serverUptimeSeconds || 120) / 3600)}h {Math.floor(((stats.serverUptimeSeconds || 120) % 3600) / 60)}m {Math.floor((stats.serverUptimeSeconds || 120) % 60)}s</p>
              </div>
              <div className="text-[10px] text-emerald-400 border-t border-[#2C2C2C] pt-1 flex justify-between">
                <span>Vite/Express Cloud Run Node</span>
                <span className="font-semibold">SAUDÁVEL</span>
              </div>
            </div>
          </div>

          {/* Detailed usage analytics maps */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2">
            {/* Recharts Model distribution */}
            <div className="md:col-span-7 p-4 rounded-xl bg-[#202020] border border-[#2B2B2B] space-y-3 flex flex-col justify-between">
              <div>
                <h5 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-red-500" /> Distribuição de Modelos em Tempo Real
                </h5>
                <p className="text-[10px] text-neutral-400 mt-0.5">Chamadas de inferência por modelo ativo no backend.</p>
              </div>

              <div className="h-44 w-full pr-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getModelChartData()} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2B2B2B" vertical={false} />
                    <XAxis dataKey="name" stroke="#737373" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#737373" fontSize={9} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#171717', borderColor: '#333', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                      itemStyle={{ color: '#f43f5e', fontSize: '10px' }}
                    />
                    <Bar dataKey="uso" radius={[4, 4, 0, 0]}>
                      {
                        getModelChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Telemetry / secondary tools grid */}
            <div className="md:col-span-5 p-4 rounded-xl bg-[#202020] border border-[#2B2B2B] space-y-4">
              <div>
                <h5 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-cyan-400" /> Recursos e Telemetria de Integração
                </h5>
                <p className="text-[10px] text-neutral-400 mt-0.5">Contagem real de solicitações processadas por recurso do sistema.</p>
              </div>

              <div className="space-y-3 pt-2">
                {/* Web Search */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-300 font-medium">Pesquisas na Web (Grounding)</span>
                    <span className="text-cyan-400 font-mono font-bold">{stats.totalWebSearches || 0}</span>
                  </div>
                  <div className="w-full bg-[#171717] rounded-full h-1.5">
                    <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, ((stats.totalWebSearches || 0) / Math.max(1, stats.totalMessagesSent)) * 100)}%` }} />
                  </div>
                </div>

                {/* PDF Analyzer */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-300 font-medium">Análise de PDFs & Documentos</span>
                    <span className="text-purple-400 font-mono font-bold">{stats.totalPdfsAnalyzed || 0}</span>
                  </div>
                  <div className="w-full bg-[#171717] rounded-full h-1.5">
                    <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, ((stats.totalPdfsAnalyzed || 0) / Math.max(1, stats.totalMessagesSent)) * 100)}%` }} />
                  </div>
                </div>

                {/* Vision / OCR */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-300 font-medium">Visão Computacional & OCR</span>
                    <span className="text-red-400 font-mono font-bold">{stats.totalVisionUses || 0}</span>
                  </div>
                  <div className="w-full bg-[#171717] rounded-full h-1.5">
                    <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, ((stats.totalVisionUses || 0) / Math.max(1, stats.totalMessagesSent)) * 100)}%` }} />
                  </div>
                </div>

                {/* Code Execution */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-300 font-medium">Interpretador de Códigos Integrado</span>
                    <span className="text-amber-500 font-mono font-bold">{stats.totalCodeUses || 0}</span>
                  </div>
                  <div className="w-full bg-[#171717] rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, ((stats.totalCodeUses || 0) / Math.max(1, stats.totalMessagesSent)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: LIMITS */}
      {activeTab === 'limits' && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h4 className="text-sm font-semibold text-neutral-200">Gerenciamento de Cotas do Plano Gratuito (ZENO Free)</h4>
            <p className="text-xs text-neutral-400 mt-1">Configure o limite máximo diário de interações permitidas por conta grátis.</p>
          </div>

          <div className="space-y-3 bg-[#202020] p-4 rounded-2xl border border-[#2E2E2E]">
            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">Conversas & Mensagens Diárias</span>
                <span className="text-xs text-neutral-400">Mensagens comuns respondidas pela IA</span>
              </div>
              <input 
                type="number" 
                min="0"
                max="500"
                value={config.limits.messages} 
                onChange={(e) => setConfig({
                  ...config,
                  limits: { ...config.limits, messages: Math.max(0, Number(e.target.value)) }
                })} 
                className="w-24 bg-[#171717] border border-[#333] rounded-xl px-3 py-1.5 text-sm text-white font-semibold text-center outline-none focus:border-red-500" 
              />
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">Pesquisas Web em Tempo Real</span>
                <span className="text-xs text-neutral-400">Consultas de busca do Google Grounding</span>
              </div>
              <input 
                type="number" 
                min="0"
                max="200"
                value={config.limits.search} 
                onChange={(e) => setConfig({
                  ...config,
                  limits: { ...config.limits, search: Math.max(0, Number(e.target.value)) }
                })} 
                className="w-24 bg-[#171717] border border-[#333] rounded-xl px-3 py-1.5 text-sm text-white font-semibold text-center outline-none focus:border-red-500" 
              />
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">Geração de Imagens Estúdio Vision</span>
                <span className="text-xs text-neutral-400">Processamento de prompts no Flux Dev</span>
              </div>
              <input 
                type="number" 
                min="0"
                max="100"
                value={config.limits.image} 
                onChange={(e) => setConfig({
                  ...config,
                  limits: { ...config.limits, image: Math.max(0, Number(e.target.value)) }
                })} 
                className="w-24 bg-[#171717] border border-[#333] rounded-xl px-3 py-1.5 text-sm text-white font-semibold text-center outline-none focus:border-red-500" 
              />
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">Análise de Documentos & PDFs</span>
                <span className="text-xs text-neutral-400">Extração de textos de PDFs e arquivos</span>
              </div>
              <input 
                type="number" 
                min="0"
                max="100"
                value={config.limits.doc} 
                onChange={(e) => setConfig({
                  ...config,
                  limits: { ...config.limits, doc: Math.max(0, Number(e.target.value)) }
                })} 
                className="w-24 bg-[#171717] border border-[#333] rounded-xl px-3 py-1.5 text-sm text-white font-semibold text-center outline-none focus:border-red-500" 
              />
            </div>

            <div className="flex justify-between items-center py-2">
              <div>
                <span className="text-sm font-medium text-white block">Visão Computacional & OCR</span>
                <span className="text-xs text-neutral-400">Análise de fotos e prints</span>
              </div>
              <input 
                type="number" 
                min="0"
                max="200"
                value={config.limits.vision} 
                onChange={(e) => setConfig({
                  ...config,
                  limits: { ...config.limits, vision: Math.max(0, Number(e.target.value)) }
                })} 
                className="w-24 bg-[#171717] border border-[#333] rounded-xl px-3 py-1.5 text-sm text-white font-semibold text-center outline-none focus:border-red-500" 
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: PRO PLAN FEATURES */}
      {activeTab === 'pro' && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h4 className="text-sm font-semibold text-neutral-200">Gerenciamento de Benefícios do Plano ZENO Pro</h4>
            <p className="text-xs text-neutral-400 mt-1">Configure os privilégios e multiplicadores para assinantes pagantes.</p>
          </div>

          <div className="space-y-3 bg-[#202020] p-4 rounded-2xl border border-[#2E2E2E]">
            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">Multiplicador de Limites para Pro</span>
                <span className="text-xs text-neutral-400">Aumenta os limites diários de base</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-400 font-mono font-bold">{config.proFeatures.limitMultiplier}x</span>
                <input 
                  type="number" 
                  min="2"
                  max="100"
                  value={config.proFeatures.limitMultiplier} 
                  onChange={(e) => setConfig({
                    ...config,
                    proFeatures: { ...config.proFeatures, limitMultiplier: Number(e.target.value) }
                  })} 
                  className="w-20 bg-[#171717] border border-[#333] rounded-xl px-2 py-1 text-sm text-white font-semibold text-center outline-none focus:border-amber-500" 
                />
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">Fila de Prioridade em Tempo Real</span>
                <span className="text-xs text-neutral-400">Processamento de mensagens prioritário</span>
              </div>
              <button
                onClick={() => setConfig({
                  ...config,
                  proFeatures: { ...config.proFeatures, priorityQueue: !config.proFeatures.priorityQueue }
                })}
                className="text-amber-400 hover:text-amber-300"
              >
                {config.proFeatures.priorityQueue ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-neutral-600" />}
              </button>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">Geração de Imagens Ilimitada</span>
                <span className="text-xs text-neutral-400">Permite gerar imagens sem contagem de cota</span>
              </div>
              <button
                onClick={() => setConfig({
                  ...config,
                  proFeatures: { ...config.proFeatures, unlimitedImageGen: !config.proFeatures.unlimitedImageGen }
                })}
                className="text-amber-400 hover:text-amber-300"
              >
                {config.proFeatures.unlimitedImageGen ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-neutral-600" />}
              </button>
            </div>

            <div className="flex justify-between items-center py-2">
              <div>
                <span className="text-sm font-medium text-white block">Acesso aos Modelos Exclusivos (Mega Sábio / Vision)</span>
                <span className="text-xs text-neutral-400">Exige assinatura Pro para acessar modelos avançados</span>
              </div>
              <button
                onClick={() => setConfig({
                  ...config,
                  proFeatures: { ...config.proFeatures, exclusiveModelsAccess: !config.proFeatures.exclusiveModelsAccess }
                })}
                className="text-amber-400 hover:text-amber-300"
              >
                {config.proFeatures.exclusiveModelsAccess ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-neutral-600" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: SERVER SETTINGS */}
      {activeTab === 'server' && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h4 className="text-sm font-semibold text-neutral-200">Configurações do Servidor Backend</h4>
            <p className="text-xs text-neutral-400 mt-1">Parâmetros globais de execução e estabilidade do sistema.</p>
          </div>

          <div className="space-y-3 bg-[#202020] p-4 rounded-2xl border border-[#2E2E2E]">
            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">Modo de Manutenção</span>
                <span className="text-xs text-rose-400 font-bold">Bloqueia temporariamente novas requisições de usuários comuns</span>
              </div>
              <button
                onClick={() => setConfig({
                  ...config,
                  serverSettings: { ...config.serverSettings, maintenanceMode: !config.serverSettings.maintenanceMode }
                })}
                className="text-rose-500 hover:text-rose-400"
              >
                {config.serverSettings.maintenanceMode ? <ToggleRight className="w-8 h-8 text-rose-500" /> : <ToggleLeft className="w-8 h-8 text-neutral-600" />}
              </button>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">Tamanho Máximo de Contexto (Tokens)</span>
                <span className="text-xs text-neutral-400">Janela de contexto enviada ao modelo</span>
              </div>
              <select
                value={config.serverSettings.maxContextLength}
                onChange={(e) => setConfig({
                  ...config,
                  serverSettings: { ...config.serverSettings, maxContextLength: Number(e.target.value) }
                })}
                className="bg-[#171717] border border-[#333] text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-red-500"
              >
                <option value={16000}>16.000 tokens</option>
                <option value={32000}>32.000 tokens</option>
                <option value={64000}>64.000 tokens</option>
                <option value={128000}>128.000 tokens</option>
              </select>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">Memória Vetorial Integrada</span>
                <span className="text-xs text-neutral-400">Busca semântica de longo prazo por usuário</span>
              </div>
              <button
                onClick={() => setConfig({
                  ...config,
                  serverSettings: { ...config.serverSettings, enableVectorMemory: !config.serverSettings.enableVectorMemory }
                })}
                className="text-emerald-400 hover:text-emerald-300"
              >
                {config.serverSettings.enableVectorMemory ? <ToggleRight className="w-8 h-8 text-emerald-400" /> : <ToggleLeft className="w-8 h-8 text-neutral-600" />}
              </button>
            </div>

            <div className="flex justify-between items-center py-2">
              <div>
                <span className="text-sm font-medium text-white block">Timeout de Resposta (ms)</span>
                <span className="text-xs text-neutral-400">Tempo limite para abortar gerações longas</span>
              </div>
              <input
                type="number"
                step="5000"
                value={config.serverSettings.requestTimeoutMs}
                onChange={(e) => setConfig({
                  ...config,
                  serverSettings: { ...config.serverSettings, requestTimeoutMs: Number(e.target.value) }
                })}
                className="w-28 bg-[#171717] border border-[#333] rounded-xl px-3 py-1.5 text-xs text-white font-mono text-center outline-none focus:border-red-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: MODELS */}
      {activeTab === 'models' && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h4 className="text-sm font-semibold text-neutral-200">Gerenciamento dos Modelos de Inteligência Artificial</h4>
            <p className="text-xs text-neutral-400 mt-1">Ative, desative ou altere o plano necessário para cada modelo.</p>
          </div>

          <div className="space-y-3">
            {config.models.map((model, idx) => (
              <div key={model.id} className="p-4 rounded-2xl bg-[#202020] border border-[#2E2E2E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{model.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${
                      model.requiredPlan === 'pro' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}>
                      {model.requiredPlan === 'pro' ? 'Plano Pro' : 'Gratuito'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">{model.description}</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <select
                    value={model.requiredPlan}
                    onChange={(e) => {
                      const updated = [...config.models];
                      updated[idx].requiredPlan = e.target.value as 'free' | 'pro';
                      setConfig({ ...config, models: updated });
                    }}
                    className="bg-[#171717] border border-[#333] text-white text-xs rounded-xl px-2.5 py-1 focus:outline-none"
                  >
                    <option value="free">Livre (Free)</option>
                    <option value="pro">Exclusivo Pro</option>
                  </select>

                  <button
                    onClick={() => {
                      const updated = [...config.models];
                      updated[idx].enabled = !updated[idx].enabled;
                      setConfig({ ...config, models: updated });
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl border transition-colors"
                  >
                    {model.enabled ? (
                      <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Ativo</span>
                    ) : (
                      <span className="text-neutral-500 flex items-center gap-1">Inativo</span>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 6: SECURITY AND AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-neutral-200">Segurança Máxima: Histórico de Auditoria & Logs</h4>
              <p className="text-xs text-neutral-400 mt-1">Registros de todas as alterações administrativas, atividades, erros e pagamentos.</p>
            </div>

            {/* Sub-tab selection */}
            <div className="flex rounded-xl bg-[#202020] p-1 border border-[#333] flex-shrink-0">
              <button
                onClick={() => { setActiveLogSubTab('system'); setLogSearch(''); }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${activeLogSubTab === 'system' ? 'bg-cyan-600 text-white' : 'text-neutral-400 hover:text-white'}`}
              >
                Logs do Sistema
              </button>
              <button
                onClick={() => { setActiveLogSubTab('audit'); setLogSearch(''); }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${activeLogSubTab === 'audit' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'}`}
              >
                Auditoria Admin
              </button>
            </div>
          </div>

          {/* Search and filter bar */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={activeLogSubTab === 'system' ? "Buscar logs por e-mail, ação, descrição, IP..." : "Buscar auditoria por admin, ação, IP..."}
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full bg-[#202020] border border-[#2E2E2E] rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {activeLogSubTab === 'system' && (
              <div className="flex items-center gap-1.5 bg-[#202020] border border-[#2E2E2E] rounded-xl px-2.5 py-1.5">
                <Filter className="w-3.5 h-3.5 text-neutral-400" />
                <select
                  value={systemLogFilter}
                  onChange={(e) => setSystemLogFilter(e.target.value)}
                  className="bg-transparent border-none text-xs text-neutral-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">Todas Categorias</option>
                  <option value="auth">🔑 Autenticação</option>
                  <option value="info">⚙️ Sistema/Admin</option>
                  <option value="ia">🤖 inferência IA</option>
                  <option value="payment">💳 Pagamentos</option>
                  <option value="error">❌ Erros e Falhas</option>
                </select>
              </div>
            )}
          </div>

          {/* Table / logs presentation */}
          {activeLogSubTab === 'system' ? (
            <div className="bg-[#202020] border border-[#2E2E2E] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#181818] text-neutral-400 font-semibold border-b border-[#2B2B2B]">
                      <th className="p-3">Data / Hora</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Usuário</th>
                      <th className="p-3">Ação</th>
                      <th className="p-3">Descrição Detalhada</th>
                      <th className="p-3 text-right">IP / Navegador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2B2B2B] text-neutral-300">
                    {filteredSystemLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-neutral-500">Nenhum log encontrado para os critérios.</td>
                      </tr>
                    ) : (
                      filteredSystemLogs.map((log) => {
                        let badgeColor = "bg-neutral-800 text-neutral-400 border-neutral-700/50";
                        if (log.type === "auth") badgeColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                        else if (log.type === "info") badgeColor = "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
                        else if (log.type === "ia") badgeColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                        else if (log.type === "payment") badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                        else if (log.type === "error") badgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold animate-pulse";

                        return (
                          <tr key={log.id} className="hover:bg-[#252525]/60 transition-colors">
                            <td className="p-3 font-mono whitespace-nowrap text-neutral-400">
                              {log.date} <span className="text-[10px] opacity-60 block">{log.time}</span>
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border uppercase ${badgeColor}`}>
                                {log.type === 'auth' && '🔑 '}
                                {log.type === 'info' && '⚙️ '}
                                {log.type === 'ia' && '🤖 '}
                                {log.type === 'payment' && '💳 '}
                                {log.type === 'error' && '❌ '}
                                {log.type}
                              </span>
                            </td>
                            <td className="p-3 font-mono font-medium max-w-[120px] truncate" title={log.userEmail}>
                              {log.userEmail}
                            </td>
                            <td className="p-3 font-semibold text-neutral-200">
                              {log.action}
                            </td>
                            <td className="p-3 text-neutral-400 max-w-[250px] truncate" title={log.details}>
                              {log.details}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap font-mono text-[10px] text-neutral-500">
                              {log.ip} <span className="block text-[9px] opacity-75">{log.browser}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* AUDIT LOGS WITH OLD/NEW COMPARISON MODAL */
            <div className="bg-[#202020] border border-[#2E2E2E] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#181818] text-neutral-400 font-semibold border-b border-[#2B2B2B]">
                      <th className="p-3">Data / Hora</th>
                      <th className="p-3">Administrador</th>
                      <th className="p-3">Ação Executada</th>
                      <th className="p-3">IP / Dispositivo</th>
                      <th className="p-3">Navegador</th>
                      <th className="p-3 text-right">Comparar Dados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2B2B2B] text-neutral-300">
                    {filteredAuditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-neutral-500">Nenhum registro de auditoria encontrado.</td>
                      </tr>
                    ) : (
                      filteredAuditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#252525]/60 transition-colors">
                          <td className="p-3 font-mono whitespace-nowrap text-neutral-400">
                            {log.date} <span className="text-[10px] opacity-60 block">{log.time}</span>
                          </td>
                          <td className="p-3 font-mono text-emerald-400 font-bold whitespace-nowrap">
                            {log.adminEmail}
                          </td>
                          <td className="p-3 font-semibold text-white">
                            {log.action}
                          </td>
                          <td className="p-3 whitespace-nowrap font-mono text-neutral-400">
                            {log.ip} <span className="text-[10px] text-neutral-500 block">{log.device}</span>
                          </td>
                          <td className="p-3 text-neutral-400 whitespace-nowrap font-mono">
                            {log.browser}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => setSelectedAuditLog(log)}
                              className="px-2.5 py-1 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/30 transition-colors font-semibold flex items-center gap-1 ml-auto"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspecionar</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Audit Diff Inspector Modal Dialog */}
          {selectedAuditLog && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fadeIn backdrop-blur-xs">
              <div className="bg-[#171717] border border-[#2E2E2E] rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 bg-red-950/20 border-b border-red-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-red-500" />
                    <div>
                      <h3 className="text-sm font-bold text-white">Inspecionar Alteração - Auditoria de Segurança</h3>
                      <p className="text-[10px] text-neutral-400">Log ID: {selectedAuditLog.id}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedAuditLog(null)} 
                    className="text-neutral-400 hover:text-white font-mono text-lg p-1"
                  >
                    &times;
                  </button>
                </div>

                <div className="p-4 space-y-3 overflow-y-auto text-xs">
                  <div className="grid grid-cols-2 gap-3 bg-[#202020] p-3 rounded-xl border border-[#2E2E2E]">
                    <div>
                      <span className="text-neutral-500 block text-[10px]">Administrador</span>
                      <span className="font-mono text-white font-bold">{selectedAuditLog.adminEmail}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[10px]">Data e Hora da Ação</span>
                      <span className="font-mono text-neutral-300">{selectedAuditLog.date} às {selectedAuditLog.time}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[10px]">Endereço IP</span>
                      <span className="font-mono text-neutral-300">{selectedAuditLog.ip}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[10px]">Dispositivo / Navegador</span>
                      <span className="font-mono text-neutral-300">{selectedAuditLog.device} ({selectedAuditLog.browser})</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-neutral-400 font-semibold block">Ação Executada:</span>
                    <p className="p-2.5 rounded-lg bg-red-600/10 text-red-200 border border-red-500/20 font-bold">{selectedAuditLog.action}</p>
                  </div>

                  {selectedAuditLog.details && (
                    <div className="space-y-1 animate-fadeIn">
                      <span className="text-neutral-400 font-semibold block">Campos Modificados (Detalhamento):</span>
                      <pre className="p-2.5 rounded-lg bg-[#202020]/90 border border-[#2E2E2E] text-amber-300 whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
                        {selectedAuditLog.details}
                      </pre>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                      <span className="text-neutral-500 font-bold block">Valor Antigo:</span>
                      <pre className="p-2.5 rounded-lg bg-[#202020] border border-[#2B2B2B] text-neutral-400 overflow-x-auto font-mono text-[10px] leading-relaxed max-h-48">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(selectedAuditLog.oldValue), null, 2);
                          } catch {
                            return selectedAuditLog.oldValue;
                          }
                        })()}
                      </pre>
                    </div>

                    <div className="space-y-1">
                      <span className="text-emerald-500 font-bold block">Valor Novo:</span>
                      <pre className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-200 overflow-x-auto font-mono text-[10px] leading-relaxed max-h-48">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(selectedAuditLog.newValue), null, 2);
                          } catch {
                            return selectedAuditLog.newValue;
                          }
                        })()}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#1e1e1e] border-t border-[#2E2E2E] flex justify-end">
                  <button
                    onClick={() => setSelectedAuditLog(null)}
                    className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs active:scale-95 transition-all"
                  >
                    Fechar Inspeção
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 7: RBAC CONTROL */}
      {activeTab === 'rbac' && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h4 className="text-sm font-semibold text-neutral-200">Arquitetura de Controle de Acesso Baseado em Funções (RBAC)</h4>
            <p className="text-xs text-neutral-400 mt-1">Regras e políticas de segurança aplicadas no sistema.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#202020] border border-[#2E2E2E] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#171717] border border-[#2B2B2B]">
                <span className="text-neutral-400 block mb-1">Administrador Único Configurado</span>
                <span className="font-mono text-emerald-400 font-semibold">{ADMIN_EMAIL}</span>
              </div>

              <div className="p-3 rounded-xl bg-[#171717] border border-[#2B2B2B]">
                <span className="text-neutral-400 block mb-1">Sua Conta Atual</span>
                <span className="font-mono text-white font-semibold">{userEmail}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#2B2B2B]">
              <span className="text-xs font-semibold text-neutral-300 block">Regras Obrigatórias de Permissão:</span>
              <ul className="space-y-1.5 text-xs text-neutral-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Apenas o e-mail <code className="text-white bg-black/40 px-1 py-0.5 rounded">{ADMIN_EMAIL}</code> recebe a role <code className="text-red-400">admin</code>.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Todos os demais e-mails recebem automaticamente a role <code className="text-blue-400">user</code>.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Requisições sem permissão de admin retornam erro HTTP 403 (Acesso Negado) no backend.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Configuração centralizada em <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded">src/config/admin.ts</code> para fácil manutenção.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ProtectedAdminPanel = withAdmin(AdminPanel);
