# Guia de Contribuição - ZENO AI

## Padrão de Commits

Para garantir que o nosso sistema de release gere changelogs úteis e detalhados automaticamente, é **obrigatório** que as mensagens de commit sigam um padrão descritivo.

O nosso script de análise (`scripts/githubReleaseAnalyzer.ts`) utiliza IA para agrupar e descrever as mudanças nas versões. Para que a IA consiga extrair as informações corretas e gerar bullets concretos e específicos (não resumos genéricos), você deve fornecer contexto na própria mensagem de commit.

### ❌ O que NÃO fazer:
- `fix: bug`
- `feat: atualiza layout`
- `perf: melhoria de desempenho`

Essas mensagens genéricas resultam em um changelog pobre (ex: "Refinamentos no sistema de chat e interface") que não diz o que realmente mudou para o usuário.

### ✅ O que FAZER:
Sempre descreva **o que mudou ou foi corrigido** em detalhes práticos que afetam a experiência:
- `fix: corrige loop infinito no microfone que travava a interface`
- `feat: adiciona histórico de imagens geradas no menu lateral`
- `perf: implementa cache em memória para respostas rápidas da IA`

### Categorias Suportadas
O sistema agrupa os commits nas seguintes categorias para as notas da versão:
- `feat:` ou `feature:` -> Novidades
- `fix:` ou `bug:` -> Correções
- `perf:` -> Desempenho
- `refactor:` ou `arch:` -> Arquitetura (caso relevante para a experiência)

Ações sem impacto direto (como `ci:`, `test:`, `chore:`) são ignoradas no changelog final da IA.
