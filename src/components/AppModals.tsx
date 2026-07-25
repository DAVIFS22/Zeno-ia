import React from 'react';
import { Sparkles } from 'lucide-react';
import { useUIState, useModal } from '../hooks/useUIState';
import { UserSettings, ChatSession } from '../types';
import { SubscriptionModal } from './SubscriptionModal';
import { SettingsModal } from './SettingsModal';
import { ImageStudioModal } from './ImageStudioModal';
import { ImageLibraryModal } from './ImageLibraryModal';
import { ProjectsModal } from './ProjectsModal';
import { PluginsModal } from './PluginsModal';
import { MoreModal } from './MoreModal';
import { ProFeatureModal } from './ProFeatureModal';

interface AppModalsProps {
  theme: 'dark' | 'light';
  userSettings: UserSettings;
  onUpdateSettings: (settings: Partial<UserSettings>) => void;
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
}

export const AppModals: React.FC<AppModalsProps> = React.memo(({
  theme,
  userSettings,
  onUpdateSettings,
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
}) => {
  const ui = useUIState();

  // Individual modal hooks for targeted state access
  const subscriptionModal = useModal<{ reasonMessage?: string }>('subscription');
  const proFeatureModal = useModal('proFeature');
  const settingsModal = useModal('settings');
  const imageStudioModal = useModal('imageStudio');
  const imageLibraryModal = useModal('imageLibrary');
  const projectsModal = useModal('projects');
  const pluginsModal = useModal('plugins');
  const moreModal = useModal('more');
  const deleteSessionModal = useModal<{ sessionId: string }>('deleteSession');
  const renewalNotificationModal = useModal<{ activeNotification: any }>('renewalNotification');

  const activeRenewalNotification = renewalNotificationModal.data?.activeNotification;
  const deletingSessionId = deleteSessionModal.data?.sessionId;

  return (
    <>
      {/* Pro Feature Modal */}
      {proFeatureModal.isOpen && (
        <ProFeatureModal
          theme={theme}
          onClose={proFeatureModal.close}
          onUpgrade={() => {
            proFeatureModal.close();
            ui.openModal('subscription');
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteSessionModal.isOpen && deletingSessionId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className={`rounded-2xl p-6 max-w-sm w-full border shadow-2xl ${
            theme === 'dark' ? 'bg-[#1e1e24] border-neutral-800 text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
          }`}>
            <h3 className="font-bold text-lg mb-2">Excluir Conversa</h3>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              Tem certeza de que deseja apagar esta conversa? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={deleteSessionModal.close}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  theme === 'dark' ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteSession(deletingSessionId);
                  deleteSessionModal.close();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZENO Subscription Modal */}
      <SubscriptionModal
        isOpen={subscriptionModal.isOpen}
        onClose={subscriptionModal.close}
        settings={userSettings}
        onUpdateSettings={onUpdateSettings}
        reasonMessage={subscriptionModal.data?.reasonMessage}
      />

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
        user={profile}
        session={session}
        onLogout={logout}
        onLogin={(isAdding) => signInWithGoogle({ isAddingAccount: !!isAdding })}
        onSwitchAccount={switchAccount}
        authLoading={authLoading}
      />

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
        onOpenConversation={(sessionId) => {
          if (sessions.some(s => s.id === sessionId)) {
            onSelectSession(sessionId);
          }
          imageLibraryModal.close();
        }}
        onOpenStudioWithPrompt={() => {
          imageLibraryModal.close();
          ui.openModal('imageStudio');
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
      />

      {/* Subscription Renewal Notification Modal */}
      {renewalNotificationModal.isOpen && activeRenewalNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#222222] border border-[#333333] shadow-2xl space-y-5 text-left">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
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
                      className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors text-center"
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
                      className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors text-center"
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
    </>
  );
});

AppModals.displayName = 'AppModals';
