import { collection, onSnapshot, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Lock, Shield, Server, Cpu, Database, Activity, Gauge, Sparkles, 
  CheckCircle2, AlertTriangle, RefreshCw, Save, Sliders, ToggleLeft, ToggleRight,
  Layers, Users, BarChart3, Wrench, ShieldAlert, Check, TrendingUp, Coins, 
  Terminal, Info, FileText, LifeBuoy, CheckCircle, ArrowUpRight, Search, Eye, Filter, ShieldCheck, 
  ShoppingCart, Ban, LogOut, LogIn, CreditCard, Image as ImageIcon, Laptop,
  Trash2, Send
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
  SystemLog,
  maskEmail
} from '../config/admin';
import { withAdmin } from './withAdmin';
import { useTranslation } from '../i18n';

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
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = getUserRole(userEmail);
  const isAdmin = role === 'admin';

  // Sub-tabs in Admin Panel
  const [activeTab, setActiveTab] = useState<'stats' | 'limits' | 'pro' | 'server' | 'models' | 'rbac' | 'logs' | 'debug' | 'support'>('stats');

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

  const [auditMetrics, setAuditMetrics] = useState<{
    totalUsers: number;
    activeSubscriptions: number;
    timestamp: number;
  } | null>(null);

  // Logs States
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [activeLogSubTab, setActiveLogSubTab] = useState<'system' | 'audit'>('system');
  const [logSearch, setLogSearch] = useState<string>('');
  const [systemLogFilter, setSystemLogFilter] = useState<string>('all');
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [adminReply, setAdminReply] = useState('');

  // Fetch admin config and stats from backend with x-user-email security header
  const fetchAdminData = async () => {
    if (!isAdmin || !user) return;
    setIsLoading(true);
    setSaveStatus(null);
    try {
      const token = await user.getIdToken();
      const headers = {
        'Authorization': `Bearer ${token}`,
        'x-user-email': userEmail
      };

      const [configRes, statsRes, logsRes, auditRes] = await Promise.all([
        fetch('/api/admin/config', { headers }),
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/logs', { headers }),
        fetch('/api/admin/audit-metrics', { headers })
      ]);

      if (configRes.status === 403 || statsRes.status === 403 || logsRes.status === 403 || auditRes.status === 403) {
        setSaveStatus({
          type: 'error',
          message: `Erro 403: ${t.admin.denied}`
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

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditMetrics(auditData);
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

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSupportTickets(tickets);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !selectedTicket) {
      setTicketMessages([]);
      return;
    }
    const q = query(
      collection(db, 'supportTickets', selectedTicket.id, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTicketMessages(msgs);
    });
    return () => unsubscribe();
  }, [isAdmin, selectedTicket?.id]);

  const handleAssumeTicket = async (ticketId: string) => {
    if (!isAdmin || !user) return;
    try {
      const token = await user.getIdToken();
      await fetch(`/api/admin/support-tickets/${ticketId}/assume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-email': userEmail
        }
      });
    } catch (e) {
      console.error("Erro ao assumir ticket:", e);
    }
  };

  const handleResolveTicketAdmin = async (ticketId: string) => {
    if (!isAdmin || !user) return;
    try {
      const token = await user.getIdToken();
      await fetch(`/api/admin/support-tickets/${ticketId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-email': userEmail
        }
      });
      setSelectedTicket(null);
    } catch (e) {
      console.error("Erro ao resolver ticket:", e);
    }
  };

  const handleRefuseTicket = async (ticketId: string) => {
    if (!isAdmin || !user) return;
    const reason = window.prompt("Por que você está recusando este ticket? (O bot verá este motivo)");
    if (reason === null) return;

    try {
      const token = await user.getIdToken();
      await fetch(`/api/admin/support-tickets/${ticketId}/refuse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-email': userEmail
        },
        body: JSON.stringify({ reason })
      });
      setSelectedTicket(null);
    } catch (e) {
      console.error("Erro ao recusar ticket:", e);
    }
  };

  const handleSendAdminMessage = async () => {
    if (!isAdmin || !user || !selectedTicket || !adminReply.trim()) return;
    try {
      const text = adminReply;
      setAdminReply('');
      const token = await user.getIdToken();
      await fetch(`/api/admin/support-tickets/${selectedTicket.id}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-email': userEmail
        },
        body: JSON.stringify({ text })
      });
    } catch (e) {
      console.error("Erro ao enviar mensagem:", e);
    }
  };


  // Save Config to Backend (registers audit automatically on backend!)
  
    const handleResolveTicket = async (id: string) => {
    try {
      await updateDoc(doc(db, 'supportTickets', id), {
        status: 'resolvido',
        resolvedAt: Date.now()
      });
    } catch (e) {
       console.error("Erro ao resolver ticket", e);
    }
  };

  const handleSaveConfig = async () => {
    if (!isAdmin || !user) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-email': userEmail
        },
        body: JSON.stringify({ config, userEmail })
      });

      if (res.status === 403) {
        setSaveStatus({
          type: 'error',
          message: `Erro 403: ${t.admin.denied}`
        });
        setIsSaving(false);
        return;
      }

      if (res.ok) {
        setSaveStatus({
          type: 'success',
          message: t.admin.saveSuccess
        });
        if (onConfigSaved) onConfigSaved(config);
        // Reload logs to show the new audit entry
        fetchAdminData();
      } else {
        const err = await res.json();
        setSaveStatus({
          type: 'error',
          message: err.message || t.admin.saveError
        });
      }
    } catch (e: any) {
      setSaveStatus({
        type: 'error',
        message: t.admin.networkError
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

  const chartColors = ['#FFFFFF', '#F5F5F5', '#E5E5E5', '#D4D4D4', '#A3A3A3', '#737373', '#525252'];

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
      <div className="w-full p-6 sm:p-8 rounded-2xl bg-[#121212]/30 border border-neutral-500/40 text-white space-y-5 animate-fadeIn">
        <div className="flex items-center gap-3 text-neutral-400">
          <ShieldAlert className="w-8 h-8 flex-shrink-0" />
          <div>
            <h3 className="text-xl font-bold tracking-tight text-white">403 - {t.admin.denied}</h3>
            <p className="text-xs text-neutral-300 font-mono mt-0.5">{t.admin.role}: {role} | {t.admin.session}: {maskEmail(userEmail)}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-black/40 border border-neutral-500/20 text-sm leading-relaxed text-neutral-100/90 space-y-2">
          <p>
            {t.admin.noPermission}
          </p>
          <p className="text-xs text-neutral-300/80">
            {t.admin.onlyAdminTip} (<span className="font-mono text-white underline">{maskEmail(ADMIN_EMAIL)}</span>) {t.admin.unrestrictedAccess}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 text-xs text-neutral-400 border-t border-neutral-500/20">
          <span>{t.admin.securityCheck}</span>
          <span className="font-mono text-neutral-400">HTTP 403 FORBIDDEN</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* AUTHENTICATION STATE COMPONENT */}
      <div className="p-5 rounded-3xl bg-[#171717] border border-[#242424] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 transition-all hover:border-[#2C2C2E] group">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white shadow-xl group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white tracking-tight flex items-center gap-2.5">
              {t.admin.verifiedAdmin}
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-400 shadow-[0_0_8px_rgba(255,255,255,0.2)] animate-pulse"></div>
            </h4>
            <p className="text-sm text-neutral-500 font-medium mt-1">
              {t.admin.session}: <span className="text-white font-mono">{maskEmail(userEmail)}</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em]">
            {t.admin.rootAccess}
          </div>
        </div>
      </div>

      {/* Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#171717] border border-[#242424] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/5 text-white border border-white/10">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">{t.admin.title}</h3>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              {t.admin.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={fetchAdminData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-[#242424] hover:bg-[#2F2F2F] text-neutral-300 hover:text-white border border-[#303030] transition-colors text-xs flex items-center gap-1.5"
            title={t.admin.refresh}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t.common.refresh}</span>
          </button>

          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs transition-all active:scale-95 shadow-md flex items-center gap-2"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{t.admin.saveBtn}</span>
          </button>
        </div>
      </div>

      {/* Save Status Notification Banner */}
      {saveStatus && (
        <div className={`p-3.5 rounded-xl text-xs font-medium border flex items-center justify-between animate-fadeIn ${
          saveStatus.type === 'success' 
            ? 'bg-sky-950/40 text-sky-300 border-sky-500/30' 
            : 'bg-[#121212]/40 text-neutral-300 border-neutral-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {saveStatus.type === 'success' ? <Check className="w-4 h-4 text-sky-400" /> : <AlertTriangle className="w-4 h-4 text-neutral-400" />}
            <span>{saveStatus.message}</span>
          </div>
          <button onClick={() => setSaveStatus(null)} className="text-xs hover:underline opacity-80">{t.common.close}</button>
        </div>
      )}

      {/* Admin Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#242424] scrollbar-custom">
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'stats'
              ? 'bg-white text-black'
              : 'text-neutral-500 hover:text-white'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>{t.admin.stats}</span>
        </button>

        <button
          onClick={() => setActiveTab('limits')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'limits'
              ? 'bg-white text-black'
              : 'text-neutral-500 hover:text-white'
          }`}
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>{t.admin.limits}</span>
        </button>

        <button
          onClick={() => setActiveTab('pro')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'pro'
              ? 'bg-white text-black'
              : 'text-neutral-500 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t.admin.proFeatures}</span>
        </button>

        <button
          onClick={() => setActiveTab('server')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'server'
              ? 'bg-white text-black'
              : 'text-neutral-500 hover:text-white'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>{t.admin.server}</span>
        </button>

        <button
          onClick={() => setActiveTab('models')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'models'
              ? 'bg-white text-black'
              : 'text-neutral-500 hover:text-white'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>{t.admin.models}</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'logs'
              ? 'bg-white text-black'
              : 'text-neutral-500 hover:text-white'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>{t.admin.audit}</span>
        </button>

            <button
              onClick={() => setActiveTab('support')}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'support' ? 'bg-[#232326] text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
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


        <button
          onClick={() => setActiveTab('rbac')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'rbac'
              ? 'bg-white text-black'
              : 'text-neutral-500 hover:text-white'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>{t.admin.rbac}</span>
        </button>

        <button
          onClick={() => setActiveTab('debug')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'debug'
              ? 'bg-white text-black'
              : 'text-neutral-500 hover:text-white'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>{t.admin.debug}</span>
        </button>
      </div>

      {/* SUB-TAB 1: STATS */}
      {activeTab === 'stats' && (
        <div className="space-y-8 animate-fadeIn">
          {/* AUDIT METRICS SECTION */}
          <div className="space-y-5">
            <h5 className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.25em] px-1">{t.admin.realAuditMetrics}</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="p-8 rounded-3xl bg-[#171717] border border-[#242424] flex items-center justify-between group transition-all hover:border-[#2C2C2E]">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{t.admin.totalUsers}</p>
                  <p className="text-4xl font-black text-white">{auditMetrics?.totalUsers || '...'}</p>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 group-hover:text-white transition-colors shadow-2xl">
                  <Users className="w-8 h-8" />
                </div>
              </div>
              
              <div className="p-8 rounded-3xl bg-[#171717] border border-[#242424] flex items-center justify-between group transition-all hover:border-[#2C2C2E]">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{t.admin.activeSubscriptions}</p>
                  <p className="text-4xl font-black text-white">{auditMetrics?.activeSubscriptions || '...'}</p>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 group-hover:text-white transition-colors shadow-2xl">
                  <Sparkles className="w-8 h-8" />
                </div>
              </div>
            </div>
          </div>

          {/* Executive KPI Grid */}
          <div className="space-y-5">
            <h5 className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.25em] px-1">{t.admin.generalPerformance}</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Financial MRR card */}
              <div className="p-6 rounded-3xl bg-[#171717] border border-[#242424] flex flex-col justify-between min-h-[140px] group transition-all hover:border-[#2C2C2E]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{t.admin.monthlyRevenue}</span>
                  <Coins className="w-5 h-5 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                </div>
                <p className="text-4xl font-black text-white">R$ {stats.monthlyRevenue?.toFixed(2)}</p>
                <div className="flex items-center justify-between text-[11px] text-neutral-600 font-medium pt-2 border-t border-white/5">
                  <span>{t.admin.monthlyRevenue} (Proj)</span>
                  <span className="text-white flex items-center gap-1.5 font-bold">
                    <TrendingUp className="w-3.5 h-3.5" /> Estável
                  </span>
                </div>
              </div>

              {/* Total Revenue card */}
              <div className="p-6 rounded-3xl bg-[#171717] border border-[#242424] flex flex-col justify-between min-h-[140px] group transition-all hover:border-[#2C2C2E]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{t.admin.totalRevenue}</span>
                  <CreditCard className="w-5 h-5 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                </div>
                <p className="text-4xl font-black text-white">R$ {stats.totalRevenue?.toFixed(2)}</p>
                <div className="text-[11px] text-neutral-600 font-medium pt-2 border-t border-white/5">
                  Histórico Acumulado
                </div>
              </div>

              {/* Messages sent */}
              <div className="p-6 rounded-3xl bg-[#171717] border border-[#242424] flex flex-col justify-between min-h-[140px] group transition-all hover:border-[#2C2C2E]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{t.admin.aiConversations}</span>
                  <Terminal className="w-5 h-5 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                </div>
                <p className="text-4xl font-black text-white">{stats.totalMessagesSent || 0}</p>
                <div className="text-[11px] text-neutral-600 font-medium pt-2 border-t border-white/5">
                  Prompts Processados
                </div>
              </div>

              {/* Images generated */}
              <div className="p-6 rounded-3xl bg-[#171717] border border-[#242424] flex flex-col justify-between min-h-[140px] group transition-all hover:border-[#2C2C2E]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{t.admin.generatedVisuals}</span>
                  <ImageIcon className="w-5 h-5 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                </div>
                <p className="text-4xl font-black text-white">{stats.totalImagesGenerated || 0}</p>
                <div className="text-[11px] text-neutral-600 font-medium pt-2 border-t border-white/5">
                  ZENO Estúdio Vision
                </div>
              </div>

              {/* Server Performance metrics */}
              <div className="p-6 rounded-3xl bg-[#171717] border border-[#242424] flex flex-col justify-between min-h-[140px] group transition-all hover:border-[#2C2C2E]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{t.admin.resourceUsage}</span>
                  <Activity className="w-5 h-5 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-2xl font-black text-white">{stats.memoryUsageMB || 150} MB</span>
                  <span className="text-sm text-neutral-500 font-mono font-bold">{stats.cpuUsagePercent || 5}% CPU</span>
                </div>
                <div className="text-[11px] text-neutral-400 font-bold tracking-[0.2em] pt-2 border-t border-white/5">
                  SISTEMA ONLINE
                </div>
              </div>
              
              {/* Online Now card */}
              <div className="p-6 rounded-3xl bg-[#171717] border border-[#242424] flex flex-col justify-between min-h-[140px] group transition-all hover:border-[#2C2C2E]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{t.admin.activeDevices}</span>
                  <Laptop className="w-5 h-5 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                </div>
                <p className="text-4xl font-black text-white">{stats.activeOnlineNow || 1}</p>
                <div className="text-[11px] text-neutral-500 font-bold pt-2 border-t border-white/5 flex items-center justify-between">
                  <span>{stats.activeSessionsToday || 1} Sessões hoje</span>
                  <div className="w-2 h-2 rounded-full bg-neutral-400"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed usage analytics maps */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2">
            {/* Recharts Model distribution */}
            <div className="md:col-span-7 p-6 rounded-2xl bg-[#171717] border border-[#242424] space-y-4">
              <div>
                <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                  Uso de Modelos IA
                </h5>
                <p className="text-[10px] text-neutral-600 mt-1">{t.admin.inferenceDistribution}</p>
              </div>

              <div className="h-48 w-full pr-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getModelChartData()} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#242424" vertical={false} />
                    <XAxis dataKey="name" stroke="#525252" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#525252" fontSize={9} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #262626', borderRadius: '12px' }}
                      labelStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                      itemStyle={{ color: '#fff', fontSize: '10px' }}
                    />
                    <Bar dataKey="uso" radius={[6, 6, 0, 0]}>
                      {
                        getModelChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="#404040" className="hover:fill-white transition-all cursor-pointer" />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Telemetry / secondary tools grid */}
            <div className="md:col-span-5 p-6 rounded-2xl bg-[#171717] border border-[#242424] space-y-5">
              <div>
                <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{t.admin.telemetry}</h5>
              </div>

              <div className="space-y-4 pt-2">
                {/* Web Search */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-400 font-medium">Grounding Search</span>
                    <span className="text-white font-mono font-bold">{stats.totalWebSearches || 0}</span>
                  </div>
                  <div className="w-full bg-[#232326] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-white h-1.5" style={{ width: `${Math.min(100, ((stats.totalWebSearches || 0) / Math.max(1, stats.totalMessagesSent)) * 100)}%` }} />
                  </div>
                </div>

                {/* PDF Analyzer */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-400 font-medium">{t.plugins.categories.docs}</span>
                    <span className="text-white font-mono font-bold">{stats.totalPdfsAnalyzed || 0}</span>
                  </div>
                  <div className="w-full bg-[#232326] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-white h-1.5" style={{ width: `${Math.min(100, ((stats.totalPdfsAnalyzed || 0) / Math.max(1, stats.totalMessagesSent)) * 100)}%` }} />
                  </div>
                </div>

                {/* Code Execution */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-400 font-medium">{t.plugins.categories.code}</span>
                    <span className="text-white font-mono font-bold">{stats.totalCodeUses || 0}</span>
                  </div>
                  <div className="w-full bg-[#232326] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-white h-1.5" style={{ width: `${Math.min(100, ((stats.totalCodeUses || 0) / Math.max(1, stats.totalMessagesSent)) * 100)}%` }} />
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
            <h4 className="text-sm font-semibold text-neutral-200">{t.admin.freePlanQuotas}</h4>
            <p className="text-xs text-neutral-400 mt-1">{t.admin.freePlanQuotasDesc}</p>
          </div>

          <div className="space-y-3 bg-[#202020] p-4 rounded-2xl border border-[#2E2E2E]">
            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">{t.admin.dailyMessages}</span>
                <span className="text-xs text-neutral-400">{t.admin.dailyMessagesDesc}</span>
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
                className="w-24 bg-[#171717] border border-[#333] rounded-xl px-3 py-1.5 text-sm text-white font-semibold text-center outline-none focus:border-neutral-500" 
              />
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">{t.admin.realTimeSearch}</span>
                <span className="text-xs text-neutral-400">{t.admin.realTimeSearchDesc}</span>
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
                className="w-24 bg-[#171717] border border-[#333] rounded-xl px-3 py-1.5 text-sm text-white font-semibold text-center outline-none focus:border-neutral-500" 
              />
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">{t.admin.studioVisionGen}</span>
                <span className="text-xs text-neutral-400">{t.admin.studioVisionGenDesc}</span>
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
                className="w-24 bg-[#171717] border border-[#333] rounded-xl px-3 py-1.5 text-sm text-white font-semibold text-center outline-none focus:border-neutral-500" 
              />
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">{t.admin.docAnalysis}</span>
                <span className="text-xs text-neutral-400">{t.admin.docAnalysisDesc}</span>
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
                className="w-24 bg-[#171717] border border-[#333] rounded-xl px-3 py-1.5 text-sm text-white font-semibold text-center outline-none focus:border-neutral-500" 
              />
            </div>

            <div className="flex justify-between items-center py-2">
              <div>
                <span className="text-sm font-medium text-white block">{t.admin.visionOCR}</span>
                <span className="text-xs text-neutral-400">{t.admin.visionOCRDesc}</span>
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
                className="w-24 bg-[#171717] border border-[#333] rounded-xl px-3 py-1.5 text-sm text-white font-semibold text-center outline-none focus:border-neutral-500" 
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: PRO PLAN FEATURES */}
      {activeTab === 'pro' && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h4 className="text-sm font-semibold text-neutral-200">{t.admin.proBenefits}</h4>
            <p className="text-xs text-neutral-400 mt-1">{t.admin.proBenefitsDesc}</p>
          </div>

          <div className="space-y-3 bg-[#202020] p-4 rounded-2xl border border-[#2E2E2E]">
            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">{t.admin.limitMultiplier}</span>
                <span className="text-xs text-neutral-400">{t.admin.limitMultiplierDesc}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400 font-mono font-bold">{config.proFeatures.limitMultiplier}x</span>
                <input 
                  type="number" 
                  min="2"
                  max="100"
                  value={config.proFeatures.limitMultiplier} 
                  onChange={(e) => setConfig({
                    ...config,
                    proFeatures: { ...config.proFeatures, limitMultiplier: Number(e.target.value) }
                  })} 
                  className="w-20 bg-[#171717] border border-[#333] rounded-xl px-2 py-1 text-sm text-white font-semibold text-center outline-none focus:border-neutral-500" 
                />
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">{t.admin.priorityQueue}</span>
                <span className="text-xs text-neutral-400">{t.admin.priorityQueueDesc}</span>
              </div>
              <button
                onClick={() => setConfig({
                  ...config,
                  proFeatures: { ...config.proFeatures, priorityQueue: !config.proFeatures.priorityQueue }
                })}
                className="text-neutral-400 hover:text-neutral-300"
              >
                {config.proFeatures.priorityQueue ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-neutral-600" />}
              </button>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">{t.admin.unlimitedImages}</span>
                <span className="text-xs text-neutral-400">{t.admin.unlimitedImagesDesc}</span>
              </div>
              <button
                onClick={() => setConfig({
                  ...config,
                  proFeatures: { ...config.proFeatures, unlimitedImageGen: !config.proFeatures.unlimitedImageGen }
                })}
                className="text-neutral-400 hover:text-neutral-300"
              >
                {config.proFeatures.unlimitedImageGen ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-neutral-600" />}
              </button>
            </div>

            <div className="flex justify-between items-center py-2">
              <div>
                <span className="text-sm font-medium text-white block">{t.admin.exclusiveModels}</span>
                <span className="text-xs text-neutral-400">{t.admin.exclusiveModelsDesc}</span>
              </div>
              <button
                onClick={() => setConfig({
                  ...config,
                  proFeatures: { ...config.proFeatures, exclusiveModelsAccess: !config.proFeatures.exclusiveModelsAccess }
                })}
                className="text-neutral-400 hover:text-neutral-300"
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
            <h4 className="text-sm font-semibold text-neutral-200">{t.admin.serverConfig}</h4>
            <p className="text-xs text-neutral-400 mt-1">{t.admin.serverParams}</p>
          </div>

          <div className="space-y-3 bg-[#202020] p-4 rounded-2xl border border-[#2E2E2E]">
            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">{t.admin.maintenanceMode}</span>
                <span className="text-xs text-neutral-400 font-bold">{t.admin.maintenanceModeDesc}</span>
              </div>
              <button
                onClick={() => setConfig({
                  ...config,
                  serverSettings: { ...config.serverSettings, maintenanceMode: !config.serverSettings.maintenanceMode }
                })}
                className="text-neutral-500 hover:text-neutral-400"
              >
                {config.serverSettings.maintenanceMode ? <ToggleRight className="w-8 h-8 text-neutral-500" /> : <ToggleLeft className="w-8 h-8 text-neutral-600" />}
              </button>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">{t.admin.maxContext}</span>
                <span className="text-xs text-neutral-400">{t.admin.maxContextDesc}</span>
              </div>
              <select
                value={config.serverSettings.maxContextLength}
                onChange={(e) => setConfig({
                  ...config,
                  serverSettings: { ...config.serverSettings, maxContextLength: Number(e.target.value) }
                })}
                className="bg-[#171717] border border-[#333] text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-neutral-500"
              >
                <option value={16000}>16.000 tokens</option>
                <option value={32000}>32.000 tokens</option>
                <option value={64000}>64.000 tokens</option>
                <option value={128000}>128.000 tokens</option>
              </select>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2B2B2B]">
              <div>
                <span className="text-sm font-medium text-white block">{t.admin.vectorMemory}</span>
                <span className="text-xs text-neutral-400">{t.admin.vectorMemoryDesc}</span>
              </div>
              <button
                onClick={() => setConfig({
                  ...config,
                  serverSettings: { ...config.serverSettings, enableVectorMemory: !config.serverSettings.enableVectorMemory }
                })}
                className="text-sky-400 hover:text-sky-300"
              >
                {config.serverSettings.enableVectorMemory ? <ToggleRight className="w-8 h-8 text-sky-400" /> : <ToggleLeft className="w-8 h-8 text-neutral-600" />}
              </button>
            </div>

            <div className="flex justify-between items-center py-2">
              <div>
                <span className="text-sm font-medium text-white block">{t.admin.timeout}</span>
                <span className="text-xs text-neutral-400">{t.admin.timeoutDesc}</span>
              </div>
              <input
                type="number"
                step="5000"
                value={config.serverSettings.requestTimeoutMs}
                onChange={(e) => setConfig({
                  ...config,
                  serverSettings: { ...config.serverSettings, requestTimeoutMs: Number(e.target.value) }
                })}
                className="w-28 bg-[#171717] border border-[#333] rounded-xl px-3 py-1.5 text-xs text-white font-mono text-center outline-none focus:border-neutral-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: MODELS */}
      {activeTab === 'models' && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h4 className="text-sm font-semibold text-neutral-200">{t.admin.modelManagement}</h4>
            <p className="text-xs text-neutral-400 mt-1">{t.admin.modelManagementDesc}</p>
          </div>

          <div className="space-y-3">
            {config.models.map((model, idx) => (
              <div key={model.id} className="p-4 rounded-2xl bg-[#202020] border border-[#2E2E2E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{model.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${
                      model.requiredPlan === 'pro' ? 'bg-neutral-500/20 text-neutral-300 border border-neutral-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
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
                    <option value="free">{t.admin.free}</option>
                    <option value="pro">{t.admin.pro}</option>
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
                      <span className="text-sky-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Ativo</span>
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

      {/* SUB-TAB 6: SUPPORT TICKETS (HANDOFF) */}
      {activeTab === 'support' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[700px] animate-fadeIn">
          {/* Ticket List Sidebar */}
          <div className="md:col-span-4 bg-[#171717] border border-[#2E2E2E] rounded-3xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#2E2E2E] bg-black/20 flex items-center justify-between">
              <h4 className="text-sm font-bold text-white">Tickets de Suporte</h4>
              <div className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 text-[10px] font-bold">
                {supportTickets.filter(t => t.status !== 'resolved').length} Ativos
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {supportTickets.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <LifeBuoy className="w-8 h-8 text-neutral-700 mx-auto" />
                  <p className="text-xs text-neutral-500">Nenhum ticket aberto no momento.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#242424]">
                  {supportTickets.map((ticket) => {
                    const isSelected = selectedTicket?.id === ticket.id;
                    let statusColor = "bg-neutral-500/20 text-neutral-400";
                    let statusLabel = "Aguardando";
                    
                    if (ticket.status === 'pending_human') {
                      statusColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                      statusLabel = "Aguardando";
                    } else if (ticket.status === 'human_active') {
                      statusColor = "bg-sky-500/10 text-sky-400 border-sky-500/20";
                      statusLabel = "Em Atendimento";
                    } else if (ticket.status === 'resolved') {
                      statusColor = "bg-neutral-500/10 text-neutral-500 border-neutral-500/20";
                      statusLabel = "Resolvido";
                    } else if (ticket.status === 'returned_to_ai' || ticket.status === 'ai_active') {
                      statusColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                      statusLabel = "Com a IA";
                    }

                    return (
                      <button
                        key={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        className={`w-full text-left p-4 transition-all hover:bg-white/5 flex flex-col gap-2 ${isSelected ? 'bg-white/10' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-neutral-500 uppercase">#{ticket.id.slice(-6)}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-neutral-200 line-clamp-1">{ticket.title || 'Sem título'}</h5>
                        <p className="text-[10px] text-neutral-500 line-clamp-1">{ticket.userEmail}</p>
                        <span className="text-[9px] text-neutral-600 font-medium">
                          {new Date(ticket.lastMessageAt || ticket.createdAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Ticket Chat Area */}
          <div className="md:col-span-8 bg-[#171717] border border-[#2E2E2E] rounded-3xl overflow-hidden flex flex-col relative">
            {selectedTicket ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-[#2E2E2E] bg-black/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-xl">
                      {selectedTicket.userEmail?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{selectedTicket.userEmail}</h4>
                      <p className="text-[10px] text-neutral-500">ID: {selectedTicket.userId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedTicket.status === 'pending_human' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAssumeTicket(selectedTicket.id)}
                          className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-lg shadow-sky-600/20 active:scale-95"
                        >
                          Assumir
                        </button>
                        <button
                          onClick={() => handleRefuseTicket(selectedTicket.id)}
                          className="px-4 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-500 text-xs font-bold transition-all border border-rose-500/30 active:scale-95"
                        >
                          Recusar
                        </button>
                      </div>
                    )}
                    {selectedTicket.status === 'human_active' && (
                      <button
                        onClick={() => handleResolveTicketAdmin(selectedTicket.id)}
                        className="px-4 py-1.5 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-neutral-300 text-xs font-bold transition-all active:scale-95 border border-neutral-600"
                      >
                        Encerrar e Devolver para IA
                      </button>
                    )}
                  </div>
                </div>

                {/* AI Summary Sidebar / Top Bar */}
                <div className="px-4 py-3 bg-amber-500/5 border-b border-amber-500/10">
                  <div className="flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest">Resumo da IA (Contexto)</span>
                      <p className="text-[11px] text-neutral-400 italic leading-relaxed">{selectedTicket.aiSummary || 'A IA não forneceu resumo para este escalonamento.'}</p>
                    </div>
                  </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/10">
                  {ticketMessages.map((msg, idx) => {
                    const isSystem = msg.sender === 'system';
                    const isMe = msg.sender === 'admin';
                    const isAi = msg.sender === 'ai';
                    
                    if (isSystem) {
                      return (
                        <div key={idx} className="flex justify-center my-4">
                          <span className="px-3 py-1 rounded-full bg-neutral-800/50 text-neutral-500 text-[10px] font-bold uppercase tracking-wider border border-neutral-700/30">
                            {msg.text}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] space-y-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                            isMe ? 'bg-sky-600 text-white rounded-tr-none' : 
                            isAi ? 'bg-neutral-800 text-neutral-300 border border-neutral-700/50 rounded-tl-none' :
                            'bg-white/10 text-white border border-white/5 rounded-tl-none'
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          </div>
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[9px] font-bold text-neutral-600 uppercase">
                              {isMe ? 'Você (Admin)' : isAi ? 'ZENO IA' : 'Usuário'}
                            </span>
                            <span className="text-[9px] text-neutral-700">
                              {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Bar */}
                <div className="p-4 border-t border-[#2E2E2E] bg-black/20">
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendAdminMessage(); }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      disabled={selectedTicket.status !== 'human_active'}
                      placeholder={selectedTicket.status === 'human_active' ? "Escreva sua resposta..." : "Assuma o atendimento para responder"}
                      value={adminReply}
                      onChange={(e) => setAdminReply(e.target.value)}
                      className="flex-1 bg-[#202020] border border-[#2E2E2E] rounded-xl px-4 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      type="submit"
                      disabled={selectedTicket.status !== 'human_active' || !adminReply.trim()}
                      className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition-all disabled:opacity-50 disabled:bg-neutral-800"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-neutral-600 border border-white/5">
                  <LifeBuoy className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Selecione um Ticket</h4>
                  <p className="text-xs text-neutral-500 max-w-[280px] mx-auto mt-2">Clique em uma conversa na lista lateral para visualizar o histórico e responder ao usuário.</p>
                </div>
              </div>
            )}
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
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${activeLogSubTab === 'system' ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-white'}`}
              >
                Logs do Sistema
              </button>
              <button
                onClick={() => { setActiveLogSubTab('audit'); setLogSearch(''); }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${activeLogSubTab === 'audit' ? 'bg-neutral-600 text-white' : 'text-neutral-400 hover:text-white'}`}
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
                className="w-full bg-[#202020] border border-[#2E2E2E] rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
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
                  <option value="all">{t.admin.allCategories}</option>
                  <option value="auth">{t.admin.auth}</option>
                  <option value="info">{t.admin.systemAdmin}</option>
                  <option value="ia">{t.admin.inferenceAI}</option>
                  <option value="payment">{t.admin.payments}</option>
                  <option value="error">{t.admin.errorsFailures}</option>
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
                        let badgeColor = "bg-[#232326] text-neutral-400 border-[#2C2C2E]/50";
                        if (log.type === "auth") badgeColor = "bg-sky-500/10 text-sky-400 border-sky-500/20";
                        else if (log.type === "info") badgeColor = "bg-sky-500/10 text-sky-400 border-sky-500/20";
                        else if (log.type === "ia") badgeColor = "bg-neutral-500/10 text-neutral-400 border-neutral-500/20";
                        else if (log.type === "payment") badgeColor = "bg-sky-500/10 text-sky-400 border-sky-500/20";
                        else if (log.type === "error") badgeColor = "bg-neutral-500/10 text-neutral-400 border-neutral-500/20 font-bold animate-pulse";

                        return (
                          <tr key={log.id} className="hover:bg-[#252525]/60 transition-colors">
                            <td className="p-3 font-mono whitespace-nowrap text-neutral-400">
                              {log.date} <span className="text-[10px] opacity-60 block">{log.time}</span>
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border uppercase ${badgeColor}`}>
                                
                                
                                
                                
                                
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
                          <td className="p-3 font-mono text-sky-400 font-bold whitespace-nowrap">
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
                              className="px-2.5 py-1 rounded-lg bg-neutral-600/10 hover:bg-neutral-600/20 text-neutral-400 border border-neutral-500/30 transition-colors font-semibold flex items-center gap-1 ml-auto"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{t.admin.inspect}</span>
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
                <div className="p-4 bg-[#121212]/20 border-b border-neutral-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-neutral-500" />
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
                    <p className="p-2.5 rounded-lg bg-neutral-600/10 text-neutral-200 border border-neutral-500/20 font-bold">{selectedAuditLog.action}</p>
                  </div>

                  {selectedAuditLog.details && (
                    <div className="space-y-1 animate-fadeIn">
                      <span className="text-neutral-400 font-semibold block">Campos Modificados (Detalhamento):</span>
                      <pre className="p-2.5 rounded-lg bg-[#202020]/90 border border-[#2E2E2E] text-neutral-300 whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
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
                      <span className="text-sky-500 font-bold block">Valor Novo:</span>
                      <pre className="p-2.5 rounded-lg bg-sky-950/20 border border-sky-500/20 text-sky-200 overflow-x-auto font-mono text-[10px] leading-relaxed max-h-48">
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
                    className="px-4 py-1.5 rounded-xl bg-neutral-600 hover:bg-neutral-700 text-white font-bold text-xs active:scale-95 transition-all"
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
            <h4 className="text-sm font-semibold text-neutral-200">{t.admin.rbac} Architecture</h4>
            <p className="text-xs text-neutral-400 mt-1">Regras e políticas de segurança aplicadas no sistema.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#202020] border border-[#2E2E2E] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#171717] border border-[#2B2B2B]">
                <span className="text-neutral-400 block mb-1">Administrador Único Configurado</span>
                <span className="font-mono text-sky-400 font-semibold">{maskEmail(ADMIN_EMAIL)}</span>
              </div>

              <div className="p-3 rounded-xl bg-[#171717] border border-[#2B2B2B]">
                <span className="text-neutral-400 block mb-1">Sua Sessão Atual</span>
                <span className="font-mono text-white font-semibold">{maskEmail(userEmail)}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#2B2B2B]">
              <span className="text-xs font-semibold text-neutral-300 block">Regras Obrigatórias de Permissão:</span>
              <ul className="space-y-1.5 text-xs text-neutral-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                  <span>Apenas a conta <code className="text-white bg-black/40 px-1 py-0.5 rounded">{maskEmail(ADMIN_EMAIL)}</code> recebe a role <code className="text-neutral-400">admin</code>.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                  <span>Todos os demais e-mails recebem automaticamente a role <code className="text-sky-400">user</code>.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                  <span>{t.admin.adminAccessDesc}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                  <span>Configuração centralizada em <code className="text-neutral-300 bg-black/40 px-1 py-0.5 rounded">src/config/admin.ts</code> para fácil manutenção.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
      {/* SUB-TAB 7: DEBUG & TOOLS */}
      {activeTab === 'debug' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#202020] border border-[#2E2E2E] space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-neutral-500/10 text-neutral-500">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Reset de Estatísticas</h4>
                  <p className="text-[10px] text-neutral-400">Zera os contadores globais de uso do sistema.</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!user) return;
                  const token = await user.getIdToken();
                  const res = await fetch('/api/admin/debug/reset-stats', {
                    method: 'POST',
                    headers: { 
                      'Authorization': `Bearer ${token}`,
                      'x-user-email': userEmail 
                    }
                  });
                  const data = await res.json();
                  alert(data.message || 'Comando enviado.');
                }}
                className="w-full py-2 rounded-xl bg-neutral-600/10 hover:bg-neutral-600/20 text-neutral-400 border border-neutral-600/30 text-xs font-semibold transition-all"
              >
                Resetar Agora
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-[#202020] border border-[#2E2E2E] space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-neutral-500/10 text-neutral-500">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Limpeza de Logs</h4>
                  <p className="text-[10px] text-neutral-400">Remove logs antigos de sistema e auditoria.</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!user) return;
                  const token = await user.getIdToken();
                  const res = await fetch('/api/admin/debug/clear-logs', {
                    method: 'POST',
                    headers: { 
                      'Authorization': `Bearer ${token}`,
                      'x-user-email': userEmail 
                    }
                  });
                  const data = await res.json();
                  alert(data.message || 'Comando enviado.');
                }}
                className="w-full py-2 rounded-xl bg-neutral-600/10 hover:bg-neutral-600/20 text-neutral-400 border border-neutral-600/30 text-xs font-semibold transition-all"
              >
                Limpar Logs
              </button>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-black/40 border border-[#2E2E2E] space-y-4">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-400" /> Diagnóstico de Conexão
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Backend API</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  <span className="text-xs text-white font-medium">Online</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">WebSocket</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  <span className="text-xs text-white font-medium">Conectado</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Stripe SDK</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  <span className="text-xs text-white font-medium">Ready</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Firestore</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  <span className="text-xs text-white font-medium">Ativo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ProtectedAdminPanel = withAdmin(AdminPanel);
