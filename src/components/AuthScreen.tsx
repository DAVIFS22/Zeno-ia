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
          <button onClick={() => signInWithGoogle()} className="w-full p-3 rounded-lg bg-white text-gray-900 hover:bg-gray-100 font-medium">
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
