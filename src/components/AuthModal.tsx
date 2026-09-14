import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, AlertCircle, Smartphone, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleLogo } from './GoogleLogo';
import { ZenoLogo } from './ZenoLogo';
import { useTranslation } from '../i18n';
import { signInWithPhoneNumber, RecaptchaVerifier, ConfirmationResult, signInAnonymously } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { motion, AnimatePresence } from 'motion/react';

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
  
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  
  const [authMode, setAuthMode] = useState<'default' | 'phone' | 'phone_verify'>('default');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [showSuccessLogo, setShowSuccessLogo] = useState(false);

  useEffect(() => {
    if (isOpen && authMode === 'phone') {
      try {
        if (!(window as any).recaptchaVerifier) {
          (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
          });
        }
      } catch (err) {
        console.error("Error setting up reCAPTCHA", err);
      }
    }
  }, [isOpen, authMode]);

  const onAuthSuccess = () => {
    setShowSuccessLogo(true);
    setTimeout(() => {
      setShowSuccessLogo(false);
      onClose();
    }, 1200);
  };

  const handleAnonymousSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInAnonymously(auth);
      onAuthSuccess();
    } catch (err: any) {
      console.error("Anonymous Auth Error:", err);
      setError("Erro ao entrar como visitante. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(formatPhoneNumber(e.target.value));
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    const rawNumber = phoneNumber.replace(/\D/g, '');
    if (rawNumber.length !== 10 && rawNumber.length !== 11) {
      setError("O número deve conter DDD e telefone (10 ou 11 dígitos, ex: 11999999999).");
      setIsLoading(false);
      return;
    }
    
    const e164Number = `+55${rawNumber}`;

    try {
      const verifier = (window as any).recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, e164Number, verifier);
      setConfirmationResult(confirmation);
      setAuthMode('phone_verify');
    } catch (err: any) {
      console.error("Phone Auth Error:", err);
      let errorMessage = "Erro ao enviar código. Tente novamente mais tarde.";
      
      if (err.code) {
        switch (err.code) {
          case 'auth/invalid-phone-number':
            errorMessage = "Número de telefone inválido no Firebase.";
            break;
          case 'auth/too-many-requests':
          case 'auth/quota-exceeded':
            errorMessage = "Cota de SMS excedida ou muitas tentativas. Tente novamente mais tarde.";
            break;
          case 'auth/unauthorized-domain':
            errorMessage = "Domínio não autorizado. Adicione este domínio nas Configurações de Autenticação do Firebase.";
            break;
          default:
            errorMessage = `Erro Firebase (${err.code}). Consulte o console para mais detalhes.`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (confirmationResult) {
        await confirmationResult.confirm(verificationCode);
        onAuthSuccess();
      }
    } catch (err: any) {
      console.error("Verification Error:", err);
      setError("Código inválido. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error("Auth Error:", err);
      setError(err.message || "Algo deu errado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative bg-[#111111] rounded-[24px] shadow-2xl w-full max-w-[360px] border border-[#2C2C2E]/50 z-10 p-6 sm:p-8 overflow-hidden">
        {showSuccessLogo ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center h-full min-h-[300px]"
          >
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
              <ZenoLogo className="w-24 h-24 text-zeno" />
            </motion.div>
          </motion.div>
        ) : (
          <>
            <button onClick={onClose} className="absolute top-5 right-5 p-2 rounded-full hover:bg-[#232326] text-neutral-500 transition-colors z-20">
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-[22px] font-bold text-white mb-6 text-center">Entre ou cadastre-se</h2>
            
            {error && <div className="mb-4 p-3 rounded-[12px] bg-red-950/30 text-red-400 text-[12px]">{error}</div>}

            <div id="recaptcha-container"></div>

            <AnimatePresence mode='wait'>
              <motion.div
                key={authMode}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {authMode === 'default' && (
                  <div className="space-y-3">
                    <button onClick={async () => { try { await signInWithGoogle(); onAuthSuccess(); } catch (e) { setError("Erro ao conectar com Google"); } }} className="w-full h-[46px] flex items-center justify-center gap-3 rounded-full border border-[#2C2C2E] bg-transparent text-white hover:bg-[#1C1C1E] transition-all text-[14px]">
                      <GoogleLogo className="w-5 h-5" /> Continuar com Google
                    </button>
                    <button onClick={() => setAuthMode('phone')} className="w-full h-[46px] flex items-center justify-center gap-3 rounded-full border border-[#2C2C2E] bg-transparent text-white hover:bg-[#1C1C1E] transition-all text-[14px]">
                      <Smartphone className="w-5 h-5" /> Continuar com telefone
                    </button>
                    <button onClick={handleAnonymousSignIn} className="w-full h-[46px] flex items-center justify-center gap-3 rounded-full bg-[#1C1C1E] text-white hover:bg-[#2C2C2E] transition-all text-[14px]">
                      <UserIcon className="w-5 h-5" /> Continuar sem conta
                    </button>
                  </div>
                )}

                {authMode === 'phone' && (
                  <form onSubmit={handleSendCode} className="space-y-4">
                    <div className="relative flex items-center w-full h-[46px] rounded-full bg-black border border-[#2C2C2E] overflow-hidden focus-within:ring-2 focus-within:ring-zeno focus-within:border-transparent transition-all">
                      <div className="flex items-center justify-center px-4 h-full bg-[#1C1C1E] text-neutral-400 text-[14px] font-medium border-r border-[#2C2C2E]">
                        +55
                      </div>
                      <input 
                        type="tel" 
                        placeholder="(11) 99999-9999" 
                        value={phoneNumber} 
                        onChange={handlePhoneChange} 
                        className="flex-1 px-4 h-full bg-transparent text-white border-none focus:ring-0 text-[14px] outline-none" 
                        maxLength={15}
                      />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full h-[46px] rounded-full bg-zeno text-white font-medium">Enviar código</button>
                    <button type="button" onClick={() => setAuthMode('default')} className="w-full text-[13px] text-neutral-500">Voltar</button>
                  </form>
                )}

                {authMode === 'phone_verify' && (
                  <form onSubmit={handleVerifyCode} className="space-y-4">
                    <input type="text" placeholder="Código de 6 dígitos" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} className="w-full px-5 h-[46px] rounded-full bg-black text-white border-none focus:ring-2 focus:ring-zeno text-[14px] text-center" maxLength={6} />
                    <button type="submit" disabled={isLoading} className="w-full h-[46px] rounded-full bg-zeno text-white font-medium">Verificar</button>
                    <button type="button" onClick={() => setAuthMode('phone')} className="w-full text-[13px] text-neutral-500">Voltar</button>
                  </form>
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
};
