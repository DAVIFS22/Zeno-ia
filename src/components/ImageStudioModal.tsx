import React, { useState, useEffect } from 'react';
import { 
  X, Image as ImageIcon, Sparkles, Download, Copy, Check, 
  RefreshCw, Sliders, Layers, Maximize2, ExternalLink, Wand2, Palette
} from 'lucide-react';
import { downloadImage } from '../lib/downloadHelper';
import { GeneratedImage } from '../types';

interface ImageStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onSendToChat?: (imageUrl: string, prompt: string) => void;
}

const STYLES = [
  { id: 'photorealistic', name: 'Fotorealista', icon: '📸', desc: 'Luzes cinematográficas e alta definição 8k' },
  { id: 'anime', name: 'Anime / Manga', icon: '🎨', desc: 'Estilo Studio Ghibli e arte japonesa' },
  { id: 'cyberpunk', name: 'Cyberpunk', icon: '🌆', desc: 'Luzes neon e cidade futurista' },
  { id: '3d-render', name: 'Render 3D', icon: '🧊', desc: 'Texturas modernas estilo Pixar / Unreal 5' },
  { id: 'digital', name: 'Arte Digital', icon: '🖌️', desc: 'Pintura conceitual detalhada' },
  { id: 'watercolor', name: 'Aquarela', icon: '🎨', desc: 'Pinceladas delicadas e cores suaves' },
  { id: 'minimalist', name: 'Minimalista', icon: '📐', desc: 'Design limpo e formas elegantes' },
];

const ASPECT_RATIOS = [
  { id: '1:1', name: 'Quadrado (1:1)', icon: '⬛' },
  { id: '16:9', name: 'Widescreen (16:9)', icon: '📺' },
  { id: '9:16', name: 'Stories (9:16)', icon: '📱' },
  { id: '4:3', name: 'Clássico (4:3)', icon: '🖼️' },
];

export const ImageStudioModal: React.FC<ImageStudioModalProps> = ({
  isOpen,
  onClose,
  theme,
  onSendToChat
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('photorealistic');
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState(10);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadDoneId, setDownloadDoneId] = useState<string | null>(null);

  useEffect(() => {
    if (!isGenerating) return;
    setGenProgress(10);
    const interval = setInterval(() => {
      setGenProgress((prev) => {
        if (prev >= 92) return 92;
        const step = Math.max(1, Math.round((95 - prev) * 0.1));
        return Math.min(92, prev + step);
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isGenerating]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style: selectedStyle,
          aspectRatio: selectedRatio,
          enhance: true,
        }),
      });

      if (!res.ok) throw new Error('Erro na geração da imagem');

      const data = await res.json();
      const newImg: GeneratedImage = {
        id: 'img-' + Date.now(),
        imageUrl: data.imageUrl,
        prompt: data.prompt,
        originalPrompt: data.originalPrompt,
        aspectRatio: data.aspectRatio,
        style: data.style,
        timestamp: Date.now(),
      };

      setCurrentImage(newImg);
      setHistory(prev => [newImg, ...prev]);
    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro ao gerar a imagem. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = async (url: string, filename: string, id?: string) => {
    if (isDownloading) return;
    setIsDownloading(true);
    await downloadImage(url, filename || `zeno-${Date.now()}.jpg`);
    setIsDownloading(false);
    if (id) {
      setDownloadDoneId(id);
      setTimeout(() => setDownloadDoneId(null), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className={`relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
        theme === 'dark' ? 'bg-[#18181c] border-neutral-800 text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          theme === 'dark' ? 'border-neutral-800 bg-[#171717]' : 'border-neutral-200 bg-neutral-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 shadow-md">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                ZENO Vision Studio
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                  Gerador de Imagens IA
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Transforme ideias em arte e fotografias realistas de alta qualidade
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Body Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 scrollbar-custom">
          {/* Left Controls Column (5 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-5">
            {/* Prompt Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
                <span>Descreva sua imagem</span>
                <span className="text-[11px] text-neutral-400 font-normal">Prompt com IA</span>
              </label>
              <div className={`relative rounded-2xl border transition-all ${
                theme === 'dark' ? 'bg-[#212121] border-neutral-700 focus-within:border-neutral-500' : 'bg-neutral-50 border-neutral-300 focus-within:border-neutral-500'
              }`}>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ex: Um astronauta caminhando por uma floresta bioluminescente em um planeta distante, estilo fotorrealista..."
                  rows={4}
                  className="w-full p-3.5 bg-transparent border-none focus:outline-none resize-none text-sm leading-relaxed text-neutral-200 placeholder-neutral-500"
                />
              </div>
            </div>

            {/* Style Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-neutral-400" />
                <span>Estilo Visual</span>
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-custom">
                {STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      selectedStyle === style.id
                        ? 'bg-neutral-700 border-neutral-500 text-neutral-100 font-semibold shadow-xs'
                        : theme === 'dark'
                          ? 'bg-[#212121] border-neutral-800 hover:border-neutral-700 text-neutral-300'
                          : 'bg-neutral-100 border-neutral-200 hover:border-neutral-300 text-neutral-700'
                    }`}
                  >
                    <span className="text-base">{style.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{style.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-neutral-400" />
                <span>Proporção (Aspect Ratio)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ASPECT_RATIOS.map(ratio => (
                  <button
                    key={ratio.id}
                    onClick={() => setSelectedRatio(ratio.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-xs font-medium ${
                      selectedRatio === ratio.id
                        ? 'bg-neutral-700 border-neutral-500 text-neutral-100 shadow-xs'
                        : theme === 'dark'
                          ? 'bg-[#212121] border-neutral-800 hover:border-neutral-700 text-neutral-400'
                          : 'bg-neutral-100 border-neutral-200 hover:border-neutral-300 text-neutral-600'
                    }`}
                  >
                    <span>{ratio.icon}</span>
                    <span>{ratio.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Action Button */}
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className={`w-full py-3.5 px-4 rounded-2xl font-semibold flex items-center justify-center gap-2.5 transition-all shadow-lg ${
                !prompt.trim() || isGenerating
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                  : 'bg-neutral-200 hover:bg-neutral-100 text-neutral-900 shadow-md active:scale-[0.99]'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-neutral-900" />
                  <span>Gerando Imagem...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Gerar Imagem com IA</span>
                </>
              )}
            </button>
          </div>

          {/* Right Display Area (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className={`flex-1 min-h-[360px] rounded-2xl border flex flex-col items-center justify-center p-4 relative overflow-hidden group ${
              theme === 'dark' ? 'bg-[#1e1e1e] border-neutral-700' : 'bg-neutral-100 border-neutral-200'
            }`}>
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center text-center p-8 space-y-5 w-full relative">
                  {/* Subtle highlight */}
                  <div className="absolute inset-0 bg-neutral-800/20 blur-2xl animate-pulse rounded-2xl" />

                  {/* Animated Center Icon */}
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-200 shadow-xl">
                      <Wand2 className="w-8 h-8 animate-pulse text-neutral-300" />
                    </div>
                    <Sparkles className="w-4 h-4 text-neutral-400 absolute -top-1.5 -right-1.5" />
                  </div>

                  <div className="space-y-1.5 z-10">
                    <h3 className="text-base font-bold text-neutral-100 flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4 text-neutral-400 animate-pulse" />
                      <span>{genProgress < 40 ? 'Expandindo Prompt...' : genProgress < 75 ? 'Sintetizando Iluminação & Textura...' : 'Renderizando Alta Definição...'}</span>
                    </h3>
                    <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
                      O ZENO Vision está transformando seu texto em uma imagem em alta fidelidade.
                    </p>
                  </div>

                  {/* Animated Progress Bar & Percentage */}
                  <div className="w-64 space-y-2 z-10">
                    <div className="flex justify-between items-center text-[11px] font-semibold text-neutral-300 px-0.5">
                      <span className="text-neutral-400 font-mono flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin text-neutral-400" />
                        Gerando Imagem
                      </span>
                      <span className="font-mono text-neutral-300">{genProgress}%</span>
                    </div>

                    <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden relative border border-neutral-700">
                      <div
                        className="h-full bg-neutral-200 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                        style={{ width: `${genProgress}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-shimmer" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : currentImage ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center">
                  <img
                    src={currentImage.imageUrl}
                    alt={currentImage.prompt}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.dataset.retried) {
                        target.dataset.retried = 'true';
                        const fallbackPrompt = encodeURIComponent(currentImage.originalPrompt || 'artistic digital image');
                        target.src = `https://image.pollinations.ai/prompt/${fallbackPrompt}?width=1024&height=1024&nologo=true`;
                      }
                    }}
                    className="max-h-[420px] w-auto object-contain rounded-xl shadow-xl transition-transform duration-300 group-hover:scale-[1.01]"
                  />

                  {/* Floating Action Overlay */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 p-1.5 rounded-xl bg-[#212121]/90 backdrop-blur-md border border-neutral-700 opacity-90 transition-opacity">
                    <button
                      onClick={() => setFullscreenUrl(currentImage.imageUrl)}
                      className="p-2 rounded-lg text-neutral-200 hover:bg-neutral-800 transition-colors"
                      title="Ver em Tela Cheia"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCopyLink(currentImage.imageUrl, currentImage.id)}
                      className="p-2 rounded-lg text-neutral-200 hover:bg-neutral-800 transition-colors"
                      title="Copiar Link da Imagem"
                    >
                      {copiedId === currentImage.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDownload(currentImage.imageUrl, `zeno-${Date.now()}.jpg`, currentImage.id)}
                      disabled={isDownloading}
                      className="p-2 rounded-lg text-neutral-200 hover:bg-neutral-800 transition-colors flex items-center gap-1"
                      title="Baixar Imagem"
                    >
                      {isDownloading ? (
                        <RefreshCw className="w-4 h-4 text-neutral-300 animate-spin" />
                      ) : downloadDoneId === currentImage.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Download className="w-4 h-4 text-neutral-300" />
                      )}
                    </button>
                  </div>

                  {/* Send to chat option */}
                  {onSendToChat && (
                    <div className="mt-3 flex justify-center">
                      <button
                        onClick={() => {
                          onSendToChat(currentImage.imageUrl, currentImage.originalPrompt);
                          onClose();
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 flex items-center gap-2 shadow-sm transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Enviar para a Conversa</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="p-4 rounded-2xl bg-neutral-800 text-neutral-300 border border-neutral-700">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                  <h3 className="text-sm font-semibold">Nenhuma Imagem Gerada Ainda</h3>
                  <p className="text-xs text-neutral-400 max-w-xs">
                    Escreva uma descrição no campo ao lado e clique em "Gerar Imagem com IA" para ver a imagem ser criada.
                  </p>
                </div>
              )}
            </div>

            {/* Recent History Gallery */}
            {history.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Histórico desta sessão ({history.length})
                </div>
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-custom">
                  {history.map(img => (
                    <button
                      key={img.id}
                      onClick={() => setCurrentImage(img)}
                      className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                        currentImage?.id === img.id
                          ? 'border-neutral-300 scale-105 shadow-md'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img.imageUrl}
                        alt={img.prompt}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Modal Lightbox */}
      {fullscreenUrl && (
        <div 
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setFullscreenUrl(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleDownload(fullscreenUrl, `zeno-fullscreen-${Date.now()}.jpg`)}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-2 text-xs font-semibold"
              title="Baixar Imagem"
            >
              <Download className="w-5 h-5 text-neutral-300" />
              <span className="hidden sm:inline">Baixar</span>
            </button>
            <button
              onClick={() => setFullscreenUrl(null)}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <img
            src={fullscreenUrl}
            alt="Fullscreen view"
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
