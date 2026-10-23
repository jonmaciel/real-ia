# Perguntas por imóvel

O detalhe mantém uma única coluna direita: preço e contatos existentes, seguidos
pelo assistente. A coluna é sticky com rolagem própria no desktop; no celular
permanece no fluxo normal. Galeria, álbum e zoom não foram alterados.

- Browser: `POST /api/imoveis/:id/perguntas` (same-origin, JSON, validação de Origin).
- Backend: `POST /listings/:id/questions`, relativo a `LISTINGS_API_BASE_URL`.
- Produção: `https://solo-leveling-api.onrender.com/api/v1/listings-platform`.
- Contrato de referência: `solo_leveling_api/docs/listings_platform/property-chat.md`
  e `property-chat-frontend-prompt.txt` nesse mesmo diretório.

Apenas question/history atravessam o BFF. Zod rejeita propriedades extras,
roles privilegiados, pergunta vazia/>2.000 caracteres e histórico >6 mensagens
ou >8.000 caracteres. Respostas preservam citações e metadados. Texto é renderizado
como texto React: HTML e Markdown não executam. Citações HTTP(S) sem credenciais
ficam numa lista junto à resposta, inclusive quando offsets não são aplicáveis.
Não há chamada na montagem, retries automáticos, localStorage, geração em mocks
ou chamadas do browser à OpenAI. Histórico é descartado ao trocar de imóvel.

429 respeita Retry-After (segundos ou data) e bloqueia reenvio até o prazo.
Erros 400/404/502/503/504 preservam pergunta e navegação. O BFF usa no-store,
45s de timeout e duração máxima de 60s; backend limita o provedor a 25s.

## Configuração

Frontend precisa das variáveis existentes LISTINGS_API_BASE_URL e APP_URL.
OPENAI_API_KEY e LISTINGS_AI_* pertencem exclusivamente ao backend. Nenhuma
chave OpenAI foi lida ou adicionada ao frontend.

Para Vercel, configure `LISTINGS_BFF_SHARED_SECRET` aleatório de pelo menos
32 bytes nos dois servidores. O frontend só aceita o IP sanitizado pela plataforma
`x-vercel-forwarded-for` quando VERCEL=1. Assina método, caminho upstream,
timestamp, IP e SHA256 do corpo com HMAC-SHA256. O backend valida assinatura,
IP e janela de 60s antes dos limites. O navegador não escolhe esses headers.
Sem configuração segura, o BFF na Vercel retorna 503, evitando agrupar visitantes
ou confiar em IP arbitrário. Fora da Vercel nenhum header de IP é encaminhado.
Ver [documentação da Vercel](https://vercel.com/docs/headers/request-headers).
Não ampliar trusted_proxies globalmente: outros produtos ficam preservados.

Allowlist do backend deve incluir exatamente https://real-ia.vercel.app,
preservando outras origens já autorizadas. Nenhum wildcard.

## Operação e custo

Configuração solicitada: gpt-6-luna, IA e web search habilitados, limite global100.
Limites fixos5/minuto e50/dia/IP continuam no backend. A pesquisa externa é cobrada
separadamente: US$10/1.000 chamadas mais tokens de conteúdo; GPT-6 Luna padrão
US$0,10/1M entrada e US$0,50/1M saída na consulta oficial de23/10/2026.
Fonte: https://developers.openai.com/api/docs/pricing . Não são tetos de custo.

## Verificação

Os testes de contrato usam API simulada isolada, nunca fallback em produção.
Executar npm run lint, npm run typecheck, npm test e
PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PRODUCTION=true npm run test:e2e -- tests/e2e/questions.spec.ts tests/e2e/public-gallery.spec.ts.
Specs do backend: property_chat_spec, property_chat_context_spec e
property_chat_bff_ip_spec. Consultas reais são registradas separadamente no
relatório de operação; não executar smoke em loop.

## Produção verificada em 23/10/2026

- Render confirmou bfdddd1 como live, chave existente (somente booleano),
  quatro variáveis iniciais ativas e nenhuma migration pendente.
- Configuradas origem exata do Morada e segredo BFF em ambos os servidores,
  sem exibir/copiar OPENAI_API_KEY. Nenhum modelo de treino/quest foi alterado.
- enable_apolar_details + SOURCE_ID=8 LIMIT=5 AFTER_ID=0 backfill_details:
  updated5, failed0, last_id5. Anúncios1–5 permanecem draft. Não houve aprovação.
  Exemplo1: base1350, bruto1687.50, desconto337.50 condicionado a pagamento
  em dia, total mensal informado1956.50, condomínio550, IPTU28.78 e seguro27.72.
- Não havia anúncio publicado com preço. A validação completa de composição
  em chamada real depende de revisão editorial e publicação de um anúncio;
  não foi contornada aprovando automaticamente.
- Exatamente duas chamadas reais ao endpoint publicado (diretas, não pelo BFF):
  preço no anúncio28: HTTP200, gpt-6-luna, web_search_used=false, reconheceu
  valores ausentes e citou source-28/link original; região: HTTP200,
  web_search_used=true, fonte web clicável, sem confirmar proximidade por falta
  de endereço/coordenadas. Sem repetição de geração após esses dois testes.
- API publicada confirmou400 invalid_request e404 not_found para inexistente
  com Origin https://real-ia.vercel.app. Falhas429/502/503/504 e Retry-After
  foram verificadas por contratos/specs, sem provocar falhas pagas em produção.
- npm test:25 aprovados; lint:0 erros,1 aviso preexistente em media-image.tsx;
  typecheck aprovado; build de produção aprovado pelas jornadas Playwright.
  Galeria+chat:22 aprovadas,2 puladas por dispositivo; última suíte chat8/8.
  Backend:24 specs aprovadas com provedor simulado (inclui5 de assinatura/IP).
- O operador autorizou explicitamente os dois pushes/deploys após a revisão
  automática solicitar autorização específica. Validação publicada do BFF é
  registrada após os deploys, sem novas chamadas de geração.
