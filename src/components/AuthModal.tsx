import React, { useState } from 'react';
import { X, Eye, EyeOff, AlertCircle } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  const validateEmail = (email: string) => {
    return email.includes('@') && email.includes('.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    if (!validateEmail(email)) {
      setError(t.auth.invalidEmail || "Esse e-mail não parece válido. Confira e tente novamente.");
      setErrorCode('auth/invalid-email');
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      onClose();
    } catch (err: any) {
      console.error("Auth Error:", err);
      setErrorCode(err.code);
      if (err.code === 'auth/email-already-in-use') {
        setError(t.auth.emailAlreadyInUse || "Este e-mail já está cadastrado. Que tal entrar na sua conta?");
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError(t.auth.invalidCredentials || "E-mail ou senha incorretos. Tente novamente.");
      } else if (err.code === 'auth/weak-password') {
        setError(t.auth.weakPassword || "Sua senha precisa ter pelo menos 6 caracteres.");
      } else if (err.code === 'auth/invalid-email') {
        setError(t.auth.invalidEmail || "Esse e-mail não parece válido. Confira e tente novamente.");
      } else if (err.code === 'auth/too-many-requests') {
        setError(t.auth.tooManyRequests || "Muitas tentativas. Aguarde um momento e tente novamente.");
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(t.auth.unauthorizedDomain || "Este domínio não está autorizado para autenticação no Firebase.");
      } else {
        setError(t.auth.genericError || "Algo deu errado. Tente novamente em instantes.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setErrorCode(null);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      setErrorCode(err.code);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/web-storage-unsupported') {
        setError(t.auth.googlePopupError || "O login pelo Google pode ser bloqueado pelo navegador dentro da janela de preview (iframe). Para fazer login, abra o app em uma nova aba e tente novamente.");
      } else {
        setError(err.message || t.common.error);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
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
            className="relative bg-[#111111] rounded-[24px] shadow-2xl w-full max-w-[360px] border border-[#2C2C2E]/50 max-h-[90vh] overflow-y-auto z-10"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={onClose} 
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-[#232326] text-neutral-500 transition-colors z-20"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="p-5 sm:p-8">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="mb-3">
                  <ZenoLogo size={32} variant="monochrome" theme="dark" />
                </div>
                
                <h2 className="text-[22px] font-bold tracking-tight text-white mb-2">
                  Entre ou cadastre-se
                </h2>
                
                <p className="text-[13px] text-neutral-400 leading-relaxed max-w-[280px]">
                  Você vai poder aproveitar respostas inteligentes e, além disso, carregar imagens, arquivos e muito mais.
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3 rounded-[12px] bg-[#1C1C1E] border border-[#2C2C2E] flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="text-neutral-500 mt-0.5">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] text-neutral-300 leading-snug">{error}</p>
                    {errorCode === 'auth/email-already-in-use' && !isLogin && (
                      <button 
                        onClick={() => {
                          setIsLogin(true);
                          setError(null);
                          setErrorCode(null);
                        }}
                        className="mt-2 text-white text-[12px] font-bold hover:underline block"
                      >
                        {t.auth.signInInstead || "Entrar na sua conta"}
                      </button>
                    )}
                    {errorCode === 'auth/weak-password' && (
                      <p className="mt-1 text-[11px] text-neutral-500">
                        Sugestão: Use uma combinação de letras, números e símbolos para maior segurança.
                      </p>
                    )}
                    {(errorCode === 'auth/invalid-credential' || errorCode === 'auth/wrong-password') && isLogin && (
                      <button 
                        type="button"
                        className="mt-2 text-white text-[12px] font-bold hover:underline block"
                      >
                        {t.auth.forgotPassword || "Esqueci minha senha"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <button 
                  onClick={handleGoogleSignIn} 
                  className="w-full h-[46px] flex items-center justify-center gap-3 rounded-full border border-[#2C2C2E] bg-transparent text-white hover:bg-[#1C1C1E] transition-all font-medium text-[14px]"
                >
                  <GoogleLogo className="w-5 h-5 flex-shrink-0" />
                  Continuar com o Google
                </button>

                <button 
                  onClick={() => setError("O login por telefone requer configuração de SMS no Firebase. Em breve!")} 
                  className="w-full h-[46px] flex items-center justify-center gap-3 rounded-full border border-[#2C2C2E] bg-transparent text-white hover:bg-[#1C1C1E] transition-all font-medium text-[14px]"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Continuar com um telefone
                </button>

                <div className="flex items-center gap-4 py-1.5">
                  <div className="flex-1 h-[1px] bg-[#2C2C2E]"></div>
                  <span className="text-[11px] text-neutral-500 font-medium tracking-widest uppercase">OU</span>
                  <div className="flex-1 h-[1px] bg-[#2C2C2E]"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-2">
                    <input 
                      type="email" 
                      placeholder="Endereço de e-mail" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      className="w-full px-5 h-[46px] rounded-full bg-black text-white border-none focus:outline-none focus:ring-2 focus:ring-neutral-600 transition-all text-[14px] placeholder:text-neutral-500"
                    />
                    
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        placeholder={t.auth.password} 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        className="w-full px-5 h-[46px] pr-12 rounded-full bg-black text-white border-none focus:outline-none focus:ring-2 focus:ring-neutral-600 transition-all text-[14px] placeholder:text-neutral-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {isLogin && (
                    <div className="flex justify-end px-2">
                      <button type="button" className="text-[12px] text-neutral-500 hover:text-white transition-colors">
                        {t.auth.forgotPassword}
                      </button>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full h-[48px] rounded-full bg-white text-black hover:bg-neutral-200 font-medium transition-all text-[15px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? t.common.loading : "Continuar"}
                  </button>
                </form>
              </div>

              <div className="mt-6 text-center">
                <p className="text-[13px] text-neutral-500">
                  {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}
                  <button 
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="ml-2 text-white hover:underline focus:outline-none"
                  >
                    {isLogin ? "Cadastre-se" : "Entrar"}
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

