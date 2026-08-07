
export const supportTools = [
  {
    name: "createSupportTicket",
    description: "Escale o atendimento para um suporte humano quando o problema estiver fora do seu alcance ou o usuário pedir explicitamente. Isso cria um ticket real no sistema.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Um título curto e descritivo para o ticket (ex: Problema com Reembolso)"
        },
        aiSummary: {
          type: "string",
          description: "Resumo detalhado do contexto: o que você já verificou nos dados reais da assinatura, o que tentou fazer e por que a intervenção humana é necessária."
        }
      },
      required: ["title", "aiSummary"]
    }
  },
  {
    name: "cancelSubscription",
    description: "Cancela a renovação automática da assinatura do usuário. Chame APENAS após confirmação explícita do usuário ('sim', 'quero cancelar').",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "O motivo do cancelamento fornecido pelo usuário, se houver."
        }
      },
      required: []
    }
  }
];
