import React, { useState } from 'react';
import { 
  X, Music, Sparkles, Copy, Check, Volume2, AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { checkUsageLimit, FREE_LIMITS } from '../lib/subscription';
import { hasPremiumAccess } from '../config/admin';

interface MusicStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPlan: string;
  userEmail: string;
  dailyUsage: any;
  onUpdateUsage: (newUsage: any) => void;
}

export const MusicStudioModal: React.FC<MusicStudioModalProps> = ({
  isOpen,
  onClose,
  userPlan,
  userEmail,
  dailyUsage,
  onUpdateUsage
}) => {
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('Acústica / Pop');
  const [keySig, setKeySig] = useState('C Major');
  const [tempo, setTempo] = useState('110 BPM');
  const [mode, setMode] = useState<'pro' | 'clip'>('pro');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [songData, setSongData] = useState<{
    title: string;
    genre: string;
    key: string;
    tempo: string;
    lyrics: string;
    chordsSummary: string;
    audioUrl?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const isAdmin = hasPremiumAccess(userEmail);
  const usageCheck = checkUsageLimit(userPlan as any, dailyUsage, 'music');

  const genres = [
    'Acústica / Pop', 'Lo-Fi / Chill', 'Rock Alternativo', 
    'Sertanejo / Country', 'Eletrônica / Synthwave', 'MPB / Bossa Nova'
  ];

  const keys = ['C Major', 'G Major', 'D Major', 'A Minor', 'E Minor', 'F Major'];

  const handleGenerate = async () => {
    if (!isAdmin && !usageCheck.allowed) {
      onClose();
      return;
    }

    if (!prompt.trim()) return;

    setIsGenerating(true);
    setErrorMsg(null);
    setSongData(null);

    try {
      const res = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          genre,
          keySig,
          tempo,
          mode
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar música com Lyria 3.');
      }

      let audioUrl: string | undefined = undefined;
      if (data.audioData) {
        const binary = atob(data.audioData);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
        audioUrl = URL.createObjectURL(blob);
      }

      setSongData({
        title: data.title || prompt.slice(0, 35),
        genre: data.genre || genre,
        key: data.key || keySig,
        tempo: data.tempo || tempo,
        lyrics: data.lyrics || '',
        chordsSummary: data.chordsSummary || keySig,
        audioUrl
      });

      // Increment usage count if not admin
      if (!isAdmin) {
        const updated = {
          ...dailyUsage,
          musicGenCount: (dailyUsage.musicGenCount || 0) + 1
        };
        onUpdateUsage(updated);
      }

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao processar áudio com a API Lyria 3.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!songData) return;
    const text = `Música: ${songData.title}\nGênero: ${songData.genre} | Tom: ${songData.key} | Andamento: ${songData.tempo}\n\nLetra:\n${songData.lyrics}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-[#141416] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2C2C2E] bg-[#1C1C1E]/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#2C2C2E] text-[#D4D4D8] rounded-xl border border-[#3A3A3C]">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#F5F5F5] tracking-tight">Estúdio de Criação Musical (Lyria 3)</h2>
              <p className="text-xs text-[#9A9A9E]">Geração de áudio real, letras e acordes via API Gemini</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-[#9A9A9E] hover:text-[#F5F5F5] rounded-xl hover:bg-[#2C2C2E] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-[#121212]">
          {/* Usage Counter Badge for Free users */}
          {!isAdmin && (
            <div className="flex items-center justify-between bg-[#1C1C1E] border border-[#2C2C2E] px-4 py-2.5 rounded-xl text-xs">
              <span className="text-[#9A9A9E]">Gerações diárias gratuitas restantes:</span>
              <span className="font-semibold text-[#F5F5F5]">
                {usageCheck.remaining} de {FREE_LIMITS.MUSIC_PER_DAY}
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#F5F5F5]">Tema ou Letra da Música</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Uma balada acústica sobre superação sob as estrelas..."
              rows={3}
              className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-3 text-sm text-[#F5F5F5] placeholder-[#9A9A9E] focus:outline-none focus:border-[#4A4A4E] transition-colors resize-none"
            />
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#9A9A9E]">Gênero / Estilo</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl px-3 py-2 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#4A4A4E]"
              >
                {genres.map(g => <option key={g} value={g} className="bg-[#1C1C1E] text-[#F5F5F5]">{g}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#9A9A9E]">Tom Musical</label>
              <select
                value={keySig}
                onChange={(e) => setKeySig(e.target.value)}
                className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl px-3 py-2 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#4A4A4E]"
              >
                {keys.map(k => <option key={k} value={k} className="bg-[#1C1C1E] text-[#F5F5F5]">{k}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#9A9A9E]">Andamento</label>
              <input
                type="text"
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
                className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl px-3 py-2 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#4A4A4E]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#9A9A9E]">Modo Lyria</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'pro' | 'clip')}
                className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl px-3 py-2 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#4A4A4E]"
              >
                <option value="pro" className="bg-[#1C1C1E]">Pro (Faixa Completa)</option>
                <option value="clip" className="bg-[#1C1C1E]">Clip (Prévia 30s)</option>
              </select>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-3 bg-[#2C2C2E] hover:bg-[#3A3A3C] border border-[#4A4A4E] text-[#F5F5F5] rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {isGenerating ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-[#D4D4D8]" />
                <span>Gerando áudio e letra com Lyria 3 (Isso pode levar alguns segundos)...</span>
              </>
            ) : (
              <>
                <Music className="w-4 h-4 text-[#D4D4D8]" />
                <span>Criar Música com IA (Lyria 3)</span>
              </>
            )}
          </button>

          {/* Result Section */}
          {songData && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 space-y-4 pt-4 border-t border-[#2C2C2E]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#F5F5F5]">{songData.title}</h3>
                  <p className="text-xs text-[#9A9A9E]">{songData.genre} • Tom: {songData.key} • {songData.tempo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="p-2 bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-[#2C2C2E] text-[#D4D4D8] rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Copiar Letra"
                  >
                    {copied ? <Check className="w-4 h-4 text-[#F5F5F5]" /> : <Copy className="w-4 h-4" />}
                    <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Native HTML Audio Player */}
              <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-[#F5F5F5]">
                  <Volume2 className="w-4 h-4 text-[#D4D4D8]" />
                  <span>Áudio Gerado por IA (Lyria 3)</span>
                </div>
                {songData.audioUrl ? (
                  <audio controls src={songData.audioUrl} className="w-full accent-neutral-400" />
                ) : (
                  <p className="text-xs text-[#9A9A9E] italic">Áudio não retornado na resposta desta execução.</p>
                )}
                <p className="text-[10px] text-[#9A9A9E]">
                  ℹ️ Áudio gerado por Inteligência Artificial contendo marca d'água SynthID de identificação de conteúdo.
                </p>
              </div>

              {/* Lyrics Box */}
              <div className="bg-[#121212] border border-[#2C2C2E] rounded-xl p-4 font-mono text-xs text-[#D4D4D8] whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {songData.lyrics}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
