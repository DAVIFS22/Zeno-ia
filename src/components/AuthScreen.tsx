import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const AuthScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, authLogs } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white p-4">
      <div className="p-8 bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm border border-gray-800">
        <h2 className="text-2xl font-semibold mb-6 text-center">{isLogin ? 'Login' : 'Criar Conta'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-sky-500"
          />
          <input 
            type="password" 
            placeholder="Senha" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-sky-500"
          />
          <button type="submit" className="w-full p-3 rounded-lg bg-sky-600 hover:bg-sky-700 font-medium">
            {isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>
        <div className="mt-4">
          <button onClick={() => signInWithGoogle()} className="w-full p-3 rounded-lg bg-white text-gray-900 hover:bg-gray-100 font-medium flex items-center justify-center gap-3">
            <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Entrar com Google
          </button>
        </div>
        <p className="mt-6 text-center text-sm text-gray-400 cursor-pointer hover:text-white" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Login'}
        </p>
      </div>

      {authLogs && authLogs.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/80 text-sky-400 p-4 rounded text-xs font-mono max-h-48 overflow-y-auto">
          <h3 className="font-bold mb-2">Auth Logs:</h3>
          {authLogs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      )}
    </div>
  );
};
