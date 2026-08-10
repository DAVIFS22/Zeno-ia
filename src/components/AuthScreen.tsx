import React, { useState } from 'react';
import { X, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleLogo } from './GoogleLogo';
import { useTranslation } from '../i18n';

export const AuthScreen: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, authLogs } = useAuth();

  const validateEmail = (email: string) => {
    return email.includes('@') && email.includes('.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);

    if (!validateEmail(email)) {
      setError(t.auth.invalidEmail || "Esse e-mail não parece válido. Confira e tente novamente.");
      setErrorCode('auth/invalid-email');
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
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
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white p-4">
      <div className="p-8 bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm border border-gray-800">
        <h2 className="text-2xl font-semibold mb-6 text-center">{isLogin ? 'Login' : 'Criar Conta'}</h2>
        
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-gray-800/50 border border-gray-700 flex gap-3">
            <div className="text-gray-400 mt-0.5">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-300">{error}</p>
              {errorCode === 'auth/email-already-in-use' && !isLogin && (
                <button 
                  onClick={() => {
                    setIsLogin(true);
                    setError(null);
                    setErrorCode(null);
                  }}
                  className="mt-2 text-zeno font-bold hover:underline block"
                >
                  {t.auth.signInInstead || "Entrar em vez de criar conta"}
                </button>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-zeno"
          />
          <input 
            type="password" 
            placeholder="Senha" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-zeno"
          />
          <button type="submit" className="w-full p-3 rounded-lg bg-zeno hover:bg-zeno/90 font-medium">
            {isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>
        <div className="mt-4">
          <button onClick={() => signInWithGoogle()} className="w-full p-3 rounded-lg bg-white text-gray-900 hover:bg-gray-100 font-medium flex items-center justify-center gap-3">
            <GoogleLogo className="w-5 h-5 flex-shrink-0" />
            Entrar com Google
          </button>
        </div>
        <p className="mt-6 text-center text-sm text-gray-400 cursor-pointer hover:text-white" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Login'}
        </p>
      </div>

      {authLogs && authLogs.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/80 text-zeno p-4 rounded text-xs font-mono max-h-48 overflow-y-auto">
          <h3 className="font-bold mb-2">Auth Logs:</h3>
          {authLogs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      )}
    </div>
  );
};
