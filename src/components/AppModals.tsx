import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { useUIState, useModal } from '../hooks/useUIState';
import { UserSettings, ChatSession } from '../types';
import { EditProfileModal } from './EditProfileModal';
import { SubscriptionManager } from './SubscriptionManager';
import { PlansModal } from './PlansModal';
import { SettingsModal } from './SettingsModal';
import { ImageStudioModal } from './ImageStudioModal';
import { ImageLibraryModal } from './ImageLibraryModal';
import { ProjectsModal } from './ProjectsModal';
import { PluginsModal } from './PluginsModal';
import { MoreModal } from './MoreModal';
import { ProFeatureModal } from './ProFeatureModal';
import { AuthModal } from './AuthModal';
import { MusicStudioModal } from './MusicStudioModal';
import { AdaptiveLearningModal } from './AdaptiveLearningModal';
import { PythonLearningModule } from './PythonLearningModule';
import { GamificationModal } from './GamificationModal';
import { VersionNewsModal } from './VersionNewsModal';
import { AdaptiveLearningProfile } from '../types';

interface AppModalsProps {
  theme: 'dark' | 'light';
  userSettings: UserSettings;
  onUpdateSettings: (settings: Partial<UserSettings>) => void;
  adaptiveProfile?: AdaptiveLearningProfile;
  onUpdateAdaptiveProfile?: (updated: AdaptiveLearningProfile) => void;
  userId: string;
  profile: any;
  session: any;
  logout: () => void;
  signInWithGoogle: (opts?: any) => void;
  switchAccount: (uid: string) => void;
  authLoading: boolean;
  backendLimits: any;
  adminConfig: any;
  onClearHistory: () => void;
  onExportAllData: () => void;
  onDeleteSession: (sessionId: string) => void;
  onSubmitPrompt: (e?: any, text?: string) => void;
  sessions: ChatSession[];
  onSelectSession: (id: string) => void;
  onLimitReached: () => void;
  dailyUsage: any;
  onUpdateUsage: (newUsage: any) => void;
}

export const AppModals: React.FC<AppModalsProps> = React.memo(({
  theme,
  userSettings,
  onUpdateSettings,
  adaptiveProfile,
  onUpdateAdaptiveProfile,
  userId,
  profile,
  session,
  logout,
  signInWithGoogle,
  switchAccount,
  authLoading,
  backendLimits,
  adminConfig,
  onClearHistory,
  onExportAllData,
  onDeleteSession,
  onSubmitPrompt,
  sessions,
  onSelectSession,
  onLimitReached,
  dailyUsage,
  onUpdateUsage,
}) => {
  const ui = useUIState();

  // Individual modal hooks for targeted state access
  const subscriptionModal = useModal<{ reasonMessage?: string }>('subscription');
  const plansModal = useModal('plans');
  const proFeatureModal = useModal('proFeature');
  const settingsModal = useModal('settings');
  const editProfileModal = useModal('editProfile');
  const adaptiveModal = useModal('adaptive');
  const imageStudioModal = useModal('imageStudio');
  const imageLibraryModal = useModal('imageLibrary');
  const projectsModal = useModal('projects');
  const pluginsModal = useModal('plugins');
  const moreModal = useModal('more');
  const pythonLearningModal = useModal('pythonLearning');
  const gamificationModal = useModal('gamification');
  const musicStudioModal = useModal('musicStudio');
  const deleteSessionModal = useModal<{ sessionId: string }>('deleteSession');
  const renewalNotificationModal = useModal<{ activeNotification: any }>('renewalNotification');
  const authModal = useModal<{ message?: string }>('auth');
  const versionNewsModal = useModal('versionNews');

  const activeRenewalNotification = renewalNotificationModal.data?.activeNotification;
  const deletingSessionId = deleteSessionModal.data?.sessionId;

  return (
    <>
      {musicStudioModal.isOpen && (
        <MusicStudioModal
          isOpen={musicStudioModal.isOpen}
          onClose={musicStudioModal.close}
          userPlan={userSettings.plan}
          userEmail={userSettings.userEmail || profile?.email || ''}
          dailyUsage={dailyUsage}
          onUpdateUsage={onUpdateUsage}
          geminiApiKey={userSettings.geminiApiKey}
        />
      )}
      {/* Pro Feature Modal */}
      {authModal.isOpen && (
        <AuthModal
          isOpen={authModal.isOpen}
          onClose={() => ui.closeModal('auth')}
          message={authModal.data?.message}
        />
      )}
      {proFeatureModal.isOpen && (
        <ProFeatureModal
          theme={theme}
          onClose={proFeatureModal.close}
          onUpgrade={() => {
            proFeatureModal.close();
            const isProUser = profile?.isPro || profile?.unlimited || profile?.role === 'admin';
            if (isProUser) {
              ui.openModal('subscription');
            } else {
              ui.openModal('plans');
            }
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteSessionModal.isOpen && deletingSessionId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className={`rounded-2xl p-6 max-w-sm w-full border shadow-2xl ${
            theme === 'dark' ? 'bg-[#1e1e24] border-[#2C2C2E] text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
          }`}>
            <h3 className="font-bold text-lg mb-2">Excluir Conversa</h3>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              Tem certeza de que deseja apagar esta conversa? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={deleteSessionModal.close}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  theme === 'dark' ? 'hover:bg-[#232326] text-neutral-300' : 'hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteSession(deletingSessionId);
                  deleteSessionModal.close();
                }}
                className="px-4 py-2 bg-neutral-600 hover:bg-neutral-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZENO Subscription / Manage Subscription Modal */}
      {subscriptionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div 
            className={`relative w-full max-w-4xl rounded-3xl border shadow-2xl overflow-hidden my-auto transition-all ${
              theme === 'dark' 
                ? 'bg-[#121215] border-[#2C2C2E] text-neutral-100' 
                : 'bg-white border-neutral-200 text-neutral-900'
            }`}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${
              theme === 'dark' ? 'border-[#2C2C2E]/80 bg-[#17171c]' : 'border-neutral-200/80 bg-neutral-50/80'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-neutral-500/10 border border-neutral-500/20 flex items-center justify-center text-neutral-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm sm:text-base tracking-tight">ZENO Pro</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      theme === 'dark' ? 'bg-[#232326] text-neutral-300 border-[#2C2C2E]' : 'bg-neutral-200 text-neutral-700 border-neutral-300'
                    }`}>
                      Gerenciamento
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400">Status, renovação, forma de pagamento e faturas</p>
                </div>
              </div>

              <button
                onClick={subscriptionModal.close}
                aria-label="Fechar"
                className={`p-2 rounded-full transition-colors ${
                  theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400 hover:text-white' : 'hover:bg-neutral-200 text-neutral-600 hover:text-black'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Optional Reason Message Banner */}
            {subscriptionModal.data?.reasonMessage && (
              <div className={`px-6 py-2.5 text-xs font-medium flex items-center gap-2 border-b ${
                theme === 'dark' ? 'bg-[#1C1C1E] border-[#2C2C2E] text-neutral-200' : 'bg-neutral-100 border-neutral-200 text-neutral-800'
              }`}>
                <Sparkles className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                <span>{subscriptionModal.data.reasonMessage}</span>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-6 sm:p-8 max-h-[82vh] overflow-y-auto scrollbar-custom">
              <SubscriptionManager
                userId={userId}
                settings={userSettings}
                onUpdateSettings={onUpdateSettings}
                onOpenCheckout={async (plan) => {
                  try {
                    const res = await fetch('/api/create-checkout-session', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        plan: plan || 'monthly', 
                        email: userSettings.userEmail, 
                        hasUsedFreeTrial: userSettings.hasUsedFreeTrial,
                        userId
                      })
                    });
                    const data = await res.json();
                    if (data.url) {
                      window.open(data.url, '_blank');
                    } else {
                      alert(data.error || 'Erro ao iniciar o checkout.');
                    }
                  } catch (err) {
                    alert('Erro ao iniciar o checkout.');
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Plans Selection Modal */}
      {plansModal.isOpen && (
        <PlansModal
          isOpen={plansModal.isOpen}
          onClose={plansModal.close}
          settings={userSettings}
          userId={userId}
          onOpenCheckout={async (plan) => {
            try {
              const res = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  plan: plan || 'monthly', 
                  email: userSettings.userEmail, 
                  hasUsedFreeTrial: userSettings.hasUsedFreeTrial,
                  userId
                })
              });
              const data = await res.json();
              if (data.url) {
                window.open(data.url, '_blank');
              } else {
                alert(data.error || 'Erro ao iniciar o checkout.');
              }
            } catch (err) {
              alert('Erro ao iniciar o checkout.');
            }
          }}
        />
      )}

      {/* Tabbed Settings Modal */}
      <SettingsModal
        backendLimits={backendLimits}
        adminConfig={adminConfig}
        isOpen={settingsModal.isOpen}
        onClose={settingsModal.close}
        settings={userSettings}
        onUpdateSettings={onUpdateSettings}
        onClearHistory={onClearHistory}
        onExportAllData={onExportAllData}
        onOpenSubscriptionModal={() => ui.openModal('subscription')}
        onOpenAdaptiveModal={() => ui.openModal('adaptive')}
        onOpenEditProfileModal={() => ui.openModal('editProfile')}
        user={profile}
        userId={userId}
        session={session}
        onLogout={logout}
        onLogin={() => ui.openModal('auth')}
        onSwitchAccount={switchAccount}
        authLoading={authLoading}
      />

      {editProfileModal.isOpen && (
        <EditProfileModal
          isOpen={editProfileModal.isOpen}
          onClose={editProfileModal.close}
          user={profile}
          onUpdate={() => {}}
          isDark={theme === 'dark'}
        />
      )}

      {/* Adaptive Learning Profile Modal */}
      {adaptiveProfile && (
        <AdaptiveLearningModal
          isOpen={adaptiveModal.isOpen}
          onClose={adaptiveModal.close}
          profile={adaptiveProfile}
          onUpdateProfile={(updated) => {
            if (onUpdateAdaptiveProfile) {
              onUpdateAdaptiveProfile(updated);
            }
          }}
          userId={userId}
        />
      )}

      {/* Image Generation Studio Modal */}
      <ImageStudioModal
        isOpen={imageStudioModal.isOpen}
        onClose={imageStudioModal.close}
        theme={theme}
        userEmail={userSettings.userEmail}
        userId={userId}
        plan={userSettings.plan}
        onOpenProFeatureModal={() => ui.openModal('proFeature')}
        onLimitReached={onLimitReached}
        onSendToChat={(imageUrl, promptText) => {
          imageStudioModal.close();
          onSubmitPrompt(undefined, `Criei esta imagem com o ZENO Vision:\n\n![${promptText}](${imageUrl})`);
        }}
      />

      {/* ZENO Image Library Modal */}
      <ImageLibraryModal
        isOpen={imageLibraryModal.isOpen}
        onClose={imageLibraryModal.close}
        userPlan={userSettings.plan}
        theme={theme}
        userId={userId}
        onOpenChat={() => {
          imageLibraryModal.close();
          onSelectSession('');
        }}
        onReusePrompt={(promptText) => {
          imageLibraryModal.close();
          onSubmitPrompt(undefined, `Gere uma imagem: ${promptText}`);
        }}
        onOpenConversation={(sessionId) => {
          if (sessions.some(s => s.id === sessionId)) {
            onSelectSession(sessionId);
          }
          imageLibraryModal.close();
        }}
        onOpenStudioWithPrompt={(promptText) => {
          imageLibraryModal.close();
          if (promptText) {
            onSubmitPrompt(undefined, `Gere uma imagem: ${promptText}`);
          } else {
            onSelectSession('');
          }
        }}
        onUpgradeClick={() => {
          imageLibraryModal.close();
          ui.openModal('subscription', {
            data: { reasonMessage: 'Faça upgrade para o Plano Pro para ter armazenamento de imagens ilimitado.' }
          });
        }}
      />

      {/* Projects Modal */}
      <ProjectsModal
        isOpen={projectsModal.isOpen}
        onClose={projectsModal.close}
      />

      {/* Plugins Modal */}
      <PluginsModal
        isOpen={pluginsModal.isOpen}
        onClose={pluginsModal.close}
      />

      {/* More Modal */}
      <MoreModal
        isOpen={moreModal.isOpen}
        onClose={moreModal.close}
        onOpenSettings={() => {
          moreModal.close();
          ui.openModal('settings');
        }}
        onOpenSubscription={() => {
          moreModal.close();
          ui.openModal('subscription');
        }}
        onOpenPythonLearning={() => {
          moreModal.close();
          pythonLearningModal.open();
        }}
        onOpenGamification={() => {
          moreModal.close();
          gamificationModal.open();
        }}
      />

      {/* Python Learning Module Modal */}
      <PythonLearningModule
        isOpen={pythonLearningModal.isOpen}
        onClose={pythonLearningModal.close}
        theme={theme}
      />

      {/* Gamification Modal */}
      <GamificationModal
        isOpen={gamificationModal.isOpen}
        onClose={gamificationModal.close}
        theme={theme}
      />

      {/* Subscription Renewal Notification Modal */}
      {renewalNotificationModal.isOpen && activeRenewalNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#222222] border border-[#333333] shadow-2xl space-y-5 text-left">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zeno/10 border border-zeno/20 flex items-center justify-center text-zeno">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{activeRenewalNotification.title}</h3>
                  <span className="text-xs text-neutral-400">Notificação Oficial ZENO Pro</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[#2c2c2c] text-sm text-neutral-300 whitespace-pre-line leading-relaxed">
              {activeRenewalNotification.text}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              {activeRenewalNotification.buttons?.map((btn: string, i: number) => {
                if (btn === 'Gerenciar assinatura') {
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        renewalNotificationModal.close();
                        ui.openModal('settings');
                      }}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-zeno hover:bg-zeno text-white font-medium text-sm transition-colors text-center"
                    >
                      {btn}
                    </button>
                  );
                } else if (btn === 'Atualizar forma de pagamento' || btn === 'Atualizar pagamento') {
                  return (
                    <button
                      key={i}
                      onClick={async () => {
                        try {
                          await fetch('/api/subscription/update-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId, paymentMethod: { brand: 'visa', last4: '8899' } })
                          });
                          alert('Forma de pagamento atualizada com sucesso!');
                          renewalNotificationModal.close();
                        } catch (err) {
                          alert('Erro ao atualizar pagamento.');
                        }
                      }}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-zeno hover:bg-zeno text-white font-medium text-sm transition-colors text-center"
                    >
                      {btn}
                    </button>
                  );
                } else {
                  return (
                    <button
                      key={i}
                      onClick={renewalNotificationModal.close}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-[#333333] hover:bg-[#404040] text-neutral-200 font-medium text-sm transition-colors text-center"
                    >
                      {btn}
                    </button>
                  );
                }
              })}
            </div>
          </div>
        </div>
      )}

      {/* Version News Modal */}
      {versionNewsModal.isOpen && (
        <VersionNewsModal
          isOpen={versionNewsModal.isOpen}
          onClose={versionNewsModal.close}
          isDark={theme === 'dark'}
        />
      )}
    </>
  );
});

AppModals.displayName = 'AppModals';
