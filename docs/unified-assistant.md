# Assistente unificado: descoberta e perguntas

Implementação no frontend Morada. Em `/buscar`, a IA é a opção inicial e há
somente uma lista de imóveis, atualizada a cada prompt. Filtros convencionais
ficam na opção “Usar filtros”. A página inicial também oferece essa mesma busca
embutida, com texto ou áudio e filtros tradicionais opcionais. Não há janela
flutuante nem lançador na home, inclusive após 20 segundos ou ao voltar de um
imóvel. A conversa flutuante permanece disponível nas demais páginas elegíveis.

Na home, um envio explícito usa `context.page=home`. Após a resposta validada,
navega internamente para `/buscar` com filtros e exclusões autoritativos. A
última clarificação, transcrição, histórico e token opaco acompanham a navegação,
sem reenviar o texto transcrito ou criar outra lista. A URL mantém apenas os
critérios públicos; voltar retorna à home. Falhas preservam o prompt e permitem
alternar para os filtros. Nenhuma chamada de IA ocorre ao montar a página.

Validação da home em 26/10/2026: 67 testes unitários e 57 jornadas desktop/mobile
passaram, com um teste de menu móvel pulado no desktop. Build de produção e
TypeScript passaram; lint sem erros, mantendo o aviso preexistente de imagem
externa em `media-image.tsx`. A cobertura verifica texto/áudio, clarificação e
pills após navegar, falha sem perder o prompt, ausência de popup na home mesmo
após 60 segundos e preservação da conversa nos imóveis. Apenas API de contrato,
sem geração paga ou escritas em produção.

Gravação e anexos usam o mesmo estado e respostas. Ver
[assistant-audio.md](assistant-audio.md) para multipart, HMAC, limites e timeout
de 95 segundos do envio de áudio. O fluxo de texto abaixo permanece disponível.

## Lista única e continuidade

`AssistantProvider` mantém histórico, token opaco, seleção, filtros e rascunho em
memória. `/buscar` não renderiza o histórico nem os cards de `recommendations`.
Seu input mostra apenas envio em andamento, erro ou “Lista atualizada” e uma
pergunta de clarificação quando necessária. Cada nova resposta válida em modo
search notifica a superfície ativa, que aplica `applied_filters` e exclusões na
URL `/buscar?assistant=1&...`, sem mudar de página e sem clique adicional. Essa
atualização automática foi explicitamente solicitada pelo usuário para a lista.
Na home, o envio explícito inicia a navegação para os resultados; a conversa
flutuante mantém suas confirmações próprias de navegação.

O Server Component consulta `GET /assistant/results` e renderiza a única grade
principal. Não usa os três cards do chat como se fossem a lista completa, não
filtra só a página em memória e não encaminha critérios avançados a `/search`.
A consulta parcial já pode aplicar cidade/tipo enquanto a IA pergunta modalidade.
Paginação, reload e voltar/avançar preservam critérios, preço base/total mensal,
false, zeros, preferências e exclusões. Paginar não faz uma nova geração de IA.
Uma nova mensagem reinicia a página. Token, pergunta e histórico não vão na URL.

Ao enviar o prompt, o campo mostra “Pensando…” e mantém os imóveis atuais.
Somente após a resposta validada do backend começa “Atualizando imóveis…”,
com carregamento da lista. Ao concluir o GET, mostra “Lista atualizada”. Uma
falha da IA preserva o prompt e os imóveis sem iniciar a consulta de resultados.
Os resultados anteriores ficam ocultos durante a atualização da lista. Erros de GET
não são tratados como lista vazia nem substituídos pelo catálogo sem filtros.
Só o total retornado pelo endpoint exato é mostrado como contagem global. Um
`action:no_results` não determina vazio: o GET pode conter imóveis já vistos.
A lista considera apenas exclusões explícitas, nunca todos os IDs vistos no chat.

O formulário manual permanece montado, mas oculto inicialmente. Ao selecioná-lo,
mostra os campos atuais. “Buscar imóveis” usa navegação interna, sem recarregar o
documento: mantém a aba, o formulário, a conversa e a rolagem, com carregamento
somente nos resultados. A URL recebe os critérios e página 1; voltar/avançar
restauram os filtros. Repetir a mesma busca reconsulta a rota sem recarga completa.
Após busca por IA ele preserva os filtros avançados em
campos ocultos e continua usando o endpoint exato; não perde tipo, mobília,
comodidades, base de preço nem exclusões ao editar um limite de orçamento.
O orçamento total mensal é rotulado corretamente. Busca manual independente
continua usando seu contrato anterior, inclusive palavra-chave no título.

As pills ficam visíveis nos dois modos. Elas são geradas no frontend a partir
de `GET /assistant/results.meta.applied_filters`, validado no servidor, e usam
as traduções/formatadores compartilhados com o assistente. A API retorna filtros
tipados, sem componentes de interface; não é necessário novo endpoint de pills.
Ao remover um critério, apenas esse campo/item é retirado, a página volta para 1
e a consulta exata preserva todos os demais campos e exclusões. Remover uma
comodidade preferida não remove a mesma comodidade obrigatória. Moeda e base do
orçamento aparecem como contexto, preservando a semântica dos valores. Links de
remoção não fazem prefetch e não iniciam geração de IA. Erros mostram filtros
selecionados, sem alegar aplicação bem-sucedida.

Respostas de clarificação precisam fornecer exclusões autoritativas mesmo sem
`filter_proposal`. A UI aceita `data.excluded_ids` ou os IDs de uma proposta
validada; se ambos faltarem, mostra falha sem fabricar uma consulta incompleta.
Não decodifica o token para reconstruir informações escondidas nele.

## Dependência de backend e disponibilidade

Em 23/10/2026, a checagem inicial retornou 404, mas a verificação final de
`GET /assistant/filters` e `GET /assistant/results` retornou HTTP 200 em produção.
A consulta real parcial por casa em Araucária retornou um imóvel e passou no
schema Zod; o preço nulo foi preservado. São GETs sem geração de IA. O checkout
local do backend está no commit 09dc6c3. Falta o ajuste descrito em
`docs/backend-assistant-filter-sync-prompt.txt`: retornar `excluded_ids` em toda
resposta search, inclusive clarificações, pois o envelope local ainda não o faz.
A integração do frontend usa o contrato real documentado e nunca troca para mocks
ou para a busca legada quando a consulta exata falha. Nenhum backend foi alterado
por esta implementação. Nenhuma geração paga foi executada nesta validação.

## Contrato e BFF

- Browser: POST `/api/assistente/mensagens`.
- API: POST `/assistant/messages` relativo a LISTINGS_API_BASE_URL.
- Base publicada: https://solo-leveling-api.onrender.com/api/v1/listings-platform .
- Payload estrito: question, history, selected_listing_id, search_token e context
  opcional com page/current_filters. Os quatro campos antigos continuam válidos.
  Não enviamos HTML, modelo, fatos do imóvel ou instruções. O snapshot de filtros
  aceitos só é enviado quando difere da conversa; não se reaplica estado antigo.
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

Na janela flutuante, sem seleção: “Encontre seu imóvel”; com seleção: “Faça qualquer pergunta sobre
o imóvel”. As mensagens anteriores continuam visíveis nessa janela e identificadas como busca
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

Na validação inicial, a execução adicional das specs no checkout local do backend apresentou falhas
nos request specs (400 esperado200). Esse checkout tinha alterações não
commitadas em andamento no próprio contrato/planner/conversation e novos
endpoints de filtros/resultados. Naquela etapa não alteramos esse repositório nem adotamos
context/current_filters ou outros campos além dos quatro do contrato anterior.
Essa observação é histórica: a busca de lista única agora aceita o contexto opcional documentado.
A disponibilidade do endpoint publicado foi verificada separadamente acima.

Comandos:
```
npm run lint
npm run typecheck
npm test
PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PRODUCTION=true npm run test:e2e -- tests/e2e/assistant.spec.ts tests/e2e/questions.spec.ts tests/e2e/chat-window.spec.ts tests/e2e/public-gallery.spec.ts
PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PRODUCTION=true npm run test:e2e -- tests/e2e/search-assistant.spec.ts tests/e2e/assistant.spec.ts tests/e2e/journeys.spec.ts tests/e2e/chat-window.spec.ts tests/e2e/questions.spec.ts
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

## Validação da lista única (23/10/2026)

36 testes unitários e 46 casos Playwright aprovados em desktop/mobile: input de
IA inicial, troca por teclado, consulta parcial na clarificação, refinamento da
mesma grade, ausência de segunda lista, contexto/histórico, orçamento total,
false/zeros, paginação/reload/voltar-avançar, erros sem fallback e ausência de
exclusões autoritativas. Build e typecheck aprovados. Lint sem erros, com o aviso
preexistente de img em media-image.tsx. Fixtures vivem somente em tests/.
A validação real consistiu nos GETs acima; nenhuma nova chamada paga de IA
foi executada e não se afirma que a clarificação esteja ativa em produção
antes do ajuste de envelope do backend.

## Rechecagem após o push do backend (23/10/2026)

Foram verificados novamente em produção: catálogo de filtros HTTP 200 com todas
as chaves esperadas; consulta parcial HTTP 200 com um imóvel; consulta avançada
HTTP 200 preservando furnished=false, bedrooms=0, base total_monthly, preferências
e exclusões; parâmetro desconhecido radius rejeitado com HTTP 400 invalid_request.
Os envelopes de resultados passaram na validação Zod.

Foi autorizada e executada uma única geração real, diretamente no endpoint da
API para inspecionar o envelope sem depender do schema do frontend já publicado.
A pergunta sintética sobre casa em Araucária retornou HTTP 200, mode=search,
action=clarify, city=Araucária, property_type=house e “Você quer comprar ou alugar?”.
O campo excluded_ids continuava ausente e filter_proposal era null. O contrato
anterior é válido, mas ainda não fornece a informação necessária para aplicar
com segurança a lista durante essa clarificação. Nenhum token foi registrado ou
salvo. Não houve repetição de chamada paga. O remoto master do backend ainda
apontava para 09dc6c3 na primeira consulta de referência deste teste.

## Estados de carregamento separados

Verificação da sequência “Pensando…” → “Atualizando imóveis…” → “Lista atualizada”:
36 testes unitários e 28 testes de navegador aprovados em desktop/mobile, com
build e typecheck aprovados. Os testes controlam separadamente a resposta do POST
e o carregamento dos resultados, confirmando que a consulta da lista não começa
durante o pensamento e que uma falha do POST mantém os imóveis e o rascunho.
Lint sem erros, com o aviso preexistente de img. Nenhuma geração paga nesta etapa.

Validação das pills: 38 testes unitários e 38 testes de navegador aprovados,
incluindo exibição após cada prompt, remoção individual, preservação dos demais
critérios/exclusões e ausência de chamadas de IA ao remover pills. Build e
typecheck aprovados; lint sem erros e com o mesmo aviso preexistente.

## Markdown nas respostas

`AssistantMarkdown` renderiza as respostas do chat e a última clarificação da
busca com CommonMark e GFM (negrito, listas, links, tabelas e código). O histórico
enviado à API mantém o texto original. Referências como `[source-2]` recebem link
somente quando o ID e uma URL segura constam nas citações daquela resposta.
HTML é exibido como texto; não há execução de HTML nem carregamento de imagens
externas. Links aceitam apenas HTTP/HTTPS sem credenciais e abrem com
`noopener noreferrer`. Tabelas e código têm rolagem própria na janela mobile.
