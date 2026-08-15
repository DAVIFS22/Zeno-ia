import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Sparkles, 
  FileText, 
  Receipt, 
  Utensils, 
  BarChart3, 
  Copy, 
  Check, 
  ArrowRight, 
  RotateCcw, 
  Download, 
  Languages, 
  ZoomIn, 
  ZoomOut,
  AlertCircle,
  HelpCircle,
  Maximize2
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ImageAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onSubmitToChat?: (text: string, attachment?: any) => void;
  geminiApiKey?: string;
}

type VisionMode = 'receipt' | 'menu' | 'chart' | 'ocr' | 'general';

interface SampleItem {
  id: string;
  title: string;
  mode: VisionMode;
  description: string;
  svgData: string;
}

const SAMPLE_PRESETS: SampleItem[] = [
  {
    id: 'sample-receipt',
    title: 'Recibo de Restaurante',
    mode: 'receipt',
    description: 'Cupom fiscal com itens, taxas, subtotal e gorjeta.',
    svgData: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800" style="background:%23f8f9fa;font-family:monospace;padding:20px;">
      <rect width="560" height="760" x="20" y="20" fill="white" stroke="%23cccccc" stroke-width="2" rx="8" />
      <text x="300" y="70" text-anchor="middle" font-size="22" font-weight="bold" fill="%23111">BISTRÔ SABOR &amp; ARTE LTDA</text>
      <text x="300" y="95" text-anchor="middle" font-size="14" fill="%23555">CNPJ: 12.345.678/0001-90</text>
      <text x="300" y="115" text-anchor="middle" font-size="13" fill="%23555">Av. Paulista, 1578 - São Paulo, SP</text>
      <text x="300" y="135" text-anchor="middle" font-size="13" fill="%23555">Data: 14/10/2025 20:45 | Cupom: #08492</text>
      <line x1="50" y1="155" x2="550" y2="155" stroke="%23333" stroke-dasharray="4" />
      <text x="60" y="180" font-size="14" font-weight="bold" fill="%23111">ITEM / DESCRIÇÃO</text>
      <text x="340" y="180" font-size="14" font-weight="bold" fill="%23111">QTD</text>
      <text x="410" y="180" font-size="14" font-weight="bold" fill="%23111">UNIT</text>
      <text x="490" y="180" font-size="14" font-weight="bold" fill="%23111">TOTAL</text>
      <line x1="50" y1="195" x2="550" y2="195" stroke="%23eee" />
      <text x="60" y="225" font-size="14" fill="%23222">1. Risotto de Funghi Trufado</text><text x="350" y="225" font-size="14" fill="%23222">2</text><text x="405" y="225" font-size="14" fill="%23222">R$ 78,00</text><text x="480" y="225" font-size="14" fill="%23222">R$ 156,00</text>
      <text x="60" y="260" font-size="14" fill="%23222">2. Filé Mignon ao Poivre</text><text x="350" y="260" font-size="14" fill="%23222">1</text><text x="405" y="260" font-size="14" fill="%23222">R$ 94,00</text><text x="480" y="260" font-size="14" fill="%23222">R$ 94,00</text>
      <text x="60" y="295" font-size="14" fill="%23222">3. Vinho Tinto Cabernet 750ml</text><text x="350" y="295" font-size="14" fill="%23222">1</text><text x="405" y="295" font-size="14" fill="%23222">R$ 135,00</text><text x="480" y="295" font-size="14" fill="%23222">R$ 135,00</text>
      <text x="60" y="330" font-size="14" fill="%23222">4. Água Mineral San Pellegrino</text><text x="350" y="330" font-size="14" fill="%23222">2</text><text x="405" y="330" font-size="14" fill="%23222">R$ 16,00</text><text x="480" y="330" font-size="14" fill="%23222">R$ 32,00</text>
      <text x="60" y="365" font-size="14" fill="%23222">5. Tiramisù Tradizionale</text><text x="350" y="365" font-size="14" fill="%23222">2</text><text x="405" y="365" font-size="14" fill="%23222">R$ 32,00</text><text x="480" y="365" font-size="14" fill="%23222">R$ 64,00</text>
      <line x1="50" y1="395" x2="550" y2="395" stroke="%23333" stroke-dasharray="4" />
      <text x="60" y="430" font-size="15" fill="%23444">SUBTOTAL:</text><text x="470" y="430" font-size="15" fill="%23444">R$ 481,00</text>
      <text x="60" y="460" font-size="15" fill="%23444">SERVIÇO / GORJETA (10%):</text><text x="470" y="460" font-size="15" fill="%23444">R$ 48,10</text>
      <text x="60" y="490" font-size="15" fill="%23444">DESCONTO CORTESIA:</text><text x="470" y="490" font-size="15" fill="%23e53e3e">- R$ 20,00</text>
      <line x1="50" y1="515" x2="550" y2="515" stroke="%23111" stroke-width="2" />
      <text x="60" y="555" font-size="20" font-weight="bold" fill="%23111">VALOR TOTAL PAGO:</text><text x="420" y="555" font-size="22" font-weight="bold" fill="%230084DF">R$ 509,10</text>
      <line x1="50" y1="580" x2="550" y2="580" stroke="%23eee" />
      <text x="60" y="615" font-size="14" fill="%23555">FORMA DE PAGAMENTO: Cartão Visa Crédito (Final 8821)</text>
      <text x="60" y="640" font-size="13" fill="%23777">Operação: 99482103 | Aut: 049821</text>
      <text x="300" y="700" text-anchor="middle" font-size="14" font-style="italic" fill="%23666">Obrigado pela preferência e volte sempre!</text>
    </svg>`
  },
  {
    id: 'sample-menu',
    title: 'Cardápio Italiano Trattoria',
    mode: 'menu',
    description: 'Menu em italiano com massas, entradas e sobremesas.',
    svgData: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800" style="background:%23fffdfa;font-family:serif;padding:24px;">
      <rect width="552" height="752" x="24" y="24" fill="%23fffdfa" stroke="%238c6d46" stroke-width="3" rx="12" />
      <text x="300" y="75" text-anchor="middle" font-size="28" font-weight="bold" fill="%236b1d1d">TRATTORIA DELLA NONNA</text>
      <text x="300" y="105" text-anchor="middle" font-size="15" font-style="italic" fill="%23777">Cucina Tradizionale Toscana • Firenze</text>
      <line x1="80" y1="125" x2="520" y2="125" stroke="%238c6d46" stroke-width="1.5" />
      
      <text x="60" y="160" font-size="20" font-weight="bold" fill="%236b1d1d">ANTIPASTI (Entradas)</text>
      <text x="60" y="190" font-size="16" font-weight="bold" fill="%23222">Bruschetta al Pomodoro e Basilico</text><text x="490" y="190" font-size="16" font-weight="bold" fill="%23222">€ 8.50</text>
      <text x="60" y="210" font-size="13" fill="%23555">Pane toscano tostato, pomodori freschi, aglio, olio extravergine d'oliva e basilico. (Vegano)</text>
      
      <text x="60" y="240" font-size="16" font-weight="bold" fill="%23222">Carpaccio di Manzo con Tartufo</text><text x="490" y="240" font-size="16" font-weight="bold" fill="%23222">€ 14.00</text>
      <text x="60" y="260" font-size="13" fill="%23555">Fettine sottili di filetto di manzo, rucola selvatica, scaglie di Parmigiano Reggiano e olio al tartufo.</text>
      
      <text x="60" y="305" font-size="20" font-weight="bold" fill="%236b1d1d">PRIMI PIATTI (Pratos Principais)</text>
      <text x="60" y="335" font-size="16" font-weight="bold" fill="%23222">Tagliatelle al Ragù di Cinghiale</text><text x="490" y="335" font-size="16" font-weight="bold" fill="%23222">€ 18.50</text>
      <text x="60" y="355" font-size="13" fill="%23555">Pasta all'uovo fatta in casa con ragù toscano di cinghiale cotto lentamente con vino rosso.</text>
      
      <text x="60" y="385" font-size="16" font-weight="bold" fill="%23222">Gnocchi di Patate al Gorgonzola e Noci</text><text x="490" y="385" font-size="16" font-weight="bold" fill="%23222">€ 16.00</text>
      <text x="60" y="405" font-size="13" fill="%23555">Gnocchi artigianali con salsa cremosa al formaggio gorgonzola DOP e noci tostate. (Vegetariano)</text>
      
      <text x="60" y="450" font-size="20" font-weight="bold" fill="%236b1d1d">SECONDI PIATTI (Carnes)</text>
      <text x="60" y="480" font-size="16" font-weight="bold" fill="%23222">Bistecca alla Fiorentina (1kg)</text><text x="490" y="480" font-size="16" font-weight="bold" fill="%23222">€ 52.00</text>
      <text x="60" y="500" font-size="13" fill="%23555">Taglio classico con osso cotto alla brace di legna con sale grosso ed erbe aromatiche.</text>
      
      <text x="60" y="545" font-size="20" font-weight="bold" fill="%236b1d1d">DOLCI (Sobremesas)</text>
      <text x="60" y="575" font-size="16" font-weight="bold" fill="%23222">Tiramisù Tradizionale</text><text x="490" y="575" font-size="16" font-weight="bold" fill="%23222">€ 7.00</text>
      <text x="60" y="595" font-size="13" fill="%23555">Savoiardi bagnati al caffè espresso, crema di mascarpone e cacao amaro.</text>
      <text x="60" y="625" font-size="16" font-weight="bold" fill="%23222">Panna Cotta ai Frutti di Bosco</text><text x="490" y="625" font-size="16" font-weight="bold" fill="%23222">€ 6.50</text>
      <text x="60" y="645" font-size="13" fill="%23555">Panna fresca con coulis di lamponi e more di bosco. (Senza Glutine)</text>
      
      <line x1="80" y1="685" x2="520" y2="685" stroke="%238c6d46" stroke-dasharray="3" />
      <text x="300" y="715" text-anchor="middle" font-size="12" fill="%23666">Coperto e pane compresi • Informare il personale su eventuali allergie alimentari.</text>
    </svg>`
  },
  {
    id: 'sample-chart',
    title: 'Gráfico de Desempenho SaaS 2025',
    mode: 'chart',
    description: 'Gráfico de barras e linhas com crescimento de ARR e Churn.',
    svgData: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="700" height="500" viewBox="0 0 700 500" style="background:%23ffffff;font-family:sans-serif;padding:20px;">
      <rect width="660" height="460" x="20" y="20" fill="%23fafafa" stroke="%23e5e7eb" stroke-width="2" rx="10" />
      <text x="350" y="55" text-anchor="middle" font-size="20" font-weight="bold" fill="%23111827">Relatório de Receita Recorrente Anual (ARR) e Retenção - 2025</text>
      <text x="350" y="80" text-anchor="middle" font-size="13" fill="%236b7280">Valores expressos em Milhões de Reais (R$ M) por Trimestre</text>
      
      <!-- Axis Lines -->
      <line x1="80" y1="360" x2="620" y2="360" stroke="%239ca3af" stroke-width="2" />
      <line x1="80" y1="120" x2="80" y2="360" stroke="%239ca3af" stroke-width="2" />
      
      <!-- Y-Axis Labels -->
      <text x="65" y="365" text-anchor="end" font-size="12" fill="%236b7280">0M</text>
      <text x="65" y="305" text-anchor="end" font-size="12" fill="%236b7280">5M</text>
      <text x="65" y="245" text-anchor="end" font-size="12" fill="%236b7280">10M</text>
      <text x="65" y="185" text-anchor="end" font-size="12" fill="%236b7280">15M</text>
      <text x="65" y="125" text-anchor="end" font-size="12" fill="%236b7280">20M</text>
      
      <!-- Grid Lines -->
      <line x1="80" y1="300" x2="620" y2="300" stroke="%23e5e7eb" stroke-dasharray="4" />
      <line x1="80" y1="240" x2="620" y2="240" stroke="%23e5e7eb" stroke-dasharray="4" />
      <line x1="80" y1="180" x2="620" y2="180" stroke="%23e5e7eb" stroke-dasharray="4" />
      <line x1="80" y1="120" x2="620" y2="120" stroke="%23e5e7eb" stroke-dasharray="4" />
      
      <!-- Bars (ARR in Blue) -->
      <!-- Q1 -->
      <rect x="130" y="276" width="60" height="84" fill="%230084DF" rx="4" />
      <text x="160" y="265" text-anchor="middle" font-size="12" font-weight="bold" fill="%230084DF">R$ 7.0M</text>
      <text x="160" y="385" text-anchor="middle" font-size="13" font-weight="bold" fill="%23374151">Q1 2025</text>
      
      <!-- Q2 -->
      <rect x="250" y="228" width="60" height="132" fill="%230084DF" rx="4" />
      <text x="280" y="215" text-anchor="middle" font-size="12" font-weight="bold" fill="%230084DF">R$ 11.0M</text>
      <text x="280" y="385" text-anchor="middle" font-size="13" font-weight="bold" fill="%23374151">Q2 2025</text>
      
      <!-- Q3 -->
      <rect x="370" y="180" width="60" height="180" fill="%230084DF" rx="4" />
      <text x="400" y="170" text-anchor="middle" font-size="12" font-weight="bold" fill="%230084DF">R$ 15.0M</text>
      <text x="400" y="385" text-anchor="middle" font-size="13" font-weight="bold" fill="%23374151">Q3 2025</text>
      
      <!-- Q4 (Projection) -->
      <rect x="490" y="132" width="60" height="228" fill="%230084DF" fill-opacity="0.75" rx="4" stroke="%230084DF" stroke-dasharray="3" />
      <text x="520" y="120" text-anchor="middle" font-size="12" font-weight="bold" fill="%230084DF">R$ 19.0M*</text>
      <text x="520" y="385" text-anchor="middle" font-size="13" font-weight="bold" fill="%23374151">Q4 2025 (Proj)</text>
      
      <!-- Churn Line (Orange) -->
      <polyline points="160,336 280,344 400,348 520,352" fill="none" stroke="%23f59e0b" stroke-width="3" />
      <circle cx="160" cy="336" r="5" fill="%23f59e0b" />
      <circle cx="280" cy="344" r="5" fill="%23f59e0b" />
      <circle cx="400" cy="348" r="5" fill="%23f59e0b" />
      <circle cx="520" cy="352" r="5" fill="%23f59e0b" />
      
      <text x="160" y="325" text-anchor="middle" font-size="11" fill="%23f59e0b" font-weight="bold">2.0%</text>
      <text x="280" y="333" text-anchor="middle" font-size="11" fill="%23f59e0b" font-weight="bold">1.3%</text>
      <text x="400" y="337" text-anchor="middle" font-size="11" fill="%23f59e0b" font-weight="bold">1.0%</text>
      <text x="520" y="340" text-anchor="middle" font-size="11" fill="%23f59e0b" font-weight="bold">0.7%</text>
      
      <!-- Legend -->
      <rect x="230" y="420" width="16" height="16" fill="%230084DF" rx="3" />
      <text x="255" y="433" font-size="12" fill="%23374151">Receita Anual Recorrente (ARR)</text>
      <line x1="435" y1="428" x2="455" y2="428" stroke="%23f59e0b" stroke-width="3" />
      <circle cx="445" cy="428" r="4" fill="%23f59e0b" />
      <text x="465" y="433" font-size="12" fill="%23374151">Taxa de Churn (%)</text>
    </svg>`
  }
];

export const ImageAnalysisModal: React.FC<ImageAnalysisModalProps> = ({
  isOpen,
  onClose,
  isDark,
  onSubmitToChat,
  geminiApiKey
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [visionMode, setVisionMode] = useState<VisionMode>('receipt');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<string>('Português (Brasil)');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string>('gemini-3.1-pro-preview');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [dragOver, setDragOver] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset or preserve state smoothly
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setError(null);
    setImageName(file.name);

    // Auto-detect mode based on file name if possible
    const nameLower = file.name.toLowerCase();
    if (nameLower.includes('recibo') || nameLower.includes('nota') || nameLower.includes('cupom') || nameLower.includes('invoice') || nameLower.includes('receipt')) {
      setVisionMode('receipt');
    } else if (nameLower.includes('menu') || nameLower.includes('cardapio') || nameLower.includes('cardápio')) {
      setVisionMode('menu');
    } else if (nameLower.includes('grafico') || nameLower.includes('gráfico') || nameLower.includes('chart') || nameLower.includes('plot')) {
      setVisionMode('chart');
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
      setAnalysisResult(null);
    };
    reader.onerror = () => {
      setError('Erro ao carregar arquivo de imagem.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        handleFileUpload(file);
      } else {
        setError('Por favor envie um arquivo de imagem válido (PNG, JPG, WEBP, GIF, PDF).');
      }
    }
  };

  const handleSelectSample = (sample: SampleItem) => {
    setError(null);
    setSelectedImage(sample.svgData);
    setImageName(sample.title);
    setVisionMode(sample.mode);
    setAnalysisResult(null);
    setZoomLevel(1);
  };

  const executeAnalysis = async () => {
    if (!selectedImage) {
      setError('Selecione ou faça upload de uma imagem primeiro.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const payload: any = {
        image: selectedImage,
        mode: visionMode,
        prompt: customPrompt.trim(),
        targetLanguage,
        geminiApiKey
      };

      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar imagem.');
      }

      setAnalysisResult(data.analysis);
      if (data.modelUsed) {
        setModelUsed(data.modelUsed);
      }
    } catch (err: any) {
      console.error('[Vision Analysis Error]:', err);
      setError(err?.message || 'Falha ao conectar com o serviço de análise visual.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopy = () => {
    if (!analysisResult) return;
    navigator.clipboard.writeText(analysisResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!analysisResult) return;
    const blob = new Blob([analysisResult], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zeno-vision-${visionMode}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendToChat = () => {
    if (!analysisResult || !onSubmitToChat) return;
    const promptText = `Aqui está a análise detalhada que fiz da imagem:\n\n${analysisResult}`;
    const attachment = selectedImage ? {
      id: 'att-' + Date.now(),
      name: imageName || 'imagem-analisada.jpg',
      type: 'image',
      url: selectedImage,
      size: Math.round(selectedImage.length * 0.75)
    } : undefined;

    onSubmitToChat(promptText, attachment);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div 
        className={`w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border transition-colors ${
          isDark 
            ? 'bg-[#151518] border-[#2C2C2E] text-white' 
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        {/* Modal Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between gap-4 ${
          isDark ? 'border-[#2C2C2E] bg-[#1a1a1e]' : 'border-neutral-200 bg-neutral-50/80'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zeno flex items-center justify-center text-white shadow-md shadow-zeno/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">ZENO Vision Studio</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zeno/10 text-zeno border border-zeno/20">
                  Multimodal Gemini 3.1 Pro
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Extraia dados de recibos, faturas, traduza cardápios e compreenda gráficos instantaneamente
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isDark ? 'hover:bg-[#28282c] text-neutral-400 hover:text-white' : 'hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900'
            }`}
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Mode Selector Tabs */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Selecione o Tipo de Documento / Tarefa
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => setVisionMode('receipt')}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left cursor-pointer ${
                  visionMode === 'receipt'
                    ? 'border-zeno bg-zeno/10 text-zeno ring-1 ring-zeno'
                    : isDark
                      ? 'border-[#2C2C2E] bg-[#1c1c20] hover:bg-[#232328] text-neutral-300'
                      : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-zeno" />
                  <span className="font-semibold text-sm">Recibo / Fatura</span>
                </div>
                <span className="text-[11px] opacity-80 leading-tight">Itens, taxas, CNPJ e totais</span>
              </button>

              <button
                type="button"
                onClick={() => setVisionMode('menu')}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left cursor-pointer ${
                  visionMode === 'menu'
                    ? 'border-zeno bg-zeno/10 text-zeno ring-1 ring-zeno'
                    : isDark
                      ? 'border-[#2C2C2E] bg-[#1c1c20] hover:bg-[#232328] text-neutral-300'
                      : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-zeno" />
                  <span className="font-semibold text-sm">Cardápio / Menu</span>
                </div>
                <span className="text-[11px] opacity-80 leading-tight">Tradução &amp; ingredientes</span>
              </button>

              <button
                type="button"
                onClick={() => setVisionMode('chart')}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left cursor-pointer ${
                  visionMode === 'chart'
                    ? 'border-zeno bg-zeno/10 text-zeno ring-1 ring-zeno'
                    : isDark
                      ? 'border-[#2C2C2E] bg-[#1c1c20] hover:bg-[#232328] text-neutral-300'
                      : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-zeno" />
                  <span className="font-semibold text-sm">Gráfico / Dados</span>
                </div>
                <span className="text-[11px] opacity-80 leading-tight">Métricas e insights</span>
              </button>

              <button
                type="button"
                onClick={() => setVisionMode('ocr')}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left cursor-pointer ${
                  visionMode === 'ocr'
                    ? 'border-zeno bg-zeno/10 text-zeno ring-1 ring-zeno'
                    : isDark
                      ? 'border-[#2C2C2E] bg-[#1c1c20] hover:bg-[#232328] text-neutral-300'
                      : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zeno" />
                  <span className="font-semibold text-sm">OCR &amp; Resumo</span>
                </div>
                <span className="text-[11px] opacity-80 leading-tight">Transcrição na íntegra</span>
              </button>

              <button
                type="button"
                onClick={() => setVisionMode('general')}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left cursor-pointer col-span-2 sm:col-span-1 ${
                  visionMode === 'general'
                    ? 'border-zeno bg-zeno/10 text-zeno ring-1 ring-zeno'
                    : isDark
                      ? 'border-[#2C2C2E] bg-[#1c1c20] hover:bg-[#232328] text-neutral-300'
                      : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-zeno" />
                  <span className="font-semibold text-sm">Análise Livre</span>
                </div>
                <span className="text-[11px] opacity-80 leading-tight">Perguntas personalizadas</span>
              </button>
            </div>
          </div>

          {/* Main Interactive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Upload / Image Preview */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {!selectedImage ? (
                /* Dropzone */
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[280px] ${
                    dragOver
                      ? 'border-zeno bg-zeno/10'
                      : isDark
                        ? 'border-[#2C2C2E] hover:border-zeno/60 bg-[#19191d] hover:bg-[#1f1f24]'
                        : 'border-neutral-300 hover:border-zeno/60 bg-neutral-50 hover:bg-neutral-100'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-zeno/10 flex items-center justify-center text-zeno mb-3">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-base mb-1">Arraste e solte uma imagem aqui</h3>
                  <p className={`text-xs max-w-xs mb-3 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Suporta fotos de recibos, faturas, cardápios, capturas de tela de gráficos ou documentos (PNG, JPG, WEBP, PDF)
                  </p>
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-zeno text-white shadow-sm hover:bg-zeno/90 transition-colors">
                    Escolher Arquivo do Computador
                  </span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                    accept="image/*,application/pdf"
                    className="hidden"
                  />
                </div>
              ) : (
                /* Active Image Preview Card */
                <div className={`rounded-2xl border overflow-hidden flex flex-col ${
                  isDark ? 'bg-[#19191d] border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'
                }`}>
                  <div className={`px-3 py-2 border-b flex items-center justify-between text-xs ${
                    isDark ? 'border-[#2C2C2E] bg-[#222227]' : 'border-neutral-200 bg-neutral-100'
                  }`}>
                    <span className="truncate max-w-[200px] font-medium">{imageName || 'Imagem carregada'}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.2))}
                        className={`p-1 rounded-lg transition-colors cursor-pointer ${isDark ? 'hover:bg-[#333]' : 'hover:bg-neutral-200'}`}
                        title="Diminuir Zoom"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-mono w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
                      <button
                        type="button"
                        onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.2))}
                        className={`p-1 rounded-lg transition-colors cursor-pointer ${isDark ? 'hover:bg-[#333]' : 'hover:bg-neutral-200'}`}
                        title="Aumentar Zoom"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedImage(null);
                          setAnalysisResult(null);
                          setImageName('');
                        }}
                        className="p-1 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors ml-1 cursor-pointer"
                        title="Remover Imagem"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="relative overflow-auto max-h-[320px] min-h-[220px] flex items-center justify-center p-3 bg-neutral-950/20">
                    <img 
                      src={selectedImage} 
                      alt="Preview" 
                      style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                      className="max-h-[300px] max-w-full object-contain rounded-lg transition-transform duration-150"
                    />
                  </div>
                </div>
              )}

              {/* Sample Presets Buttons */}
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Ou experimente com um exemplo interativo:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SAMPLE_PRESETS.map(sample => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleSelectSample(sample)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer truncate ${
                        imageName === sample.title
                          ? 'border-zeno bg-zeno/10 text-zeno'
                          : isDark
                            ? 'border-[#2C2C2E] bg-[#1c1c20] hover:bg-[#24242a] text-neutral-300'
                            : 'border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700'
                      }`}
                      title={sample.description}
                    >
                      {sample.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Prompt & Translation Options */}
              <div className="space-y-3">
                {visionMode === 'menu' && (
                  <div>
                    <label className={`block text-xs font-semibold mb-1 flex items-center gap-1.5 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                      <Languages className="w-3.5 h-3.5 text-zeno" />
                      Traduzir Cardápio Para:
                    </label>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className={`w-full text-xs rounded-xl px-3 py-2 border outline-none cursor-pointer ${
                        isDark ? 'bg-[#1c1c20] border-[#2C2C2E] text-white' : 'bg-white border-neutral-300 text-neutral-900'
                      }`}
                    >
                      <option value="Português (Brasil)">Português (Brasil)</option>
                      <option value="Inglês (English)">Inglês (English)</option>
                      <option value="Espanhol (Español)">Espanhol (Español)</option>
                      <option value="Francês (Français)">Francês (Français)</option>
                      <option value="Italiano (Italiano)">Italiano (Italiano)</option>
                      <option value="Alemão (Deutsch)">Alemão (Deutsch)</option>
                      <option value="Japonês (日本語)">Japonês (日本語)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                    Pergunta ou Instrução Específica (Opcional):
                  </label>
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={
                      visionMode === 'receipt' 
                        ? 'Ex: "Calcule a média gasta por pessoa se dividirmos em 3"'
                        : visionMode === 'menu'
                          ? 'Ex: "Quais opções não contêm nozes nem frutos do mar?"'
                          : visionMode === 'chart'
                            ? 'Ex: "Qual foi o trimestre com menor taxa de churn?"'
                            : 'Ex: "Faça um resumo executivo em 3 tópicos"'
                    }
                    className={`w-full text-xs rounded-xl px-3 py-2 border outline-none focus:border-zeno ${
                      isDark ? 'bg-[#1c1c20] border-[#2C2C2E] text-white placeholder-neutral-500' : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400'
                    }`}
                  />
                </div>

                <button
                  type="button"
                  onClick={executeAnalysis}
                  disabled={!selectedImage || isAnalyzing}
                  className="w-full py-3 px-4 rounded-xl bg-zeno hover:bg-zeno/90 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-zeno/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Analisando com ZENO Vision AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Processar e Analisar Imagem</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: Analysis Results Display */}
            <div className="lg:col-span-7 flex flex-col">
              <div className={`flex-1 rounded-2xl border flex flex-col min-h-[420px] max-h-[580px] overflow-hidden ${
                isDark ? 'bg-[#19191d] border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'
              }`}>
                {/* Result Top Action Bar */}
                <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 text-xs ${
                  isDark ? 'border-[#2C2C2E] bg-[#202025]' : 'border-neutral-200 bg-neutral-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase tracking-wider text-[11px] text-zeno">Resultado da Análise</span>
                    {analysisResult && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                        isDark ? 'bg-[#2a2a30] text-neutral-400' : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {modelUsed}
                      </span>
                    )}
                  </div>

                  {analysisResult && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCopy}
                        className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                          copied 
                            ? 'bg-green-500/20 text-green-400' 
                            : isDark 
                              ? 'bg-[#2a2a30] hover:bg-[#35353d] text-neutral-300' 
                              : 'bg-white hover:bg-neutral-200 text-neutral-700'
                        }`}
                        title="Copiar Texto"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownload}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isDark ? 'bg-[#2a2a30] hover:bg-[#35353d] text-neutral-300' : 'bg-white hover:bg-neutral-200 text-neutral-700'
                        }`}
                        title="Baixar como Markdown (.md)"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {onSubmitToChat && (
                        <button
                          type="button"
                          onClick={handleSendToChat}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zeno hover:bg-zeno/90 text-white flex items-center gap-1 transition-colors cursor-pointer ml-1"
                          title="Enviar esta análise diretamente para o chat ativo"
                        >
                          <span>Continuar no Chat</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Content Pane */}
                <div className="flex-1 overflow-y-auto p-5 text-sm">
                  {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-3 mb-4 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Erro ao analisar imagem</p>
                        <p>{error}</p>
                      </div>
                    </div>
                  )}

                  {isAnalyzing && (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-zeno/10 flex items-center justify-center text-zeno animate-pulse">
                          <Sparkles className="w-8 h-8 animate-spin" style={{ animationDuration: '4s' }} />
                        </div>
                        <div className="absolute -inset-1 rounded-2xl border-2 border-zeno/30 animate-ping" style={{ animationDuration: '2s' }} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-base">Processando Imagem com Gemini Vision</h4>
                        <p className={`text-xs max-w-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                          Lendo pixels, decodificando textos, reconhecendo tabelas e estruturando dados...
                        </p>
                      </div>
                    </div>
                  )}

                  {!isAnalyzing && !analysisResult && !error && (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-neutral-500/10 flex items-center justify-center text-neutral-400">
                        <FileText className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-sm">Nenhuma Análise Ativa</h4>
                        <p className={`text-xs max-w-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                          Carregue uma imagem ou clique em um dos exemplos à esquerda e pressione "Processar e Analisar Imagem".
                        </p>
                      </div>
                    </div>
                  )}

                  {!isAnalyzing && analysisResult && (
                    <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert text-neutral-200' : 'text-neutral-800'}`}>
                      <div className="markdown-body font-sans leading-relaxed">
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {analysisResult}
                        </Markdown>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={`px-5 py-3 border-t flex items-center justify-between text-xs ${
          isDark ? 'border-[#2C2C2E] bg-[#1a1a1e] text-neutral-400' : 'border-neutral-200 bg-neutral-50 text-neutral-500'
        }`}>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            <span>Motor Vision Pronto • Suporta Recibos, Menus, Gráficos e OCR</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-1.5 rounded-xl font-medium transition-colors cursor-pointer ${
              isDark ? 'hover:bg-[#28282c] text-white' : 'hover:bg-neutral-200 text-neutral-900'
            }`}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
