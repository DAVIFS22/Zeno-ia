import React, { useState, useEffect, useRef } from 'react';
import { 
  Youtube, 
  Download, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Languages, 
  Hash, 
  ListChecks, 
  MessageSquare, 
  Quote,
  MoreHorizontal,
  Copy,
  Check,
  Share2,
  FileDown,
  RotateCcw,
  X,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface YouTubeProcessorProps {
  url: string;
  userId: string | null;
  userToken: string | null;
  onProcessed: (transcript: string, metadata: any) => void;
  onActionRequest: (action: string, transcript: string, metadata: any) => void;
}

export const YouTubeProcessor: React.FC<YouTubeProcessorProps> = ({ 
  url, 
  userId, 
  userToken, 
  onProcessed,
  onActionRequest
}) => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [data, setData] = useState<any>(null);
  
  // Modals & Panels
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'mp4_1080' | 'mp4_720' | 'mp4_480' | 'mp3' | 'srt' | 'txt'>('mp4_720');
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (url) {
      processVideo();
    }
  }, [url]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const processVideo = async () => {
    setStatus('processing');
    try {
      const response = await fetch('/api/process-youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userToken ? { 'Authorization': `Bearer ${userToken}` } : {})
        },
        body: JSON.stringify({ url, userId })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Server error');
      }

      const result = await response.json();
      setData(result);
      
      if (!response.ok && !result.transcript) {
        throw new Error('Erro ao processar');
      }

      setStatus('success');
      onProcessed(result.transcript, result.metadata);
    } catch (err: any) {
      console.error('YouTube Process Error:', err);
      setStatus('error');
    }
  };

  const handleDownloadConfirm = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      setDownloadSuccess(true);

      if (downloadFormat === 'txt' && data?.transcript) {
        downloadTextFile(data.transcript, `${data?.metadata?.title || 'transcricao'}.txt`);
      } else if (downloadFormat === 'srt' && data?.transcript) {
        downloadTextFile(`1\n00:00:00,000 --> 00:05:00,000\n${data.transcript}`, `${data?.metadata?.title || 'legenda'}.srt`);
      }

      setTimeout(() => {
        setDownloadSuccess(false);
        setShowDownloadModal(false);
      }, 1200);
    }, 1000);
  };

  const handleCopyTranscript = () => {
    if (data?.transcript) {
      navigator.clipboard.writeText(data.transcript);
      setCopiedTranscript(true);
      setTimeout(() => setCopiedTranscript(false), 2000);
    }
  };

  const handleDownloadTxt = () => {
    if (data?.transcript) {
      downloadTextFile(data.transcript, `${data?.metadata?.title || 'transcricao'}.txt`);
    }
  };

  const handleDownloadPdf = () => {
    if (data?.transcript) {
      downloadPdf(data.transcript, data?.metadata?.title || 'Transcrição do YouTube');
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: data?.metadata?.title || 'Vídeo do YouTube',
        url: url
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copiado para a área de transferência!');
    }
  };

  function formatDuration(seconds: number) {
    if (!seconds) return '';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function downloadTextFile(text: string, filename: string) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  }

  function downloadPdf(text: string, title: string) {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.6; max-width: 800px; margin: 0 auto; }
              h1 { font-size: 18px; margin-bottom: 16px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
              p { white-space: pre-wrap; font-size: 14px; color: #333; }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <p>${text}</p>
            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }

  if (status === 'idle') return null;

  const videoId = data?.metadata?.videoId || '';
  const thumbnail = data?.metadata?.thumbnail || (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '');
  const title = data?.metadata?.title || 'YouTube Vídeo';
  const author = data?.metadata?.author || 'YouTube';
  const duration = formatDuration(data?.metadata?.duration || 0);

  return (
    <div className="w-full max-w-full my-4 bg-[#141414] border border-neutral-800/80 rounded-2xl p-3 sm:p-5 text-neutral-200 shadow-sm overflow-visible box-border">
      {/* Processing State */}
      {status === 'processing' && (
        <div className="flex items-center gap-3.5 py-3">
          <div className="w-16 h-10 bg-neutral-900 rounded-lg flex items-center justify-center shrink-0 border border-neutral-800">
            <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-neutral-300 truncate">Processando vídeo...</p>
            <p className="text-[11px] text-neutral-500 truncate mt-0.5">{url}</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center shrink-0 border border-neutral-800 text-neutral-400">
              <Youtube className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-neutral-300">Não foi possível processar este vídeo no momento.</p>
              <p className="text-[11px] text-neutral-500 truncate mt-0.5">{url}</p>
            </div>
          </div>
          <button 
            onClick={processVideo}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[12px] font-medium rounded-lg transition-all shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* Success State */}
      {status === 'success' && (
        <div className="space-y-3.5">
          {/* Main Card Info */}
          <div className="flex items-center gap-3">
            {thumbnail ? (
              <img 
                src={thumbnail} 
                alt={title} 
                className="w-14 h-9 sm:w-20 sm:h-12 object-cover rounded-lg shrink-0 border border-neutral-800 bg-neutral-900" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-14 h-9 sm:w-20 sm:h-12 bg-neutral-900 rounded-lg flex items-center justify-center shrink-0 border border-neutral-800">
                <Youtube className="w-5 h-5 text-neutral-400" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h4 className="text-[13px] sm:text-[14px] font-medium text-neutral-100 truncate">
                {title}
              </h4>
              <div className="flex items-center gap-2 text-[11px] sm:text-[12px] text-neutral-400 mt-0.5">
                <span className="truncate">{author}</span>
                {duration && (
                  <>
                    <span>•</span>
                    <span>{duration}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2 py-0.5 rounded-full shrink-0">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline">Processado</span>
            </div>
          </div>

          {/* Action Bar: Icon-only buttons with neutral colors, fully responsive */}
          <div className="flex items-center gap-1.5 pt-1 relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowDownloadModal(true)}
              title="Baixar"
              aria-label="Baixar"
              className="flex-1 flex items-center justify-center h-9 sm:h-10 bg-neutral-900/80 hover:bg-neutral-800/90 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-neutral-400" />
            </button>

            <button
              onClick={() => setShowTranscriptModal(true)}
              disabled={!data?.transcript}
              title="Transcrição"
              aria-label="Transcrição"
              className="flex-1 flex items-center justify-center h-9 sm:h-10 bg-neutral-900/80 hover:bg-neutral-800/90 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4 text-neutral-400" />
            </button>

            <button
              onClick={() => onActionRequest('resumir', data?.transcript, data?.metadata)}
              disabled={!data?.transcript}
              title="Resumir"
              aria-label="Resumir"
              className="flex-1 flex items-center justify-center h-9 sm:h-10 bg-neutral-900/80 hover:bg-neutral-800/90 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4 text-neutral-400" />
            </button>

            <button
              onClick={() => onActionRequest('perguntar', data?.transcript, data?.metadata)}
              disabled={!data?.transcript}
              title="Perguntar"
              aria-label="Perguntar"
              className="flex-1 flex items-center justify-center h-9 sm:h-10 bg-neutral-900/80 hover:bg-neutral-800/90 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MessageSquare className="w-4 h-4 text-neutral-400" />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                title="Mais opções"
                aria-label="Mais opções"
                className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-neutral-900/80 hover:bg-neutral-800/90 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-all cursor-pointer shrink-0"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {showMoreMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-52 bg-[#1a1a1a] border border-neutral-700/80 rounded-xl shadow-2xl py-1.5 z-50"
                  >
                    <button
                      onClick={() => { setShowMoreMenu(false); onActionRequest('traduzir', data?.transcript, data?.metadata); }}
                      className="w-full text-left px-3.5 py-2.5 text-[12px] text-neutral-300 hover:text-white hover:bg-neutral-800/80 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Languages className="w-4 h-4 text-neutral-400" />
                      <span>Traduzir</span>
                    </button>
                    <button
                      onClick={() => { setShowMoreMenu(false); onActionRequest('topicos', data?.transcript, data?.metadata); }}
                      className="w-full text-left px-3.5 py-2.5 text-[12px] text-neutral-300 hover:text-white hover:bg-neutral-800/80 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <ListChecks className="w-4 h-4 text-neutral-400" />
                      <span>Tópicos</span>
                    </button>
                    <button
                      onClick={() => { setShowMoreMenu(false); onActionRequest('pontos', data?.transcript, data?.metadata); }}
                      className="w-full text-left px-3.5 py-2.5 text-[12px] text-neutral-300 hover:text-white hover:bg-neutral-800/80 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Quote className="w-4 h-4 text-neutral-400" />
                      <span>Principais Pontos</span>
                    </button>
                    <button
                      onClick={() => { setShowMoreMenu(false); onActionRequest('corrigir', data?.transcript, data?.metadata); }}
                      className="w-full text-left px-3.5 py-2.5 text-[12px] text-neutral-300 hover:text-white hover:bg-neutral-800/80 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Hash className="w-4 h-4 text-neutral-400" />
                      <span>Corrigir</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* Download Modal */}
      <AnimatePresence>
        {showDownloadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#181818] border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-neutral-200"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-medium text-neutral-100">Baixar vídeo</h3>
                <button 
                  onClick={() => setShowDownloadModal(false)}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[13px] text-neutral-400 mb-4">
                Escolha o formato:
              </p>

              <div className="space-y-2 mb-6">
                {[
                  { id: 'mp4_1080', label: 'MP4 1080p' },
                  { id: 'mp4_720', label: 'MP4 720p' },
                  { id: 'mp4_480', label: 'MP4 480p' },
                  { id: 'mp3', label: 'MP3' },
                  { id: 'srt', label: 'Somente legendas (.srt)' },
                  { id: 'txt', label: 'Transcrição (.txt)' }
                ].map((fmt) => (
                  <label
                    key={fmt.id}
                    onClick={() => setDownloadFormat(fmt.id as any)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      downloadFormat === fmt.id 
                        ? 'bg-neutral-800/80 border-neutral-600 text-white' 
                        : 'bg-neutral-900/40 border-neutral-800 text-neutral-300 hover:bg-neutral-800/40'
                    }`}
                  >
                    <span className="text-[13px] font-medium">{fmt.label}</span>
                    <input 
                      type="radio" 
                      name="downloadFormat" 
                      checked={downloadFormat === fmt.id}
                      onChange={() => setDownloadFormat(fmt.id as any)}
                      className="accent-neutral-200"
                    />
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-[13px] font-medium rounded-xl transition-all cursor-pointer border border-neutral-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDownloadConfirm}
                  disabled={downloading}
                  className="px-5 py-2 bg-neutral-200 hover:bg-white text-black text-[13px] font-medium rounded-xl transition-all cursor-pointer flex items-center gap-2"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Baixando...</span>
                    </>
                  ) : downloadSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span>Concluído!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Baixar</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transcript Panel / Modal */}
      <AnimatePresence>
        {showTranscriptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#181818] border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl text-neutral-200 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-neutral-900 rounded-lg border border-neutral-800">
                    <FileText className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-medium text-neutral-100">Transcrição</h3>
                    <p className="text-[12px] text-neutral-400 truncate max-w-sm sm:max-w-md">{title}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTranscriptModal(false)}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Toolbar */}
              <div className="flex items-center flex-wrap gap-2 px-5 py-3 bg-neutral-900/60 border-b border-neutral-800 text-[12px]">
                <button
                  onClick={handleCopyTranscript}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedTranscript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
                  <span>{copiedTranscript ? 'Copiado!' : 'Copiar'}</span>
                </button>

                <button
                  onClick={handleDownloadTxt}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Baixar TXT</span>
                </button>

                <button
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Baixar PDF</span>
                </button>

                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors cursor-pointer ml-auto"
                >
                  <Share2 className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Compartilhar</span>
                </button>
              </div>

              {/* Content */}
              <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
                <p className="text-[13px] sm:text-[14px] text-neutral-300 leading-relaxed whitespace-pre-wrap">
                  {data?.transcript || 'Nenhuma transcrição disponível.'}
                </p>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-neutral-800 bg-neutral-900/40 flex justify-end">
                <button
                  onClick={() => setShowTranscriptModal(false)}
                  className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[13px] font-medium rounded-xl transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
