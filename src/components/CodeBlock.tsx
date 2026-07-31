import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Copy, Check, Download, Maximize2, Minimize2, 
  WrapText, Hash, Search, X, Code2, Eye, FileCode2,
  ZoomIn, ZoomOut, CheckCircle2
} from 'lucide-react';
import hljs from 'highlight.js';

interface CodeBlockProps {
  language?: string;
  value: string;
  theme?: 'dark' | 'light';
  filename?: string;
}

interface LanguageMeta {
  name: string;
  extension: string;
  badgeBg: string;
  badgeText: string;
}

const LANGUAGE_MAP: Record<string, LanguageMeta> = {
  js: { name: 'JavaScript', extension: 'js', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  javascript: { name: 'JavaScript', extension: 'js', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  ts: { name: 'TypeScript', extension: 'ts', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  typescript: { name: 'TypeScript', extension: 'ts', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  jsx: { name: 'React JSX', extension: 'jsx', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  tsx: { name: 'React TSX', extension: 'tsx', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  py: { name: 'Python', extension: 'py', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  python: { name: 'Python', extension: 'py', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  html: { name: 'HTML5', extension: 'html', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  css: { name: 'CSS3', extension: 'css', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  scss: { name: 'SCSS', extension: 'scss', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  json: { name: 'JSON', extension: 'json', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  yaml: { name: 'YAML', extension: 'yaml', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  yml: { name: 'YAML', extension: 'yml', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  xml: { name: 'XML', extension: 'xml', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  sql: { name: 'SQL', extension: 'sql', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  bash: { name: 'Bash', extension: 'sh', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  sh: { name: 'Shell', extension: 'sh', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  zsh: { name: 'Zsh', extension: 'zsh', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  powershell: { name: 'PowerShell', extension: 'ps1', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  ps1: { name: 'PowerShell', extension: 'ps1', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  docker: { name: 'Dockerfile', extension: 'dockerfile', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  dockerfile: { name: 'Dockerfile', extension: 'dockerfile', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  c: { name: 'C', extension: 'c', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  cpp: { name: 'C++', extension: 'cpp', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  'c++': { name: 'C++', extension: 'cpp', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  csharp: { name: 'C#', extension: 'cs', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  cs: { name: 'C#', extension: 'cs', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  java: { name: 'Java', extension: 'java', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  kotlin: { name: 'Kotlin', extension: 'kt', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  kt: { name: 'Kotlin', extension: 'kt', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  swift: { name: 'Swift', extension: 'swift', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
go: { name: 'Go', extension: 'go', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  golang: { name: 'Go', extension: 'go', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  rust: { name: 'Rust', extension: 'rs', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  rs: { name: 'Rust', extension: 'rs', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  php: { name: 'PHP', extension: 'php', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  ruby: { name: 'Ruby', extension: 'rb', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  rb: { name: 'Ruby', extension: 'rb', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  dart: { name: 'Dart', extension: 'dart', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  lua: { name: 'Lua', extension: 'lua', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  r: { name: 'R', extension: 'r', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  perl: { name: 'Perl', extension: 'pl', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  markdown: { name: 'Markdown', extension: 'md', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
  md: { name: 'Markdown', extension: 'md', badgeBg: 'bg-[#232326] border-[#2C2C2E] text-neutral-300', badgeText: 'text-neutral-400' },
};

/**
 * Splits highlighted HTML by lines while preserving open HTML tags across lines.
 */
function splitHtmlLines(html: string): string[] {
  const lines = html.split(/\r?\n/);
  const openTags: string[] = [];
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prefix = openTags.join('');
    
    // Find tags in line to track tag stack
    const tagRegex = /<\/?([a-z0-9-]+)[^>]*>/gi;
    let match;
    while ((match = tagRegex.exec(line)) !== null) {
      const fullTag = match[0];
      if (fullTag.startsWith('</')) {
        openTags.pop();
      } else if (!fullTag.endsWith('/>')) {
        openTags.push(fullTag);
      }
    }

    const suffix = openTags.map(tag => {
      const nameMatch = tag.match(/<([a-z0-9-]+)/i);
      return nameMatch ? `</${nameMatch[1]}>` : '';
    }).reverse().join('');

    result.push(prefix + line + suffix);
  }

  return result;
}

export const CodeBlock: React.FC<CodeBlockProps> = React.memo(({ 
  language = '', 
  value = '', 
  theme = 'dark',
  filename
}) => {
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRawView, setIsRawView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fontSize, setFontSize] = useState(13); // in px
  const searchInputRef = useRef<HTMLInputElement>(null);

  const cleanValue = useMemo(() => value.replace(/\n$/, ''), [value]);

  // Highlight execution with highlight.js & auto-detect fallback
  const { highlightedLines, detectedLang, isAutoDetected } = useMemo(() => {
    let lang = (language || '').toLowerCase().trim();
    let auto = false;

    let html = '';
    if (lang && hljs.getLanguage(lang)) {
      try {
        html = hljs.highlight(cleanValue, { language: lang, ignoreIllegals: true }).value;
      } catch (e) {
        html = hljs.highlightAuto(cleanValue).value;
        auto = true;
      }
    } else {
      const autoRes = hljs.highlightAuto(cleanValue);
      html = autoRes.value;
      lang = autoRes.language || 'code';
      auto = true;
    }

    const lines = splitHtmlLines(html);
    return {
      highlightedLines: lines,
      detectedLang: lang,
      isAutoDetected: auto
    };
  }, [cleanValue, language]);

  const rawLines = useMemo(() => cleanValue.split(/\r?\n/), [cleanValue]);
  const totalLines = rawLines.length;

  const langMeta = LANGUAGE_MAP[detectedLang] || {
    name: detectedLang ? detectedLang.toUpperCase() : 'CÓDIGO',
    extension: detectedLang || 'txt',
    badgeBg: 'bg-neutral-500/10 border-neutral-500/30 text-neutral-300',
    badgeText: 'text-neutral-300'
  };

  const formattedSize = useMemo(() => {
    const bytes = new Blob([cleanValue]).size;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }, [cleanValue]);

  // Handle Clipboard Copy
  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(cleanValue);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = cleanValue;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Download Code File
  const handleDownload = () => {
    const defaultName = filename || `codigo-${Date.now()}.${langMeta.extension}`;
    const blob = new Blob([cleanValue], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // Highlight search filter matches
  const lineMatchesSearch = (lineText: string) => {
    if (!searchQuery.trim()) return false;
    return lineText.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const renderCodeLines = () => {
    return (
      <div className="flex pt-12 text-xs sm:text-sm font-code leading-relaxed">
        {/* Line Numbers Column */}
        {showLineNumbers && (
          <div className="select-none pb-4 pr-3.5 pl-3 text-right font-mono text-neutral-600 border-r border-[#2C2C2E]/80 bg-black/20 flex flex-col min-w-[2.75rem]">
            {rawLines.map((_, idx) => {
              const isMatch = lineMatchesSearch(rawLines[idx]);
              return (
                <span 
                  key={idx} 
                  className={`leading-relaxed transition-colors ${
                    isMatch ? 'text-neutral-400 font-bold' : 'hover:text-neutral-400'
                  }`}
                >
                  {idx + 1}
                </span>
              );
            })}
          </div>
        )}

        {/* Code Content Area */}
        <div className={`pb-4 pl-3 pr-14 flex-1 overflow-x-auto scrollbar-custom ${wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}>
          {rawLines.map((lineText, idx) => {
            const isMatch = lineMatchesSearch(lineText);
            const lineHtml = highlightedLines[idx] || '';

            return (
              <div 
                key={idx} 
                className={`group flex items-center min-h-[1.5rem] rounded-sm px-1.5 transition-colors ${
                  isMatch 
                    ? 'bg-neutral-500/20 border-l-2 border-neutral-400 text-neutral-100 font-semibold' 
                    : 'hover:bg-white/[0.04]'
                }`}
                style={{ fontSize: `${fontSize}px` }}
              >
                {isRawView ? (
                  <span>{lineText || ' '}</span>
                ) : (
                  <span 
                    dangerouslySetInnerHTML={{ __html: lineHtml || ' ' }} 
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Standard Embedded CodeBlock Card */}
      <div className={`my-4 rounded-2xl overflow-hidden border shadow-xl transition-all font-sans code-theme-dark ${
        theme === 'dark' 
          ? 'bg-[#0b0c10] border-[#2C2C2E]/90 text-neutral-200 shadow-black/40' 
          : 'bg-[#0f1117] border-[#2C2C2E]/80 text-neutral-100 shadow-black/30'
      }`}>
        {/* Code Block Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-[#212121] border-b border-[#2C2C2E]/60 text-xs font-medium text-neutral-400">
          
          {/* Left Side: Language Tag & Metadata */}
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 font-semibold">
              <FileCode2 className="w-4 h-4 text-neutral-400" />
              <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold font-mono tracking-wide ${langMeta.badgeBg}`}>
                {langMeta.name}
              </span>
            </span>

            {filename && (
              <span className="hidden sm:inline-block text-neutral-300 font-mono text-[11px] truncate max-w-[160px]">
                {filename}
              </span>
            )}

            <span className="text-neutral-500 text-[11px] hidden sm:inline">
              • {totalLines} {totalLines === 1 ? 'linha' : 'linhas'} ({formattedSize})
            </span>

            {isAutoDetected && !language && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#232326] text-neutral-400 font-mono hidden md:inline">
                auto
              </span>
            )}
          </div>

          {/* Right Side: Quick Action Buttons */}
          <div className="flex items-center gap-1">
            {/* Word Wrap Toggle */}
            <button
              type="button"
              onClick={() => setWordWrap(!wordWrap)}
              className={`p-1.5 rounded-md transition-colors flex items-center gap-1 ${
                wordWrap 
                  ? 'bg-neutral-700 text-neutral-100 border border-neutral-600' 
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#232326]'
              }`}
              title={wordWrap ? 'Desativar Quebra de Linhas' : 'Ativar Quebra de Linhas'}
              aria-label="Alternar quebra de linhas"
            >
              <WrapText className="w-3.5 h-3.5" />
            </button>

            {/* Line Numbers Toggle */}
            <button
              type="button"
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className={`p-1.5 rounded-md transition-colors flex items-center gap-1 ${
                showLineNumbers 
                  ? 'bg-neutral-700 text-neutral-100 border border-neutral-600' 
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#232326]'
              }`}
              title={showLineNumbers ? 'Ocultar Números de Linha' : 'Mostrar Números de Linha'}
              aria-label="Alternar números de linha"
            >
              <Hash className="w-3.5 h-3.5" />
            </button>

            {/* Fullscreen Expand */}
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-[#232326] transition-colors"
              title="Expandir em Tela Cheia"
              aria-label="Expandir visualizador de código"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            {/* Download Code Button */}
            <button
              type="button"
              onClick={handleDownload}
              className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-[#232326] transition-colors"
              title="Baixar Arquivo de Código"
              aria-label="Baixar código como arquivo"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs transition-all shadow-sm ${
                copied
                  ? 'bg-neutral-700 border border-neutral-600 text-sky-400 font-semibold'
                  : 'bg-[#232326] hover:bg-neutral-700 border border-[#2C2C2E] text-neutral-300 hover:text-white'
              }`}
              title="Copiar código"
              aria-label="Copiar código para área de transferência"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                  <span className="font-sans">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="font-sans">Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code Content Container */}
        <div className="relative group/code-content overflow-hidden bg-[#171717] text-neutral-100">
          {/* Floating Copy Button for quick extraction */}
          <button
            type="button"
            onClick={handleCopy}
            className={`absolute top-2.5 right-2.5 z-30 p-2 rounded-lg backdrop-blur-md transition-all border shadow-xl ${
              copied 
                ? 'bg-sky-500/30 border-sky-500/50 text-sky-400' 
                : 'bg-black/60 border-white/20 text-neutral-400 hover:text-white hover:bg-black/80 hover:scale-105 active:scale-95'
            }`}
            title="Copiar código"
            aria-label="Copiar código rápido"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>

          {renderCodeLines()}
        </div>
      </div>

      {/* Fullscreen IDE Code Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-5xl h-[88vh] flex flex-col rounded-2xl bg-[#171717] border border-[#2C2C2E] shadow-2xl overflow-hidden code-theme-dark">
            
            {/* Modal Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#212121] border-b border-[#2C2C2E] text-sm">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-md border text-xs font-bold font-mono ${langMeta.badgeBg}`}>
                  {langMeta.name}
                </span>

                <span className="text-neutral-300 font-mono text-xs font-medium">
                  {filename || `snippet.${langMeta.extension}`}
                </span>

                <span className="text-neutral-500 text-xs hidden sm:inline">
                  {totalLines} linhas • {formattedSize}
                </span>
              </div>

              {/* Center: Search Filter Bar */}
              <div className="relative flex-1 max-w-xs mx-2">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Pesquisar no código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1 rounded-md bg-[#232326] border border-[#2C2C2E] text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Right: Controls & Actions */}
              <div className="flex items-center gap-1.5">
                {/* Font Size Adjusters */}
                <div className="flex items-center bg-[#232326] border border-[#2C2C2E] rounded-md p-0.5 text-xs text-neutral-400">
                  <button
                    onClick={() => setFontSize(prev => Math.max(10, prev - 1))}
                    className="p-1 hover:text-neutral-200"
                    title="Diminuir fonte"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 font-mono text-[11px] text-neutral-300">{fontSize}px</span>
                  <button
                    onClick={() => setFontSize(prev => Math.min(22, prev + 1))}
                    className="p-1 hover:text-neutral-200"
                    title="Aumentar fonte"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Raw View Toggle */}
                <button
                  type="button"
                  onClick={() => setIsRawView(!isRawView)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
                    isRawView
                      ? 'bg-neutral-700 text-neutral-100 border-neutral-600'
                      : 'bg-[#232326] text-neutral-300 border-[#2C2C2E] hover:bg-neutral-700'
                  }`}
                  title={isRawView ? 'Ver Destacado' : 'Ver Texto Puro'}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{isRawView ? 'Destacado' : 'Puro'}</span>
                </button>

                {/* Download File */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="p-1.5 rounded-md bg-[#232326] text-neutral-300 border border-[#2C2C2E] hover:bg-neutral-700 transition-colors"
                  title="Baixar Arquivo de Código"
                >
                  <Download className="w-4 h-4 text-neutral-300" />
                </button>

                {/* Copy Button */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium text-xs transition-all ${
                    copied
                      ? 'bg-neutral-700 border border-neutral-600 text-sky-400 font-semibold'
                      : 'bg-[#232326] hover:bg-neutral-700 border border-[#2C2C2E] text-neutral-200 shadow-sm'
                  }`}
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>

                {/* Close Fullscreen Modal */}
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-[#232326] transition-colors ml-1"
                  title="Fechar (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Main Code Display Area */}
            <div className="flex-1 overflow-auto bg-[#171717] text-neutral-100 p-2">
              {renderCodeLines()}
            </div>
          </div>
        </div>
      )}
    </>
  );
});

CodeBlock.displayName = 'CodeBlock';
