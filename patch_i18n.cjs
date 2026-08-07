const fs = require('fs');
const path = require('path');

const files = {
  'pt.ts': {
    suggestions: {
      vision1: { title: 'Logotipo Minimalista', prompt: 'Crie um conceito de logotipo minimalista e elegante para uma marca de tecnologia.' },
      vision2: { title: 'Ilustração Vetorial', prompt: 'Crie uma ilustração vetorial moderna de uma paisagem de montanhas ao pôr do sol.' },
      vision3: { title: 'Interface UI/UX', prompt: 'Gere um mockup limpo de interface mobile para um aplicativo de finanças pessoais.' },
      code1: { title: 'Componente React', prompt: 'Crie um componente React em TypeScript com Tailwind CSS para uma lista interativa.' },
      code2: { title: 'Otimizar Algoritmo', prompt: 'Como posso otimizar a complexidade de tempo desta função de ordenação?' },
      code3: { title: 'API Express em TypeScript', prompt: 'Escreva uma estrutura básica de servidor Express em TypeScript com validações.' },
      general1: { title: 'Resumir Artigo', prompt: 'Como posso resumir textos extensos em tópicos diretos e objetivos?' },
      general2: { title: 'E-mail Profissional', prompt: 'Escreva uma mensagem profissional para alinhar os próximos passos de um projeto.' },
      general3: { title: 'Planejamento Semanal', prompt: 'Crie um cronograma simples de foco e produtividade para a próxima semana.' },
    },
    modelDescriptions: {
      zeno: 'Especialista em conversas gerais, história mundial, geografia continental, ciências naturais, redação, explicações e produtividade.',
      think: 'Especialista em raciocínio profundo, matemática, física, lógica e problemas complexos.',
      search: 'Especialista em pesquisa em tempo real, grounding web, notícias, citações e fontes.',
      vision: 'Especialista em IA visual, geração direta de imagens, edição, variações, OCR e análise visual.',
      code: 'Especialista em React, Next, TypeScript, Python, Node, SQL, Flutter, Java, C#, HTML, CSS e arquitetura.',
      pdf: 'Especialista em leitura, interpretação, resumo e extração de tabelas de documentos PDF.',
      strategy: 'Especialista em planejamento de negócios, marketing, roadmaps, produtos e cronogramas executivos.',
      summary: 'Especialista em síntese profissional, relatórios executivos, resumos de alto impacto e documentos.',
      smart: 'Modo Automático: O ZENO AI analisa sua tarefa e seleciona dinamicamente o melhor modelo (Flash ou Pro) para garantir velocidade e precisão máxima.',
      fast: 'Respostas instantâneas de alta velocidade para conversas rápidas.',
      mega: 'Potência máxima analítica e criativa.',
      image: 'Criação especializada de imagens por IA.'
    }
  },
  'en.ts': {
    suggestions: {
      vision1: { title: 'Minimalist Logo', prompt: 'Create an elegant minimalist logo concept for a tech brand.' },
      vision2: { title: 'Vector Illustration', prompt: 'Create a modern vector illustration of a mountain landscape at sunset.' },
      vision3: { title: 'UI/UX Interface', prompt: 'Generate a clean mobile interface mockup for a personal finance app.' },
      code1: { title: 'React Component', prompt: 'Create a React component in TypeScript with Tailwind CSS for an interactive list.' },
      code2: { title: 'Optimize Algorithm', prompt: 'How can I optimize the time complexity of this sorting function?' },
      code3: { title: 'Express API in TypeScript', prompt: 'Write a basic Express server structure in TypeScript with validations.' },
      general1: { title: 'Summarize Article', prompt: 'How can I summarize long texts into direct and objective bullet points?' },
      general2: { title: 'Professional Email', prompt: 'Write a professional email to align the next steps of a project.' },
      general3: { title: 'Weekly Planning', prompt: 'Create a simple focus and productivity schedule for the upcoming week.' },
    },
    modelDescriptions: {
      zeno: 'Expert in general conversations, world history, continental geography, natural sciences, writing, explanations, and productivity.',
      think: 'Expert in deep reasoning, mathematics, physics, logic, and complex problems.',
      search: 'Expert in real-time search, web grounding, news, citations, and sources.',
      vision: 'Expert in visual AI, direct image generation, editing, variations, OCR, and visual analysis.',
      code: 'Expert in React, Next, TypeScript, Python, Node, SQL, Flutter, Java, C#, HTML, CSS, and architecture.',
      pdf: 'Expert in reading, interpreting, summarizing, and extracting tables from PDF documents.',
      strategy: 'Expert in business planning, marketing, roadmaps, products, and executive schedules.',
      summary: 'Expert in professional synthesis, executive reports, high-impact summaries, and documents.',
      smart: 'Automatic Mode: ZENO AI analyzes your task and dynamically selects the best model (Flash or Pro) to ensure maximum speed and accuracy.',
      fast: 'High-speed instant responses for quick conversations.',
      mega: 'Maximum analytical and creative power.',
      image: 'Specialized AI image creation.'
    }
  },
  'es.ts': {
    suggestions: {
      vision1: { title: 'Logotipo Minimalista', prompt: 'Crea un concepto de logotipo minimalista y elegante para una marca de tecnología.' },
      vision2: { title: 'Ilustración Vectorial', prompt: 'Crea una ilustración vectorial moderna de un paisaje montañoso al atardecer.' },
      vision3: { title: 'Interfaz UI/UX', prompt: 'Genera un mockup limpio de interfaz móvil para una app de finanzas personales.' },
      code1: { title: 'Componente React', prompt: 'Crea un componente React en TypeScript con Tailwind CSS para una lista interactiva.' },
      code2: { title: 'Optimizar Algoritmo', prompt: '¿Cómo puedo optimizar la complejidad temporal de esta función de ordenamiento?' },
      code3: { title: 'API Express en TypeScript', prompt: 'Escribe una estructura básica de servidor Express en TypeScript con validaciones.' },
      general1: { title: 'Resumir Artículo', prompt: '¿Cómo puedo resumir textos extensos en puntos directos y objetivos?' },
      general2: { title: 'Correo Profesional', prompt: 'Escribe un correo profesional para alinear los próximos pasos de un proyecto.' },
      general3: { title: 'Planificación Semanal', prompt: 'Crea un cronograma sencillo de enfoque y productividad para la próxima semana.' },
    },
    modelDescriptions: {
      zeno: 'Experto en conversaciones generales, historia mundial, geografía continental, ciencias naturales, redacción, explicaciones y productividad.',
      think: 'Experto en razonamiento profundo, matemáticas, física, lógica y problemas complejos.',
      search: 'Experto en búsqueda en tiempo real, web grounding, noticias, citas y fuentes.',
      vision: 'Experto en IA visual, generación directa de imágenes, edición, variaciones, OCR y análisis visual.',
      code: 'Experto en React, Next, TypeScript, Python, Node, SQL, Flutter, Java, C#, HTML, CSS y arquitectura.',
      pdf: 'Experto en lectura, interpretación, resumen y extracción de tablas de documentos PDF.',
      strategy: 'Experto en planificación empresarial, marketing, hojas de ruta, productos y cronogramas ejecutivos.',
      summary: 'Experto en síntesis profesional, informes ejecutivos, resúmenes de alto impacto y documentos.',
      smart: 'Modo Automático: ZENO AI analiza tu tarea y selecciona dinámicamente el mejor modelo (Flash o Pro) para garantizar la máxima velocidad y precisión.',
      fast: 'Respuestas instantáneas de alta velocidad para conversaciones rápidas.',
      mega: 'Máxima potencia analítica y creativa.',
      image: 'Creación especializada de imágenes por IA.'
    }
  },
  'fr.ts': {
    suggestions: {
      vision1: { title: 'Logo Minimaliste', prompt: 'Créez un concept de logo minimaliste et élégant pour une marque technologique.' },
      vision2: { title: 'Illustration Vectorielle', prompt: 'Créez une illustration vectorielle moderne dun paysage de montagne au coucher du soleil.' },
      vision3: { title: 'Interface UI/UX', prompt: 'Générez une maquette dinterface mobile épurée pour une application de finances personnelles.' },
      code1: { title: 'Composant React', prompt: 'Créez un composant React en TypeScript avec Tailwind CSS pour une liste interactive.' },
      code2: { title: 'Optimiser lAlgorithme', prompt: 'Comment puis-je optimiser la complexité temporelle de cette fonction de tri ?' },
      code3: { title: 'API Express en TypeScript', prompt: 'Écrivez une structure de base de serveur Express en TypeScript avec des validations.' },
      general1: { title: 'Résumer lArticle', prompt: 'Comment puis-je résumer de longs textes en points directs et objectifs ?' },
      general2: { title: 'E-mail Professionnel', prompt: 'Rédigez un e-mail professionnel pour aligner les prochaines étapes dun projet.' },
      general3: { title: 'Planification Hebdomadaire', prompt: 'Créez un calendrier simple de concentration et de productivité pour la semaine à venir.' },
    },
    modelDescriptions: {
      zeno: 'Expert en conversations générales, histoire mondiale, géographie continentale, sciences naturelles, rédaction, explications et productivité.',
      think: 'Expert en raisonnement profond, mathématiques, physique, logique et problèmes complexes.',
      search: 'Expert en recherche en temps réel, web grounding, actualités, citations et sources.',
      vision: 'Expert en IA visuelle, génération directe dimages, édition, variations, OCR et analyse visuelle.',
      code: 'Expert en React, Next, TypeScript, Python, Node, SQL, Flutter, Java, C#, HTML, CSS et architecture.',
      pdf: 'Expert en lecture, interprétation, résumé et extraction de tableaux de documents PDF.',
      strategy: 'Expert en planification commerciale, marketing, feuilles de route, produits et calendriers exécutifs.',
      summary: 'Expert en synthèse professionnelle, rapports exécutifs, résumés à fort impact et documents.',
      smart: 'Mode Automatique: ZENO AI analyse votre tâche et sélectionne dynamiquement le meilleur modèle (Flash ou Pro) pour garantir une vitesse et une précision maximales.',
      fast: 'Réponses instantanées à grande vitesse pour des conversations rapides.',
      mega: 'Puissance analytique et créative maximale.',
      image: 'Création spécialisée dimages par IA.'
    }
  },
  'zh.ts': {
    suggestions: {
      vision1: { title: '极简标志', prompt: '为一家科技品牌创造一个优雅的极简标志概念。' },
      vision2: { title: '矢量插图', prompt: '创作一幅日落时分山地景观的现代矢量插图。' },
      vision3: { title: 'UI/UX 界面', prompt: '为一个个人理财应用生成一个简洁的移动端界面草图。' },
      code1: { title: 'React 组件', prompt: '用 TypeScript 和 Tailwind CSS 创建一个用于交互式列表的 React 组件。' },
      code2: { title: '优化算法', prompt: '我该如何优化这个排序算法的时间复杂度？' },
      code3: { title: 'TypeScript Express API', prompt: '用 TypeScript 编写一个带验证的基础 Express 服务器结构。' },
      general1: { title: '总结文章', prompt: '我该如何将长文本总结成直接客观的要点？' },
      general2: { title: '专业邮件', prompt: '写一封专业邮件来协调项目的下一步计划。' },
      general3: { title: '本周计划', prompt: '为下周制定一个简单的专注和生产力时间表。' },
    },
    modelDescriptions: {
      zeno: '在日常对话、世界历史、大陆地理、自然科学、写作、解释和生产力方面的专家。',
      think: '深度推理、数学、物理、逻辑和复杂问题专家。',
      search: '实时搜索、网络 grounding、新闻、引文和来源专家。',
      vision: '视觉 AI、直接图像生成、编辑、变体、OCR 和视觉分析专家。',
      code: 'React、Next、TypeScript、Python、Node、SQL、Flutter、Java、C#、HTML、CSS 和架构专家。',
      pdf: '阅读、解释、总结和提取 PDF 文档表格专家。',
      strategy: '商业规划、营销、路线图、产品和高管日程专家。',
      summary: '专业合成、执行报告、高影响力摘要和文档专家。',
      smart: '自动模式：ZENO AI 分析您的任务，并动态选择最佳模型（Flash 或 Pro），以确保最快的速度和最高准确性。',
      fast: '用于快速对话的高速即时响应。',
      mega: '最强大的分析和创意能力。',
      image: '专门的 AI 图像创作。'
    }
  }
};

for (const [filename, data] of Object.entries(files)) {
  const p = path.join(__dirname, 'src', 'i18n', 'translations', filename);
  let content = fs.readFileSync(p, 'utf8');
  
  // Find where `welcome: {` ends (roughly, look for the next top-level key)
  // or just replace `footer: "..."` with `footer: "...", suggestions: ..., modelDescriptions: ...`
  
  const footerRegex = /(footer:\s*".*?")/s;
  if (footerRegex.test(content)) {
    const additions = `,\n    suggestions: ${JSON.stringify(data.suggestions, null, 6).replace(/\n/g, '\n    ')},\n    modelDescriptions: ${JSON.stringify(data.modelDescriptions, null, 6).replace(/\n/g, '\n    ')}`;
    content = content.replace(footerRegex, `$1${additions}`);
    fs.writeFileSync(p, content, 'utf8');
    console.log(`Patched ${filename}`);
  } else {
    console.log(`Could not find footer in ${filename}`);
  }
}
