# Assistente unificado: descoberta e perguntas

Implementação no frontend Morada, mantendo a janela flutuante escolhida pelo
operador, sua abertura em20s, teclado e comportamento mobile. Em `/buscar`, uma
sanfona junto aos filtros também permite usar a mesma conversa. As duas superfícies
nunca são exibidas simultaneamente.

## Arquitetura e continuidade

`AssistantProvider`, no layout raiz, mantém um único estado em memória:
mensagens visuais, seleção, token opaco mais recente, filtros e requisitos sem
confirmação. Minimizar e navegação interna não apagam esse estado. Recarregar
inicia outra visita. Nada é persistido em localStorage, URL ou analytics.

`ListingConversationSelection` recebe do Server Component apenas o ID após
getListing confirmar um imóvel público. Ao abrir um card, o ID validado é
selecionado e a navegação usa propertyHref do catálogo. A seleção da conversa é
independente do imóvel exibido na página. Resposta mode:search limpa a seleção;
a montagem já existente da página não a restaura. Um novo clique/navegação para
outro anúncio constitui uma seleção explícita. Nunca selecionamos o primeiro card.

A resposta é a autoridade sobre modo, filtros, novas recomendações, exclusões,
requisitos não verificados e continuidade. O frontend não interpreta linguagem
natural, filtra a página recebida, cria imóveis ou inventa critérios. As respostas
em modo busca preenchem o rascunho do formulário convencional; sua lista e URL
só mudam quando o usuário envia o formulário.

### Sanfona na busca

“Prefere descrever? Busque com IA” inicia recolhida e abre por clique ou teclado,
sem chamar a API. Ao abrir, uma seleção anterior de imóvel é removida, mantendo
token, histórico e preferências para continuar a descoberta. Fechar, reabrir ou
alternar para a janela flutuante preserva também o texto ainda não enviado.
A janela não abre automaticamente enquanto a sanfona está em uso.

Os critérios retornados em `applied_filters` aparecem acima da conversa e valem
para as recomendações do assistente. Cada nova resposta `mode: search`, inclusive
`action: clarify`, preenche cidade, bairro, modalidade e demais campos básicos
do formulário. “Uma casa em Araucária” pode preencher a cidade enquanto a IA
pergunta “comprar ou alugar?”. A modalidade não é presumida. O snapshot completo
também remove critérios básicos anteriores ausentes, reseta a paginação e limpa
palavra-chave/disponibilidade antigas que não fazem parte desse contrato.
Preservamos os valores geográficos retornados, sem normalizar nomes no browser.

O formulário é um rascunho: editar, fechar a sanfona, digitar ou receber erro não
o restaura para uma resposta antiga. Uma nova resposta de busca pode atualizá-lo;
respostas sobre um imóvel não o alteram. Ao navegar, os filtros da URL têm
prioridade, sem reaplicar uma conversa anterior. Voltar/avançar restaura os filtros
efetivamente enviados. O formulário da homepage não recebe essa sincronização.

Um aviso explica que a lista convencional só muda após “Buscar imóveis”. Tipos,
quartos, área, mobília e comodidades são identificados como exclusivos das
sugestões da conversa; nenhum parâmetro desconhecido vai para `/search`.
Orçamento `total_monthly` nunca preenche limites de preço base; valores com
precisão incompatível não são arredondados nem copiados. A integração de uma lista com
todos esses critérios depende da publicação de `/assistant/filters` e
`/assistant/results`; a primeira rota respondeu HTTP 404 no ambiente publicado
durante esta implementação. Não há fallback para dados fictícios nem chamada
a esses endpoints a partir da sanfona. Ela usa o BFF existente de mensagens.
O prompt de verificação/ativação de suporte completo está em
`docs/backend-assistant-filter-sync-prompt.txt`.

Teste dedicado (fixtures de contrato, sem geração paga):
`PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PRODUCTION=true npm run test:e2e -- tests/e2e/search-assistant.spec.ts`.

Validação desta adição e da sincronização progressiva: 32 testes unitários e
34 casos Playwright aprovados (sanfona, assistente, janela flutuante e jornadas
do catálogo/conta em desktop/mobile). Build e typecheck
aprovados; lint sem erros e com o aviso preexistente de `<img>` em
`media-image.tsx`. Nenhuma nova geração paga de IA foi executada nesta validação.

## Contrato e BFF

- Browser: POST `/api/assistente/mensagens`.
- API: POST `/assistant/messages` relativo a LISTINGS_API_BASE_URL.
- Base publicada: https://solo-leveling-api.onrender.com/api/v1/listings-platform .
- Payload estrito: question, history, selected_listing_id, search_token. Nada mais.
- Zod valida os limites de2000 caracteres por mensagem,6 mensagens anteriores,
  8000 caracteres no histórico, IDs positivos até signed bigint e token até24000
  bytes. Não decodificamos nem editamos tokens.
- BFF valida origem exata e JSON limitado antes de encaminhar; no-store.
- `questionProxyHeaders` reutiliza LISTINGS_BFF_SHARED_SECRET server-only,
  IP sanitizado pela Vercel e HMAC-SHA256 sobre método/caminho/timestamp/IP/SHA256
  dos mesmos bytes JSON serializados uma vez. Não repassa headers Morada do cliente.
- Timeout upstream65s, browser75s, maxDuration90s. Não há chamada automática ao
  abrir janela, montar componente, digitar, selecionar imóvel ou limpar conversa.
- O endpoint/BFF antigo de perguntas permanece disponível por compatibilidade;
  toda a janela usa apenas o endpoint unificado.

Nenhuma variável OpenAI foi adicionada ao frontend. A configuração do provedor,
modelos e limites continuam exclusivamente no backend. Nenhuma biblioteca nova.

## Interface e segurança

Sem seleção: “Encontre seu imóvel”; com seleção: “Faça qualquer pergunta sobre
o imóvel”. As mensagens anteriores continuam visíveis e identificadas como busca
ou resposta sobre seu ID, sem reaproveitar fatos de outro anúncio como atuais.
Cards usam PropertyCard/PropertyCover/PropertyPrice existentes; os contratos
preservam composição, taxas, periodicidades, endereço autorizado, atributos e
proveniência. Não calculamos totais; distinguimos desconto condicionado, anual e
mensal. Fotos ausentes usam placeholder; não fazemos requisições de mídia por card.

Motivos factuais e ressalvas vêm da API. Preferências sem evidência aparecem como
“Ainda não foi possível verificar”. Preços desconhecidos não viram zero, publicação
não confirma disponibilidade e contexto_updated_at não é verificação humana.
HTML é texto React, links HTTP(S) sem credenciais são validados; nova aba usa
noopener noreferrer. Respostas da busca nunca geram marcadores ou geocoding.

Ações explícitas:
- Mostrar mais opções: uma mensagem com token atual, sem filtragem local.
- Limpar conversa: cancela envio, apaga histórico/token/filtros/seleção.
- Iniciar nova busca: explica o reset de preferências/exclusões, preserva o
  rascunho e não reenvia automaticamente.
- Recomeçar sobre este imóvel: só disponível quando há anúncio público aberto.
-404: continuar buscando sem o imóvel remove a seleção mediante clique, mantendo
  histórico, token e critérios.

Cancelamento, mudança de seleção e limpeza incrementam uma geração local e
abortam a requisição. Respostas antigas são ignoradas mesmo que o servidor
continue processando. Cancelar não garante interromper o provedor/cobrança.
400 invalid_search_token não reinicia a memória silenciosamente;429 respeita
Retry-After.400/404/429/502/503/504 mantêm catálogo, contatos e navegação utilizáveis.

## Verificação real x simulada

Em23/10/2026, o endpoint publicado respondeu400 invalid_request ao payload inválido
e400 invalid_search_token ao token propositalmente inválido. Essas respostas
ocorrem antes de gerar IA e confirmam disponibilidade da rota e validação do
contrato, não o sucesso de uma nova geração paga. Não houve nova chamada real
ao provedor nesta implementação.

Os testes automatizados usam fixtures/servidor de contrato somente em tests/.
Não existe fallback de produção para mocks. Foram testadas continuidade de
histórico/token, mudança para busca sem reviver URL antiga, navegação por card,
clareza/no_results, erros e reset explícito, cancelamento de resposta atrasada,
preço anual/taxas ausentes, links/HTML inertes, desktop/mobile e galeria.

A execução adicional das specs no checkout local do backend apresentou falhas
nos request specs (400 esperado200). Esse checkout tinha alterações não
commitadas em andamento no próprio contrato/planner/conversation e novos
endpoints de filtros/resultados. Não alteramos esse repositório nem adotamos
context/current_filters ou outros campos além dos quatro autorizados no pedido.
A disponibilidade do endpoint publicado foi verificada separadamente acima.

Comandos:
```
npm run lint
npm run typecheck
npm test
PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PRODUCTION=true npm run test:e2e -- tests/e2e/assistant.spec.ts tests/e2e/questions.spec.ts tests/e2e/chat-window.spec.ts tests/e2e/public-gallery.spec.ts
```

Validação inicial do assistente unificado, anterior à sanfona:30 testes unitários aprovados; suíte completa
Playwright88 casos,85 aprovados e3 pulados por dispositivo, incluindo catálogo,
contas, admin, mapa, galeria e assistente. Build de produção e typecheck aprovados;
lint sem erros, com1 aviso preexistente em media-image.tsx. git diff --check limpo.
As duas falhas iniciais de um teste antigo de limpeza foram corrigidas para
esperar o novo modo search após limpar, conforme o contrato (não era falha da UI).
Publicação autorizada pelo operador via ggpush após a validação local.
A confirmação da rota publicada do backend não equivale a uma nova chamada
real ao modelo nem à verificação deste frontend após o deploy.
