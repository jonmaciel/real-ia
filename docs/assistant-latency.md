# Latência da busca e do áudio

Pesquisa e implementação em 29/10/2026. Referências oficiais:

- https://developers.openai.com/api/docs/guides/latency-optimization
- https://developers.openai.com/api/docs/guides/prompt-caching
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API

## Aplicado no frontend

- Uma gravação é enviada ao parar, incluindo o limite automático de 60 s,
  eliminando a etapa de confirmar a prévia. Anexo continua explícito.
- Áudio continua com uma única chamada multipart para transcrição + assistente;
  não reenviamos a transcrição em outro POST.
- Clarificação que devolve exatamente a query já carregada, na mesma página,
  recebida há menos de 60 s e sem erro, atualiza apenas a resposta; não inicia
  navegação RSC para a mesma lista. Depois disso, usa refresh para reconsultar.
  Mudanças de filtros, exclusões ou página continuam consultando a lista completa.
- GET público mantém cache com revalidação de 60 s e tag `listings-public`, já
  invalidada após aprovação. Conversa, áudio e dados privados permanecem no-store.
- Os dois BFFs retornam `Server-Timing: assistant;dur=...` em respostas válidas:
  duração da chamada ao backend incluindo leitura/validação da resposta, em ms.
  DevTools permite separar essa parcela do upload e da navegação de resultados.
  Não há logs de pergunta, transcrição, áudio, token ou dados pessoais.
- Cancelamento invalida respostas tardias, sem retries ou execução especulativa
  paga. Timeout continua em 95 s para áudio; limites financeiros inalterados.

## Limite do contrato e próximos passos

O POST atual fornece no máximo três recomendações, não a página de 20 imóveis e
seus metadados. Reutilizar esses três como toda a lista perderia imóveis e
paginação. Streaming também não está no contrato JSON atual; não simulamos
respostas parciais nem aplicamos filtros antes da resposta validada.

O código local do backend mostra transcrição → Planner → consulta de catálogo,
em sequência. Há uma chamada adicional de resposta no modo de perguntas sobre
um imóvel. Isso descreve o código inspecionado, não uma medição de produção.
A latência fria do catálogo já observada está em `unified-assistant.md`.

O guia de latência recomenda medir etapas, reduzir round trips e saídas,
paralelizar apenas etapas independentes e usar streaming quando o contrato o
permitir. O cache de prefixo pode aproveitar instruções/esquemas estáveis antes
de contexto e histórico dinâmicos; não garante cache hit nem redução fixa.
Modelo, prompts, ferramentas e orçamento são controlados pelo backend.

O prompt `backend-assistant-latency-prompt.txt` propõe perfilamento, otimização
SQL/serialização e, se justificado por medições, uma página completa opcional na
resposta. Essas mudanças ainda precisam de implementação e contrato no backend.
Nenhuma chamada paga ou benchmark de produção foi executado nesta alteração.
