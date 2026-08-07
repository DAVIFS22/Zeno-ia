import React, { useState } from 'react';
import { 
  X, BookOpen, Terminal, CheckCircle2, Award, 
  Play, ArrowRight, RotateCcw, Code, Check 
} from 'lucide-react';

interface PythonLearningModuleProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const quizQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: "Qual é a extensão padrão de arquivos de código fonte em Python?",
    options: [".pt", ".py", ".python", ".txt"],
    correctIndex: 1,
    explanation: "Arquivos em Python utilizam a extensão .py para indicar que contêm código interpretável pela linguagem."
  },
  {
    id: 2,
    question: "Como exibir uma mensagem na tela em Python?",
    options: ["echo('Olá')", "console.log('Olá')", "print('Olá')", "display('Olá')"],
    correctIndex: 2,
    explanation: "A função integrada print() é utilizada em Python para enviar saídas para o console."
  },
  {
    id: 3,
    question: "Qual palavra-chave é utilizada para definir uma função em Python?",
    options: ["function", "fun", "define", "def"],
    correctIndex: 3,
    explanation: "Em Python, funções são declaradas utilizando a palavra-chave 'def', seguida pelo nome da função e parênteses."
  },
  {
    id: 4,
    question: "O que o código 'print(type(42))' retorna no console?",
    options: ["<class 'int'>", "<class 'float'>", "<class 'str'>", "<class 'number'>"],
    correctIndex: 0,
    explanation: "O número 42 é um número inteiro, logo seu tipo em Python é 'int'."
  }
];

export const PythonLearningModule: React.FC<PythonLearningModuleProps> = ({
  isOpen,
  onClose,
  theme = 'dark'
}) => {
  const [activeTab, setActiveTab] = useState<'intro' | 'variables' | 'conditionals' | 'loops' | 'functions' | 'quiz'>('intro');
  
  // Playground states
  const [playgroundOutput, setPlaygroundOutput] = useState<string>('Olá, Zeno! O assistente tem 2 anos.');

  // Quiz states
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  const handleRunCode = (codeSnippet: string) => {
    if (codeSnippet.includes('print("Olá, Mundo!")')) {
      setPlaygroundOutput('Olá, Mundo!');
    } else if (codeSnippet.includes('idade')) {
      setPlaygroundOutput('Olá, Zeno! O assistente tem 2 anos.');
    } else if (codeSnippet.includes('if nota')) {
      setPlaygroundOutput('Aprovado! Parabéns.');
    } else if (codeSnippet.includes('range')) {
      setPlaygroundOutput('Contando: 1\nContando: 2\nContando: 3');
    } else if (codeSnippet.includes('soma')) {
      setPlaygroundOutput('Resultado da soma: 15');
    } else {
      setPlaygroundOutput('Executado com sucesso (sem erros de sintaxe).');
    }
  };

  const handleSelectAnswer = (optionIdx: number) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [currentQuestionIndex]: optionIdx
    });
  };

  const calculateScore = () => {
    let score = 0;
    quizQuestions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        score++;
      }
    });
    return score;
  };

  const resetQuiz = () => {
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setShowQuizResults(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all ${
        isDark ? 'bg-[#121214] border-[#2C2C2E] text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
      }`}>
        
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${
          isDark ? 'border-[#2C2C2E] bg-[#1A1A1E]' : 'border-neutral-200 bg-neutral-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Introdução à Programação Python</h2>
              <p className="text-[11px] text-neutral-400">Módulo de Aprendizado Interativo • Zeno IA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-200 text-neutral-600 hover:text-black'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className={`flex overflow-x-auto px-6 py-2.5 gap-2 border-b text-xs font-medium no-scrollbar ${
          isDark ? 'border-[#2C2C2E] bg-[#161619]' : 'border-neutral-200 bg-neutral-100/50'
        }`}>
          {[
            { id: 'intro', label: '1. O que é Python', icon: BookOpen },
            { id: 'variables', label: '2. Variáveis e Tipos', icon: Terminal },
            { id: 'conditionals', label: '3. Condicionais (if/else)', icon: Code },
            { id: 'loops', label: '4. Laços (for/while)', icon: RotateCcw },
            { id: 'functions', label: '5. Funções', icon: Code },
            { id: 'quiz', label: '6. Quiz Interativo', icon: Award }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-500 text-white font-semibold shadow-sm'
                    : isDark ? 'text-neutral-400 hover:bg-neutral-800 hover:text-white' : 'text-neutral-600 hover:bg-neutral-200 hover:text-black'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: INTRO */}
          {activeTab === 'intro' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/25 space-y-3">
                <h3 className="text-base font-bold text-emerald-400">Bem-vindo ao mundo Python!</h3>
                <p className="text-xs leading-relaxed text-neutral-300">
                  Python é uma das linguagens de programação mais populares, versáteis e amigáveis do mundo. 
                  Criada por Guido van Rossum e lançada em 1991, seu design enfatiza a legibilidade do código 
                  através do uso de indentação significativa.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                  <h4 className="text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wider">Por que aprender Python?</h4>
                  <ul className="text-xs space-y-2 text-neutral-300">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Sintaxe Simples:</strong> Muito próxima ao inglês natural, facilitando o aprendizado.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Versatilidade:</strong> Usada em IA, Ciência de Dados, Web e automação.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Comunidade Ativa:</strong> Milhares de bibliotecas robustas e documentação exemplar.</span>
                    </li>
                  </ul>
                </div>

                <div className={`p-4 rounded-xl border ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                  <h4 className="text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wider">Seu Primeiro Código</h4>
                  <p className="text-xs text-neutral-300 mb-3">Em Python, para exibir qualquer texto no console, usamos a função <code className="text-emerald-300 font-mono">print()</code>:</p>
                  
                  <div className="p-3 rounded-lg bg-black font-mono text-xs text-emerald-300 border border-neutral-800">
                    print("Olá, Mundo!")
                  </div>
                  <button 
                    onClick={() => handleRunCode('print("Olá, Mundo!")')}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Testar Exemplo
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VARIABLES */}
          {activeTab === 'variables' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-2">
                <h3 className="text-base font-bold text-neutral-100">Variáveis e Tipos de Dados</h3>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Variáveis são contêineres para armazenar valores de dados. Em Python, você não precisa declarar o tipo 
                  da variável antecipadamente; o interpretador deduz automaticamente.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">String (str)</span>
                  <p className="text-xs font-bold text-white mt-1">Textos</p>
                  <code className="text-[11px] text-neutral-400 font-mono block mt-2">nome = "Zeno"</code>
                </div>
                <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Integer / Float</span>
                  <p className="text-xs font-bold text-white mt-1">Números</p>
                  <code className="text-[11px] text-neutral-400 font-mono block mt-2">idade = 25 / preco = 9.90</code>
                </div>
                <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Boolean (bool)</span>
                  <p className="text-xs font-bold text-white mt-1">Lógicos</p>
                  <code className="text-[11px] text-neutral-400 font-mono block mt-2">ativo = True</code>
                </div>
              </div>

              {/* Interactive Playground Card */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#18181C] border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" /> Playground Interativo
                  </span>
                  <button 
                    onClick={() => handleRunCode('nome = "Zeno"\nidade = 2\nprint(f"Olá, {nome}! O assistente tem {idade} anos.")')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" /> Executar
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-black font-mono text-xs text-neutral-200 border border-neutral-800 overflow-x-auto">
{`nome = "Zeno"
idade = 2
print(f"Olá, {nome}! O assistente tem {idade} anos.")`}
                </pre>
                <div className="mt-3">
                  <span className="text-[10px] uppercase font-mono text-neutral-400">Saída do Console:</span>
                  <div className="p-2.5 rounded-lg bg-black/60 font-mono text-xs text-emerald-400 border border-neutral-800 mt-1 whitespace-pre-line">
                    {playgroundOutput}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONDITIONAL */}
          {activeTab === 'conditionals' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-2">
                <h3 className="text-base font-bold text-neutral-100">Estruturas Condicionais (if, elif, else)</h3>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Condicionais permitem que o programa tome decisões lógicas com base em certas condições.
                </p>
              </div>

              <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#18181C] border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" /> Exemplo Prático: Notas escolares
                  </span>
                  <button 
                    onClick={() => handleRunCode('if nota >= 7:\n    print("Aprovado! Parabéns.")\nelse:\n    print("Reprovado.")')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" /> Executar
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-black font-mono text-xs text-neutral-200 border border-neutral-800 overflow-x-auto">
{`nota = 8.5

if nota >= 7:
    print("Aprovado! Parabéns.")
elif nota >= 5:
    print("Recuperação.")
else:
    print("Reprovado.")`}
                </pre>
                <div className="mt-3">
                  <span className="text-[10px] uppercase font-mono text-neutral-400">Saída do Console:</span>
                  <div className="p-2.5 rounded-lg bg-black/60 font-mono text-xs text-emerald-400 border border-neutral-800 mt-1 whitespace-pre-line">
                    {playgroundOutput}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LOOPS */}
          {activeTab === 'loops' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-2">
                <h3 className="text-base font-bold text-neutral-100">Laços de Repetição (for e while)</h3>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Laços são usados para executar blocos de código repetidamente até que uma condição seja atendida ou percorrer coleções.
                </p>
              </div>

              <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#18181C] border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" /> Exemplo com for e range()
                  </span>
                  <button 
                    onClick={() => handleRunCode('for i in range(1, 4):\n    print(f"Contando: {i}")')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" /> Executar
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-black font-mono text-xs text-neutral-200 border border-neutral-800 overflow-x-auto">
{`for i in range(1, 4):
    print(f"Contando: {i}")`}
                </pre>
                <div className="mt-3">
                  <span className="text-[10px] uppercase font-mono text-neutral-400">Saída do Console:</span>
                  <div className="p-2.5 rounded-lg bg-black/60 font-mono text-xs text-emerald-400 border border-neutral-800 mt-1 whitespace-pre-line">
                    {playgroundOutput}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FUNCTIONS */}
          {activeTab === 'functions' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-2">
                <h3 className="text-base font-bold text-neutral-100">Funções em Python</h3>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Funções são blocos de código reutilizáveis que executam uma tarefa específica quando chamados.
                </p>
              </div>

              <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#18181C] border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" /> Definindo uma Função
                  </span>
                  <button 
                    onClick={() => handleRunCode('def somar(a, b):\n    return a + b\n\nresultado = somar(10, 5)\nprint(f"Resultado da soma: {resultado}")')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" /> Executar
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-black font-mono text-xs text-neutral-200 border border-neutral-800 overflow-x-auto">
{`def somar(a, b):
    return a + b

resultado = somar(10, 5)
print(f"Resultado da soma: {resultado}")`}
                </pre>
                <div className="mt-3">
                  <span className="text-[10px] uppercase font-mono text-neutral-400">Saída do Console:</span>
                  <div className="p-2.5 rounded-lg bg-black/60 font-mono text-xs text-emerald-400 border border-neutral-800 mt-1 whitespace-pre-line">
                    {playgroundOutput}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: QUIZ */}
          {activeTab === 'quiz' && (
            <div className="space-y-6 animate-fadeIn max-w-2xl mx-auto">
              {!showQuizResults ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Questão {currentQuestionIndex + 1} de {quizQuestions.length}
                    </span>
                    <span className="text-xs text-neutral-400">
                      Progresso: {Math.round(((currentQuestionIndex + 1) / quizQuestions.length) * 100)}%
                    </span>
                  </div>

                  <div className={`p-5 rounded-2xl border ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                    <h3 className="text-sm font-bold text-white mb-4">
                      {quizQuestions[currentQuestionIndex].question}
                    </h3>

                    <div className="space-y-2.5">
                      {quizQuestions[currentQuestionIndex].options.map((option, idx) => {
                        const isSelected = selectedAnswers[currentQuestionIndex] === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSelectAnswer(idx)}
                            className={`w-full text-left p-3.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between border ${
                              isSelected
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                                : isDark ? 'bg-neutral-800/60 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800' : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                            }`}
                          >
                            <span>{option}</span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-neutral-500'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      disabled={currentQuestionIndex === 0}
                      onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
                      className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                        currentQuestionIndex === 0 ? 'opacity-40 cursor-not-allowed bg-neutral-800 text-neutral-500' : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                      }`}
                    >
                      Anterior
                    </button>

                    {currentQuestionIndex < quizQuestions.length - 1 ? (
                      <button
                        disabled={selectedAnswers[currentQuestionIndex] === undefined}
                        onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                        className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          selectedAnswers[currentQuestionIndex] === undefined 
                            ? 'opacity-40 cursor-not-allowed bg-emerald-600/50 text-white' 
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                        }`}
                      >
                        Próxima <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        disabled={selectedAnswers[currentQuestionIndex] === undefined}
                        onClick={() => setShowQuizResults(true)}
                        className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          selectedAnswers[currentQuestionIndex] === undefined 
                            ? 'opacity-40 cursor-not-allowed bg-emerald-600/50 text-white' 
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                        }`}
                      >
                        Finalizar Quiz <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* QUIZ RESULTS */
                <div className={`p-8 rounded-2xl border text-center space-y-5 ${
                  isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
                }`}>
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                    <Award className="w-8 h-8" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white">Quiz Concluído com Sucesso!</h3>
                    <p className="text-xs text-neutral-300">
                      Você acertou <strong className="text-emerald-400 font-bold">{calculateScore()}</strong> de <strong className="text-white font-bold">{quizQuestions.length}</strong> questões.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-left space-y-2 max-w-md mx-auto">
                    <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 block">Resumo das Explicações:</span>
                    {quizQuestions.map((q, idx) => {
                      const isCorrect = selectedAnswers[idx] === q.correctIndex;
                      return (
                        <div key={q.id} className="text-xs text-neutral-300 border-b border-emerald-500/10 pb-2 last:border-0">
                          <span className={isCorrect ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                            Q{q.id}: {isCorrect ? 'Correto' : 'Incorreto'}
                          </span>
                          <p className="text-[11px] text-neutral-400 mt-0.5">{q.explanation}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      onClick={resetQuiz}
                      className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Refazer Quiz
                    </button>
                    <button
                      onClick={onClose}
                      className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md"
                    >
                      Concluir Módulo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className={`px-6 py-3.5 border-t flex justify-between items-center text-xs ${
          isDark ? 'border-[#2C2C2E] bg-[#161619]' : 'border-neutral-200 bg-neutral-100'
        }`}>
          <span className="text-neutral-400">Zeno IA • Módulo Educacional Python</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
