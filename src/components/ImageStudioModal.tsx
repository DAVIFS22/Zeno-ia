import React, { useState, useEffect } from 'react';
import { 
  X, Image as ImageIcon, Sparkles, Download, Copy, Check, 
  RefreshCw, Sliders, Layers, Maximize2, ExternalLink, Wand2, Palette,
  Heart, Trash2, Search, RotateCcw, Edit3, Filter, Users, Clock, XCircle
} from 'lucide-react';
import { downloadImage } from '../lib/downloadHelper';
import { GeneratedImage } from '../types';
import { addImageToLibrary, getStoredImages, saveStoredImages } from '../lib/imageLibraryStorage';

interface ImageStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onSendToChat?: (imageUrl: string, prompt: string) => void;
  userEmail?: string;
  userId?: string;
  plan?: 'ZENO Free' | 'ZENO Pro';
  onOpenProFeatureModal?: () => void;
  onLimitReached?: () => void;
}

const STYLES = [
  { id: 'photorealistic', name: 'Fotorealista', icon: '📸', desc: 'Fotografia profissional 8K e luzes cinematográficas' },
  { id: 'ultra-realista', name: 'Ultra Realista', icon: '📷', desc: 'Textura ultra detalhada, lente DSLR e profundidade' },
  { id: 'anime', name: 'Anime', icon: '🎨', desc: 'Estilo de animação japonesa moderna' },
  { id: 'manga', name: 'Mangá', icon: '✏️', desc: 'Traços em preto e branco marcantes' },
  { id: 'ghibli', name: 'Studio Ghibli', icon: '🌸', desc: 'Cenários poéticos desenhados à mão' },
  { id: 'pixar', name: 'Pixar / Disney', icon: '🎬', desc: 'Personagens 3D carismáticos e iluminação suave' },
  { id: '3d-render', name: 'Render 3D', icon: '🧊', desc: 'Unreal Engine 5, Ray Tracing e Octane' },
  { id: 'cyberpunk', name: 'Cyberpunk', icon: '🌆', desc: 'Neon cintilante e metrópole futurista' },
  { id: 'fantasy', name: 'Fantasia', icon: '🐉', desc: 'Mundos mágicos e trajes detalhados' },
  { id: 'scifi', name: 'Sci-Fi', icon: '🚀', desc: 'Tecnologia avançada e paisagens cósmicas' },
  { id: 'concept-art', name: 'Concept Art', icon: '🖼️', desc: 'Ilustração conceitual para cinema e jogos' },
  { id: 'digital', name: 'Pintura Digital', icon: '🖌️', desc: 'Pinceladas expressivas e cores ricas' },
  { id: 'watercolor', name: 'Aquarela', icon: '🎨', desc: 'Pinceladas suaves de água e tons pastéis' },
  { id: 'vector', name: 'Vetorial', icon: '📐', desc: 'Ilustração plana e formas geométricas limpas' },
  { id: 'logo', name: 'Logotipo', icon: '🏷️', desc: 'Design de marca minimalista e escalável' },
  { id: 'icon', name: 'Ícone 3D', icon: '💎', desc: 'Símbolo em relevo para aplicativos e UI' },
  { id: 'minimalist', name: 'Minimalista', icon: '⚪', desc: 'Composição limpa com espaço negativo' },
  { id: 'low-poly', name: 'Low Poly', icon: '🔷', desc: 'Arte em polígonos geométricos estilizados' }
];

const ASPECT_RATIOS = [
  { id: '1:1', name: 'Quadrado (1:1)', icon: '⬛' },
  { id: '16:9', name: 'Widescreen (16:9)', icon: '📺' },
  { id: '9:16', name: 'Stories (9:16)', icon: '📱' },
  { id: '4:3', name: 'Clássico (4:3)', icon: '🖼️' },
  { id: '3:2', name: 'Foto (3:2)', icon: '📷' }
];

export const ImageStudioModal: React.FC<ImageStudioModalProps> = ({
  isOpen,
  onClose,
  theme,
  onSendToChat,
  userEmail,
  userId,
  plan,
  onOpenProFeatureModal,
  onLimitReached
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('photorealistic');
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');

  useEffect(() => {
    if (isOpen) {
      try {
        const stored = getStoredImages(userId);
        setHistory(stored);
        if (stored.length > 0 && !currentImage) {
          setCurrentImage(stored[0]);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (history.length > 0) {
      try {
        saveStoredImages(history, userId);
      } catch (e) {
        console.error(e);
      }
    }
  }, [history, userId]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState(10);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadDoneId, setDownloadDoneId] = useState<string | null>(null);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);

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

  const handleCancelTask = async () => {
    if (!activeTaskId) return;
    try {
      await fetch('/api/tasks/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: activeTaskId, userEmail })
      });
    } catch (err) {
      console.error('Erro ao cancelar:', err);
    } finally {
      setIsGenerating(false);
      setActiveTaskId(null);
      setQueuePosition(null);
      setEstimatedTime(null);
    }
  };

  const pollTaskStatus = async (taskId: string, targetPrompt: string) => {
    try {
      const statusRes = await fetch(`/api/tasks/status/${taskId}`);
      if (!statusRes.ok) throw new Error('Falha ao obter status');
      
      const statusData = await statusRes.json();
      
      if (statusData.status === 'completed') {
        const newImg = addImageToLibrary({
          imageUrl: statusData.result.imageUrl,
          prompt: statusData.result.prompt,
          originalPrompt: statusData.result.originalPrompt || targetPrompt,
          optimizedPrompt: statusData.result.prompt,
          aspectRatio: statusData.result.aspectRatio || selectedRatio,
          style: statusData.result.style || selectedStyle,
          seed: statusData.result.seed,
          model: 'Estúdio ZENO Vision',
          provider: 'Flux Dev',
          collection: 'Geral',
        });
        setCurrentImage(newImg);
        setHistory(prev => [newImg, ...prev]);
        setIsGenerating(false);
        setActiveTaskId(null);
        setQueuePosition(null);
        setEstimatedTime(null);
      } else if (statusData.status === 'failed') {
        throw new Error(statusData.error || 'Erro interno no processamento do motor ZENO.');
      } else if (statusData.status === 'cancelled') {
        throw new Error('Geração de imagem cancelada.');
      } else {
        // Update live metrics
        if (statusData.position !== undefined) setQueuePosition(statusData.position);
        if (statusData.estimatedTimeSeconds !== undefined) setEstimatedTime(statusData.estimatedTimeSeconds);
        
        // Schedule next poll
        setTimeout(() => pollTaskStatus(taskId, targetPrompt), 1500);
      }
    } catch (pollErr: any) {
      console.error('[POLLING ERROR]', pollErr);
      setQueueError(pollErr?.message || 'Erro de rede ou processamento na fila.');
      setIsGenerating(false);
      setActiveTaskId(null);
      setQueuePosition(null);
      setEstimatedTime(null);
    }
  };

  const handleGenerate = async (customPrompt?: string) => {
    const targetPrompt = (customPrompt || prompt).trim();
    if (!targetPrompt || isGenerating) return;

    setIsGenerating(true);
    setActiveTaskId(null);
    setQueuePosition(null);
    setEstimatedTime(null);
    setQueueError(null);

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: targetPrompt,
          style: selectedStyle,
          aspectRatio: selectedRatio,
          enhance: true,
          userEmail,
          userId,
          plan
        }),
      });

      if (res.status === 403 || res.status === 429) {
        setIsGenerating(false);
        onClose(); // Close studio
        if (res.status === 429) {
          if (onLimitReached) onLimitReached();
        } else if (plan === 'ZENO Free') {
          // Pro gate
          if (onOpenProFeatureModal) onOpenProFeatureModal();
        }
        return;
      }

      if (!res.ok) throw new Error('Erro na geração da imagem');

      const data = await res.json();

      // Check if task is queued (ZENO Free)
      if (data.taskId) {
        setActiveTaskId(data.taskId);
        if (data.position !== undefined) setQueuePosition(data.position);
        if (data.estimatedTimeSeconds !== undefined) setEstimatedTime(data.estimatedTimeSeconds);
        
        // Start polling task status
        pollTaskStatus(data.taskId, targetPrompt);
      } else {
        // Direct response (ZENO Pro or Admin)
        const newImg = addImageToLibrary({
          imageUrl: data.imageUrl,
          prompt: data.prompt,
          originalPrompt: data.originalPrompt || targetPrompt,
          optimizedPrompt: data.prompt,
          aspectRatio: data.aspectRatio || selectedRatio,
          style: data.style || selectedStyle,
          seed: data.seed,
          model: 'Estúdio ZENO Vision',
          provider: 'Flux Dev',
          collection: 'Geral',
        });

        setCurrentImage(newImg);
        setHistory(prev => [newImg, ...prev]);
        setIsGenerating(false);
      }
    } catch (err: any) {
      console.error(err);
      setQueueError(err?.message || 'Não foi possível gerar a imagem neste momento.');
      setIsGenerating(false);
    }
  };

  const toggleFavorite = (id: string) => {
    setHistory(prev => prev.map(img => {
      if (img.id === id) {
        const nextFav = !img.isFavorite;
        if (currentImage?.id === id) {
          setCurrentImage({ ...currentImage, isFavorite: nextFav });
        }
        return { ...img, isFavorite: nextFav };
      }
      return img;
    }));
  };

  const deleteImage = (id: string) => {
    setHistory(prev => {
      const updated = prev.filter(img => img.id !== id);
      try {
        localStorage.setItem('zeno_image_library', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      if (currentImage?.id === id) {
        setCurrentImage(updated[0] || null);
      }
      return updated;
    });
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

  const filteredHistory = history.filter(img => {
    const matchesSearch = !searchQuery || 
      img.prompt.toLowerCase().includes(searchQuery.toLowerCase()) || 
      img.originalPrompt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || (activeTab === 'favorites' && img.isFavorite);
    return matchesSearch && matchesTab;
  });

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
              onClick={() => handleGenerate()}
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
              {queueError ? (
                <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 w-full relative z-10">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-neutral-100">Falha na Fila de Geração</h4>
                    <p className="text-xs text-neutral-400 max-w-xs">{queueError}</p>
                  </div>
                  <button
                    onClick={() => {
                      setQueueError(null);
                      handleGenerate();
                    }}
                    className="py-1.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold rounded-xl transition-all"
                  >
                    Tentar Novamente
                  </button>
                </div>
              ) : isGenerating ? (
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
                      <span>{queuePosition !== null ? 'Aguardando na Fila ZENO...' : (genProgress < 40 ? 'Expandindo Prompt...' : genProgress < 75 ? 'Sintetizando Iluminação & Textura...' : 'Renderizando Alta Definição...')}</span>
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
                        {queuePosition !== null ? 'Na fila de espera...' : 'Gerando Imagem'}
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

                  {/* QUEUE STATUS DASHBOARD FOR FREE USERS */}
                  {queuePosition !== null && (
                    <div className="z-10 bg-[#252525] border border-neutral-800 p-4 rounded-xl max-w-xs w-full shadow-lg space-y-3.5 transition-all mt-3">
                      <div className="flex items-center justify-between text-xs text-neutral-300">
                        <span className="flex items-center gap-1.5 font-medium text-neutral-400">
                          <Users className="w-4 h-4 text-neutral-500" />
                          Posição na Fila:
                        </span>
                        <span className="font-extrabold text-neutral-100 bg-neutral-800 px-2.5 py-1 rounded-lg border border-neutral-700 font-mono">
                          #{queuePosition}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-neutral-300">
                        <span className="flex items-center gap-1.5 font-medium text-neutral-400">
                          <Clock className="w-4 h-4 text-neutral-500" />
                          Tempo Estimado:
                        </span>
                        <span className="font-extrabold text-emerald-400 font-mono bg-emerald-950/30 px-2 py-0.5 rounded-md">
                          ~{estimatedTime}s
                        </span>
                      </div>
                      
                      <button
                        onClick={handleCancelTask}
                        className="w-full mt-2 py-2 px-3 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border border-rose-500/20 active:scale-[0.98]"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        Cancelar Solicitação
                      </button>
                    </div>
                  )}
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
                      onClick={() => toggleFavorite(currentImage.id)}
                      className={`p-2 rounded-lg transition-colors ${currentImage.isFavorite ? 'text-rose-400 bg-rose-500/20' : 'text-neutral-200 hover:bg-neutral-800'}`}
                      title={currentImage.isFavorite ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
                    >
                      <Heart className={`w-4 h-4 ${currentImage.isFavorite ? 'fill-rose-400 text-rose-400' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleGenerate(currentImage.originalPrompt || currentImage.prompt)}
                      disabled={isGenerating}
                      className="p-2 rounded-lg text-neutral-200 hover:bg-neutral-800 transition-colors"
                      title="Regenerar esta Imagem"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
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
                    <div className="mt-3 flex justify-center gap-2">
                      <button
                        onClick={() => {
                          onSendToChat(currentImage.imageUrl, currentImage.originalPrompt || currentImage.prompt);
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

            {/* Gallery Library */}
            {history.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-neutral-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 bg-neutral-800/80 p-1 rounded-xl border border-neutral-700">
                    <button
                      onClick={() => setActiveTab('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        activeTab === 'all' ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Todas ({history.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('favorites')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                        activeTab === 'favorites' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <Heart className="w-3 h-3 text-rose-400 fill-rose-400" />
                      <span>Favoritas ({history.filter(i => i.isFavorite).length})</span>
                    </button>
                  </div>

                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar no histórico..."
                      className="w-full pl-8 pr-3 py-1 rounded-xl bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-custom">
                  {filteredHistory.map(img => (
                    <div
                      key={img.id}
                      className={`relative group flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                        currentImage?.id === img.id
                          ? 'border-neutral-300 scale-105 shadow-md'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <button
                        onClick={() => setCurrentImage(img)}
                        className="w-full h-full block"
                      >
                        <img
                          src={img.imageUrl}
                          alt={img.prompt}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>

                      {/* Favorite Indicator Badge */}
                      {img.isFavorite && (
                        <div className="absolute top-1 left-1 p-0.5 rounded-full bg-black/60 backdrop-blur-sm">
                          <Heart className="w-3 h-3 text-rose-400 fill-rose-400" />
                        </div>
                      )}

                      {/* Delete Overlay Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteImage(img.id);
                        }}
                        className="absolute top-1 right-1 p-1 rounded-lg bg-black/70 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Excluir da biblioteca"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {filteredHistory.length === 0 && (
                    <div className="text-xs text-neutral-500 py-4 italic">
                      Nenhuma imagem encontrada {activeTab === 'favorites' ? 'nos favoritos' : ''}.
                    </div>
                  )}
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
