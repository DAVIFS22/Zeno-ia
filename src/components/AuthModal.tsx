import React, { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { ZenoLogo } from './ZenoLogo';
import { GoogleLogo } from './GoogleLogo';
import { useTranslation } from '../i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, message }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isLogin) {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/web-storage-unsupported') {
        alert(t.auth.googlePopupError || "O login pelo Google pode ser bloqueado pelo navegador dentro da janela de preview (iframe). Para fazer login, abra o app em uma nova aba e tente novamente.");
      } else {
        alert(t.common.error + ": " + err.message);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />
          
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="relative bg-[#111111] rounded-[24px] shadow-2xl w-full max-w-[440px] border border-[#2C2C2E]/50 overflow-hidden z-10"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={onClose} 
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-[#232326] text-neutral-500 transition-colors z-20"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="p-8 sm:p-12">
              <div className="flex flex-col items-center text-center mb-10">
                <div className="mb-6">
                  <ZenoLogo size={48} variant="monochrome" theme="dark" />
                </div>
                
                <h2 className="text-[28px] font-bold tracking-tight text-white mb-3">
                  {isLogin ? t.auth.signInTitle || 'Entrar no ZENO AI' : t.auth.signUpTitle || 'Criar conta ZENO AI'}
                </h2>
                
                <p className="text-[14px] text-neutral-400 leading-relaxed max-w-[320px]">
                  {message || t.auth.welcomeMessage || "Faça login para acessar suas conversas, sincronizar seu histórico, gerenciar sua assinatura ZENO Pro e utilizar todos os recursos da plataforma."}
                </p>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={handleGoogleSignIn} 
                  className="w-full h-[52px] flex items-center justify-center gap-3 rounded-full border border-[#2C2C2E] bg-transparent text-white hover:bg-[#1C1C1E] transition-all font-medium text-[15px]"
                >
                  <GoogleLogo className="w-5 h-5 flex-shrink-0" />
                  {t.auth.google}
                </button>

                <div className="flex items-center gap-4 py-2">
                  <div className="flex-1 h-[1px] bg-[#1C1C1E]"></div>
                  <span className="text-[12px] text-neutral-600 font-medium tracking-widest uppercase">{t.common.or || 'ou'}</span>
                  <div className="flex-1 h-[1px] bg-[#1C1C1E]"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-3">
                    <input 
                      type="email" 
                      placeholder={t.auth.email} 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      className="w-full px-5 h-[52px] rounded-[16px] bg-[#1a1a1a] text-white border border-[#2C2C2E] focus:outline-none focus:border-neutral-600 transition-all text-[15px] placeholder:text-neutral-600"
                    />
                    
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        placeholder={t.auth.password} 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        className="w-full px-5 h-[52px] pr-12 rounded-[16px] bg-[#1a1a1a] text-white border border-[#2C2C2E] focus:outline-none focus:border-neutral-600 transition-all text-[15px] placeholder:text-neutral-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {isLogin && (
                    <div className="flex justify-end">
                      <button type="button" className="text-[13px] text-neutral-500 hover:text-white transition-colors">
                        {t.auth.forgotPassword}
                      </button>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full h-[54px] rounded-[18px] bg-white text-black hover:bg-neutral-200 font-bold transition-all text-[16px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? t.common.loading : t.common.next}
                  </button>
                </form>
              </div>

              <div className="mt-10 text-center">
                <p className="text-[14px] text-neutral-500">
                  {isLogin ? t.auth.noAccount : t.auth.hasAccount}
                  <button 
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="ml-2 text-white font-bold hover:underline focus:outline-none"
                  >
                    {isLogin ? t.auth.signUp : t.auth.signIn}
                  </button>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

