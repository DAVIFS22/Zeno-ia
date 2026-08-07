const fs = require('fs');

const translations = {
  'pt.ts': {
    key: 'supportChat',
    obj: `  supportChat: {\n      title: "Ajuda e Suporte",\n      subtitle: "Tire dúvidas sobre planos, cobranças ou reporte problemas para nossa equipe.",\n      greeting: "Olá! Sou o assistente de Suporte e FAQ do ZENO AI. Como posso te ajudar hoje com suas dúvidas sobre planos, cobranças ou sobre o aplicativo?",\n      placeholder: "Digite sua mensagem...",\n      connectionError: "Falha na conexão com o servidor. Tente novamente mais tarde."\n  }`
  },
  'en.ts': {
    key: 'supportChat',
    obj: `  supportChat: {\n      title: "Help & Support",\n      subtitle: "Get answers about plans, billing or report issues to our team.",\n      greeting: "Hello! I am ZENO AI\\'s Support and FAQ assistant. How can I help you today with your questions about plans, billing, or the app?",\n      placeholder: "Type your message...",\n      connectionError: "Server connection failed. Please try again later."\n  }`
  },
  'es.ts': {
    key: 'supportChat',
    obj: `  supportChat: {\n      title: "Ayuda y Soporte",\n      subtitle: "Obtenga respuestas sobre planes, facturación o informe problemas a nuestro equipo.",\n      greeting: "¡Hola! Soy el asistente de Soporte y FAQ de ZENO AI. ¿Cómo puedo ayudarte hoy con tus dudas sobre planes, facturación o la aplicación?",\n      placeholder: "Escribe tu mensaje...",\n      connectionError: "Error de conexión con el servidor. Por favor, inténtalo de nuevo más tarde."\n  }`
  },
  'fr.ts': {
    key: 'supportChat',
    obj: `  supportChat: {\n      title: "Aide et Support",\n      subtitle: "Obtenez des réponses sur les abonnements, la facturation ou signalez des problèmes à notre équipe.",\n      greeting: "Bonjour ! Je suis l\\'assistant Support et FAQ de ZENO AI. Comment puis-je vous aider aujourd\\'hui concernant vos questions sur les abonnements, la facturation ou l\\'application ?",\n      placeholder: "Tapez votre message...",\n      connectionError: "Échec de la connexion au serveur. Veuillez réessayer plus tard."\n  }`
  },
  'zh.ts': {
    key: 'supportChat',
    obj: `  supportChat: {\n      title: "帮助与支持",\n      subtitle: "获取有关套餐、账单的解答或向我们的团队报告问题。",\n      greeting: "您好！我是 ZENO AI 的支持与常见问题助手。今天有什么我可以帮您的，关于套餐、账单或应用程序的问题吗？",\n      placeholder: "输入您的消息...",\n      connectionError: "服务器连接失败。请稍后重试。"\n  }`
  }
};

for (const [file, data] of Object.entries(translations)) {
  const filePath = `src/i18n/translations/${file}`;
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('supportChat:')) {
    content = content.replace(/\s*\}\s*;\s*$/, ',\n' + data.obj + '\n};');
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
}
