# Revisão administrativa

## Rotas e uso

Administradores acessam **Minha conta → Revisar anúncios**, ou `/admin/anuncios`. Membros não veem o link; a fila, o detalhe e os endpoints locais de revisão verificam novamente `GET /users/me` e exigem `role=admin`. As prévias delegam a validação da função ao detalhe administrativo protegido da API, evitando uma chamada de perfil por linha. Sem sessão válida, o cookie local é removido e o usuário retorna ao login existente. Não há credenciais administrativas fixas nem autenticação alternativa.

A fila aceita somente `status`, `city`, `source_id`, `page` e `per_page`. O padrão é `draft`, página 1, 20 registros. O formulário reinicia a página, mantém os filtros na URL e usa `has_more` para a próxima página; não apresenta total global. Cidade é preservada exatamente como digitada. O endpoint genérico pode retornar categorias distintas: a fila não oculta registros recebidos nem inventa um filtro por categoria.

Em `/admin/anuncios/[id]`, o administrador examina os dados canônicos, os atributos, `real_estate`, a aprovação editorial anterior e a origem selecionada. O seletor diferencia o **ID do anúncio de origem** do **ID da fonte**. Extração e fingerprint são exibidos como texto, sem HTML ou incorporação de mídia arbitrária. O detalhe retorna `media`; a galeria utiliza fotos processadas hospedadas no ImageKit, com placeholder quando indisponíveis. Links externos têm `noopener noreferrer`.

## Prévias na fila

Cada linha mostra até três fotos reais processadas, com capa primeiro, ordem original
e atribuição. Clicar na miniatura abre a revisão. Sem fotos há placeholder; uma
falha de prévia não bloqueia a ação Revisar nem os filtros/paginação.

O backend atual inclui mídia no detalhe, mas não no índice. O BFF local
`GET /api/admin/anuncios/[id]/previews` consulta **somente**
`GET /admin/listings/:id` com o Bearer do cookie HttpOnly. A API exige admin a
cada consulta; não há acesso pelo catálogo público a rascunhos. O BFF devolve
apenas até três itens com id, URL HTTPS de `ik.imagekit.io` sem credenciais e
atribuição. Não expõe extração, revisão, fingerprint ou payloads de origem.
Respostas privadas/no-store, sem cache compartilhado de mídia administrativa.

As linhas só consultam prévias ao entrar no viewport. Um escalonador por fila
limita a duas chamadas simultâneas, cancela as pendentes ao sair da fila e não repete
erros automaticamente. Timeout de 10 s no BFF/12 s no navegador; tentativa manual
disponível. O estado carregado permanece só no componente durante essa navegação.
Não há uma consulta adicional a `/users/me` por linha: isso esgotaria o limite
separado de perfil. As consultas de detalhe continuam contando no limitador geral.

Não exige alteração do backend ou novas variáveis. Para filas de volume maior,
uma evolução recomendada é retornar até três thumbnails no próprio índice
administrativo com carregamento de mídia em lote no backend, eliminando as
consultas de detalhe por linha. Essa capacidade não foi presumida nem simulada.

Para aprovar, selecione a origem e confirme que revisou seus dados. **Aprovar e publicar** publica imediatamente. O botão fica desativado enquanto a requisição está em andamento, se a versão estiver ausente ou se o status/ciclo de vida impedir aprovação. Essas verificações de interface não substituem a validação da API.

## Integração

Contrato fornecido pelo usuário e conferido em `ListingsPlatform::Admin::ListingsController`, na cópia local do backend no commit `5735c5b`:

- `GET /admin/listings`
- `GET /admin/listings/:id`
- `POST /admin/listings/:id/approve`
- Sessão existente: `/auth/login` e `/users/me`.

Todas as rotas acima são relativas a `LISTINGS_API_BASE_URL`, com `/api/v1/listings-platform` uma única vez. O contrato OpenAPI inicial em `docs/backend-openapi.json` é histórico e não descreve esta ampliação; os schemas atuais estão em `src/lib/admin-contracts.ts`.

O navegador usa apenas os endpoints locais `/api/admin/anuncios/[id]` e `/api/admin/anuncios/[id]/approve`. O servidor anexa Bearer ao chamar a API real. O corpo de aprovação tem **somente strings**, sem reinterpretar ou gerar o fingerprint:

```json
{"source_listing_id":"123","fingerprint":"versão recebida no detalhe"}
```

O token continua no cookie HttpOnly existente. Leituras e escritas administrativas são `no-store`; as respostas JSON locais também usam `Cache-Control: private, no-store`. O POST valida Origin contra APP_URL, Sec-Fetch-Site, Content-Type e o schema do corpo. A aplicação não possui fallback administrativo de demonstração; DEMO_MODE=true bloqueia acesso administrativo. Não foram adicionados endpoints de edição, rejeição, despublicação ou lote.

## Consistência e erros

Após sucesso, o detalhe recebe a resposta publicada e os dados de aprovação. O cache público recebe a tag `listings-public`, invalidada com `revalidateTag(tag, {expire: 0})`, sem servir a versão antiga na próxima consulta. Também são invalidadas homepage, busca, detalhes públicos e fila/detalhe administrativos. A fila usa leituras sem cache e links sem prefetch. Um link para o imóvel publicado é oferecido quando a categoria imobiliária foi confirmada; não há link público imobiliário para registros genéricos de outra categoria.

- **401:** encerra a sessão local e solicita login.
- **403:** informa acesso restrito; não tenta contornar a permissão.
- **404:** informa registro não encontrado.
- **409 / review_outdated:** descarta seleção e confirmação antigas, recarrega o detalhe e exige selecionar/revisar novamente. Nenhuma aprovação é reenviada automaticamente.
- **422 / listing_not_approvable:** recarrega status e origens, descarta confirmação e informa a impossibilidade. Se ainda não for aprovável, o botão continua desativado.
- **400:** informa entrada inválida.
- **Rede/timeout de aprovação:** o resultado pode ser incerto; é necessário atualizar o detalhe antes de qualquer tentativa manual adicional. Não há retries automáticos.
- **Falha na fila:** filtros e link de recuperação permanecem na URL/formulário.

Não é necessário polling. Uma navegação administrativa consulta o perfil para verificar a função; o backend inclui `/users/me` no limite de 20 requisições/IP/15 minutos. Não fazemos cache compartilhado de perfil nem forjamos cabeçalhos de IP.

## Dados incompletos e apresentação pública

`null` permanece ausente: **Preço não informado**, sem valor zero e sem periodicidade anexada a um preço inexistente. Disponibilidade `unknown`/ausente é **Disponibilidade não confirmada**. Cards e detalhes usam o mesmo adaptador. `reported_area_sqm` é **Área informada**, nunca área útil. Descrição ausente e mídias ausentes recebem texto/placeholder adequados. A aprovação editorial não altera ou confirma disponibilidade; o frontend não infere isso de `publication_review`.

## Ambiente e entrega

Nenhuma variável nova é necessária. Na Vercel, mantenha:

```env
LISTINGS_API_BASE_URL=https://solo-leveling-api.onrender.com/api/v1/listings-platform
APP_URL=https://real-ia.vercel.app
DEMO_MODE=false
```

A conta precisa ter sido promovida a admin pelo operador do backend. O frontend não cria ou promove administradores. Não exige mudança de CORS, pois o navegador não acessa a API diretamente. `/admin` está bloqueado em robots e as páginas administrativas têm noindex/nofollow.

A consulta pública sem credenciais à API real `/admin/listings` respondeu **401 unauthorized** em 20/10/2026. Isso confirma o endpoint protegido respondendo, não uma aprovação autenticada real. Não foram publicadas ofertas nem utilizados logins reais durante o desenvolvimento.

## Verificações

```sh
npm run lint
npm run typecheck
npm test
PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PRODUCTION=true npm run test:e2e
```

O último comando gera o build e executa o servidor de produção para testar também a invalidação do cache. Sem PLAYWRIGHT_PRODUCTION=true, permanece o servidor de desenvolvimento original. Os testes usam somente o servidor de contrato isolado em `tests/mock-api.ts`; ele nunca é importado pela aplicação e não substitui a API em produção.

Lint foi adicionado com a configuração oficial de Next.js/TypeScript. Há um aviso existente de `<img>` em `media-image.tsx`, mantido por renderizar imagens externas autorizadas diretamente, sem criar proxy aberto. O audit identificou cinco avisos altos na cadeia **de desenvolvimento** `eslint-config-next → fast-glob → micromatch → braces`; a recomendação automática rebaixava Next lint para 14 e não foi aplicada. Essa cadeia não integra o runtime da aplicação. Monitorar a atualização upstream de braces/configuração de lint.

Resultado final em 20/10/2026: **13 testes de contrato/unidade passaram; 28 jornadas Playwright passaram** (14 desktop e 14 mobile) no servidor de produção, após build bem-sucedido. Typecheck passou; lint terminou sem erros e com o aviso de imagem citado acima. `npm audit --omit=dev` reportou zero vulnerabilidades de produção. A integração autenticada com a API publicada não foi exercitada, pois não foi utilizada credencial admin real. Não houve publicação de anúncios reais.

Os testes de produção usam um namespace de URL exclusivo a cada execução no servidor de contrato para não reutilizar caches HTTP de execuções anteriores. Asserções públicas são limitadas ao componente público durante transições de rota, evitando confundir conteúdo de entrada/saída durante o streaming.

Verificação das prévias em 23/10/2026: 42 testes unitários e 20 jornadas
administrativas passaram (desktop/mobile), com build de produção, TypeScript e
lint sem erros (aviso de imagem preexistente). Os seis casos de prévias foram
reexecutados após a proteção contra eventos duplicados e passaram. A validação
usou API de contrato; nenhuma conta ou publicação real foi utilizada.
