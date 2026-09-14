const fs = require('fs');

let content = fs.readFileSync('src/components/AuthModal.tsx', 'utf-8');

// 1. Add Imports
if (!content.includes('signInWithPhoneNumber')) {
  content = content.replace(
    "import { useTranslation } from '../i18n';",
    "import { useTranslation } from '../i18n';\nimport { signInWithPhoneNumber, RecaptchaVerifier, ConfirmationResult, signInAnonymously } from 'firebase/auth';\nimport { auth } from '../lib/firebase';"
  );
}

// 2. Add State
if (!content.includes('setAuthMode')) {
  content = content.replace(
    "const [errorCode, setErrorCode] = useState<string | null>(null);",
    `const [errorCode, setErrorCode] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'default' | 'phone' | 'phone_verify'>('default');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);`
  );
}

// 3. Setup Phone Auth Handlers
if (!content.includes('setupRecaptcha')) {
  const handleGoogleSignInPos = content.indexOf('const handleGoogleSignIn');
  const phoneAuthLogic = `
  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible'
        });
      } catch (e) {
        console.error("Recaptcha setup error", e);
      }
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setIsLoading(true);
    setError(null);
    setErrorCode(null);
    setupRecaptcha();
    
    try {
      const appVerifier = (window as any).recaptchaVerifier;
      const confirmResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(confirmResult);
      setAuthMode('phone_verify');
    } catch (err: any) {
      console.error("Phone Auth Error:", err);
      setErrorCode(err.code);
      if (err.code === 'auth/invalid-phone-number') {
        setError("Número de telefone inválido/mal formatado. Verifique se incluiu o código do país (ex: +55).");
      } else if (err.code === 'auth/quota-exceeded' || err.code === 'auth/too-many-requests') {
        setError("Limite de tentativas/SMS excedido. Tente novamente mais tarde.");
      } else if (err.code === 'auth/missing-client-identifier' || err.code === 'auth/captcha-check-failed') {
        setError("Erro de reCAPTCHA não resolvido. Tente novamente.");
      } else {
        setError("Erro ao enviar SMS. Verifique o número e tente novamente.");
      }
      if ((window as any).recaptchaVerifier) {
        try { (window as any).recaptchaVerifier.clear(); } catch(e){}
        (window as any).recaptchaVerifier = null;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || !confirmationResult) return;
    setIsLoading(true);
    setError(null);
    setErrorCode(null);
    
    try {
      await confirmationResult.confirm(verificationCode);
      handleCloseModal();
    } catch (err: any) {
      console.error("Verification Error:", err);
      setErrorCode(err.code);
      if (err.code === 'auth/invalid-verification-code') {
        setError("Código de verificação incorreto. Tente novamente.");
      } else if (err.code === 'auth/code-expired') {
        setError("Código expirado. Volte e solicite um novo código.");
      } else {
        setError("Erro ao verificar código. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInAnonymously(auth);
      handleCloseModal();
    } catch (err: any) {
      console.error("Anonymous Auth Error:", err);
      setError("Não foi possível entrar como visitante. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setAuthMode('default');
    setPhoneNumber('');
    setVerificationCode('');
    setError(null);
    setErrorCode(null);
    if ((window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      } catch (e) {}
    }
    onClose();
  };
`;

  content = content.slice(0, handleGoogleSignInPos) + phoneAuthLogic + '\n  ' + content.slice(handleGoogleSignInPos);
}

// 4. Replace onClose inside handleSubmit and handleGoogleSignIn
content = content.replace(/onClose\(\)/g, 'handleCloseModal()');
content = content.replace(/handleCloseModal\(\)\s*;/g, 'handleCloseModal();');
// Since I just defined handleCloseModal, let's fix the declaration of handleCloseModal to not be replaced.
content = content.replace(/handleCloseModal\(\) \{\n    setAuthMode/g, 'handleCloseModal = () => {\n    setAuthMode');
content = content.replace(/onClick=\{onClose\}/g, 'onClick={handleCloseModal}');

// Restore the definition of AuthModalProps onClose
content = content.replace(/onClose: \(\) => void;/g, 'onClose: () => void;');
content = content.replace(/\{ isOpen, handleCloseModal, message \}/g, '{ isOpen, onClose, message }');

// We need to replace the Phone button logic, and add the new "Continuar sem conta" button.
// The default state rendering
const defaultControls = `
                <button 
                  onClick={handleGoogleSignIn} 
                  className="w-full h-[46px] flex items-center justify-center gap-3 rounded-full border border-[#2C2C2E] bg-transparent text-white hover:bg-[#1C1C1E] transition-all font-medium text-[14px]"
                >
                  <GoogleLogo className="w-5 h-5 flex-shrink-0" />
                  Continuar com o Google
                </button>

                <button 
                  onClick={() => setAuthMode('phone')} 
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

                <div className="pt-2 flex justify-center">
                  <button 
                    type="button"
                    onClick={handleAnonymousSignIn}
                    className="text-[13px] text-neutral-500 hover:text-white transition-colors underline-offset-4 hover:underline"
                  >
                    Continuar sem conta
                  </button>
                </div>
`;

const phoneControls = `
                <form onSubmit={handleSendCode} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[13px] text-neutral-400">
                      Digite seu número de telefone com o código do país (ex: +5511999999999).
                    </label>
                    <input 
                      type="tel" 
                      placeholder="+55 11 99999-9999" 
                      value={phoneNumber} 
                      onChange={e => setPhoneNumber(e.target.value)} 
                      className="w-full px-5 h-[46px] rounded-full bg-black text-white border-none focus:outline-none focus:ring-2 focus:ring-neutral-600 transition-all text-[14px] placeholder:text-neutral-500"
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={isLoading || !phoneNumber}
                    className="w-full h-[48px] rounded-full bg-white text-black hover:bg-neutral-200 font-medium transition-all text-[15px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? t.common.loading : "Enviar código por SMS"}
                  </button>
                  
                  <div className="pt-2 flex justify-center">
                    <button 
                      type="button"
                      onClick={() => { setAuthMode('default'); setError(null); setErrorCode(null); }}
                      className="text-[13px] text-neutral-500 hover:text-white transition-colors"
                    >
                      Voltar
                    </button>
                  </div>
                </form>
`;

const verifyControls = `
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[13px] text-neutral-400">
                      Enviamos um código por SMS. Digite abaixo para confirmar.
                    </label>
                    <input 
                      type="text" 
                      placeholder="Código de 6 dígitos" 
                      value={verificationCode} 
                      onChange={e => setVerificationCode(e.target.value)} 
                      className="w-full px-5 h-[46px] rounded-full bg-black text-white border-none focus:outline-none focus:ring-2 focus:ring-neutral-600 transition-all text-[14px] placeholder:text-neutral-500 tracking-widest text-center"
                      maxLength={6}
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={isLoading || verificationCode.length < 6}
                    className="w-full h-[48px] rounded-full bg-white text-black hover:bg-neutral-200 font-medium transition-all text-[15px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? t.common.loading : "Verificar e Entrar"}
                  </button>
                  
                  <div className="pt-2 flex justify-center">
                    <button 
                      type="button"
                      onClick={() => { setAuthMode('phone'); setVerificationCode(''); setError(null); setErrorCode(null); }}
                      className="text-[13px] text-neutral-500 hover:text-white transition-colors"
                    >
                      Voltar
                    </button>
                  </div>
                </form>
`;

const renderBlock = `
              <div id="recaptcha-container"></div>
              <div className="space-y-3">
                {authMode === 'default' && (
                  <React.Fragment>
${defaultControls}
                  </React.Fragment>
                )}

                {authMode === 'phone' && (
                  <React.Fragment>
${phoneControls}
                  </React.Fragment>
                )}

                {authMode === 'phone_verify' && (
                  <React.Fragment>
${verifyControls}
                  </React.Fragment>
                )}
              </div>
`;

// Find the beginning of `<div className="space-y-3">` and replace everything until `<div className="mt-6 text-center">`
const startIndex = content.indexOf('<div className="space-y-3">');
const endIndex = content.indexOf('<div className="mt-6 text-center">');

if (startIndex !== -1 && endIndex !== -1) {
  content = content.slice(0, startIndex) + renderBlock + '\n              ' + content.slice(endIndex);
}

fs.writeFileSync('src/components/AuthModal.tsx', content, 'utf-8');
