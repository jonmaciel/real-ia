# Cadastro manual de imóveis

## Experiência e rotas

- `/anunciar`: texto, gravação/anexo de áudio e fotos, sem formulário longo. Entrada por texto, áudio, fotos ou combinação. Exige sessão e e-mail verificado.
- `/anunciar?cadastro=<UUID>`: retomada privada pela mesma conta ou administrador. O UUID é o único dado do cadastro na URL. Guarde o link após a criação.
- `/admin/anuncios?status=draft&creation_method=manual_ai`: fila filtrada e badge Manual.
- `/admin/anuncios/:id`: entrada original/transcrição como texto, extração estruturada, edição, fotos, pendências, aprovação individual, rejeição e reabertura.
- `/api/anuncios-manuais/[[...path]]`: BFF restrito aos caminhos/métodos documentados abaixo; nunca um proxy aberto.

Nenhum novo pacote, banco, modelo de IA ou serviço de coleta foi adicionado. O fluxo usa a API real; simulações existem apenas em `tests/`. Busca, assistente, áudio de conversa e interessados mantêm seus fluxos independentes. A captura de áudio existente ganhou apenas um rótulo opcional para anexar o arquivo ao cadastro antes do envio combinado.

## Contrato utilizado

Base `LISTINGS_API_BASE_URL`, incluindo `/api/v1/listings-platform` uma única vez. Consultados os controladores reais `ManualListingsController`, `Admin::ListingsController`, `CatalogController`, `ManualIntake::Candidate`, `Workflow`, `Draft` e `docs/listings_platform/manual-intake.md` no backend.

| Método/caminho upstream | Uso |
| --- | --- |
| POST `/manual-listings` | JSON `request_key,prompt` ou multipart original com `request_key,prompt,audio`; nunca fotos |
| GET `/manual-listings/:uuid` | Estado privado; não chama IA |
| POST `/manual-listings/:uuid/photos` | Multipart original `images[]`, lotes sequenciais de até quatro |
| GET `/manual-listings/:uuid/photos?page=1&per_page=100` | Todas as páginas seguindo `has_more` |
| PATCH `/manual-listings/:uuid/cover` | `photo_id` persistido |
| DELETE `/manual-listings/:uuid/photos/:photo_id` | Remoção do cadastro durante `collecting` |
| POST `/manual-listings/:uuid/process` | Corpo vazio, uma chamada por vez, até oito imagens/ciclo |
| PATCH `/admin/listings/:id` | `fingerprint,fields`; apenas manual em rascunho com análise pronta |
| POST `/admin/listings/:id/approve` | `source_listing_id,fingerprint` como strings |
| POST `/admin/listings/:id/reject` | Mesmos campos e `reason` de até 500 caracteres |
| POST `/admin/listings/:id/reopen` | Reabre como rascunho, sem publicar |
| GET `/listings/:id/media?page=1&per_page=200` | Galeria pública percorre todas as páginas |

Os schemas Zod validam os limites da aplicação. O editor envia uma extração completa e preserva todas as chaves de `address`, `contact`, `attributes` e `pricing`, inclusive `null`. O backend substitui esses objetos inteiros. Não envia status, autor, origem, permissões ou decisão editorial em `fields`. Após salvar, o frontend consulta novamente o detalhe e exige uma nova revisão com o fingerprint atualizado.

## Sessão, privacidade e retomada

O BFF lê exclusivamente o cookie HttpOnly `morada_session` e anexa Bearer no servidor. O backend valida verificação de e-mail, dono do cadastro e papel administrativo em cada operação. Escritas verificam `Origin` contra `APP_URL` e bloqueiam `Sec-Fetch-Site: cross-site`. Respostas privadas usam `private, no-store`; a página é dinâmica/noindex e excluída do robots. Nenhum token, prompt, áudio, contato ou foto vai para analytics, logs ou query strings. Nada disso é salvo no armazenamento do navegador.

`request_key` permanece em memória durante uma tentativa e seus retries; alterações na entrada geram nova chave. O UUID recebido substitui a URL para permitir retomada após recarregar. Arquivos ainda não enviados ficam apenas na memória da aba; há aviso ao sair. Após reload, reanexe os arquivos pendentes para reenvio ou remova os registros pendentes na seção de organização. O backend deduplica por conteúdo. A primeira foto é a capa padrão; outra capa local é aplicada pelo ID recebido do servidor. Duplicatas já persistidas podem impedir o mapeamento local: confira/escolha a capa na lista persistida.

Fotos e gravações locais usam object URLs revogadas ao remover/desmontar. A gravação mantém os limites existentes de 60 s e 4 MiB, pede permissão após ação e encerra as tracks. A transcrição é exibida sem gerar uma segunda chamada de texto. Envie apenas dados autorizados para publicação; a privacidade explica armazenamento e revisão.

## Estados, limites e falhas

O cadastro distingue `collecting`, `processing`, `ready` e o status editorial do imóvel. `ready` mostra “Rascunho criado. Aguardando revisão.” e nunca dispara aprovação. Uploads/capa ficam bloqueados em processamento; novas fotos após `ready` só seguem se o anúncio permanecer draft. Publicado é somente leitura; rejeitado exige reabrir no admin. Campos faltantes são destacados e impedem aprovação. Valores ausentes continuam desconhecidos; taxas mantêm sua periodicidade e nenhum total é reconstruído. Uma fonte manual pode ter `original_url=null`, sem botão externo inventado. Contatos públicos retornados pela API são apresentados na origem após publicação.

Falhas não causam repetição automática. O frontend consulta o estado após falha e preserva anexos. Upload pode ser repetido manualmente com o lote original, deduplicado pelo backend. `submission_busy` impõe espera de pelo menos três segundos; `429` respeita `Retry-After` (ou 60 s), interrompe a cadeia e exige ação manual. `ai_timeout`/`ai_unavailable` preservam o UUID. `images_upload_incomplete` orienta concluir ou remover pendências. Não aumenta quotas do backend. Aprovar/rejeitar/reabrir invalidam catálogo e páginas de detalhe; conflito `review_outdated` exige nova consulta/revisão.

Timeout do BFF: 135 s por chamada, `maxDuration=180` (Node). Cliente: 145 s para upload, 55 s para criação/transcrição, 65 s por análise. Cada lote tem no máximo quatro imagens, cobrindo até 120 s de upload sequencial no backend. A cadeia de análises é serial e limitada pela contagem de imagens pendentes, encerrando em ready ou primeiro erro. Não existem retries automáticos em chamadas pagas.

## Hospedagem e implantação

Variáveis existentes: `LISTINGS_API_BASE_URL`, `APP_URL`, `DEMO_MODE=false`. **Não adicione chaves de IA ou ImageKit ao frontend.** O backend precisa estar migrado e com provedores/quotas configurados conforme sua documentação. O BFF manual usa autenticação Bearer e não altera a integração HMAC do assistente público.

**Limitação da Vercel:** [Vercel Functions limita o corpo a 4,5 MB](https://vercel.com/docs/functions/limitations#request-body-size), antes de executar Next. `maxDuration` ou `bodySizeLimit` não aumentam esse teto. Com `VERCEL` presente, o frontend divide lotes por tamanho até 4 MiB + 64 KiB de envelope; reserva 64 KiB para multipart. Um arquivo individual maior que cerca de 4 MiB continua selecionado e recebe aviso explícito, sem compressão/descarte silenciosos. Áudio de até 4 MiB cabe no envelope reservado. A API continua aceitando fotos de até 5 MiB.

Para cumprir integralmente 5 MiB por foto via BFF, hospede Next Node atrás de ingress com corpo de **24 MiB** e timeout de pelo menos **180 s**, sem a variável `VERCEL`. Não há como encaminhar 5 MiB intactos por uma função Vercel com esse teto. Outra evolução requer contrato de upload direto com autorização curta/presign no backend; não foi inventado endpoint nem exposto Bearer ao navegador. Não habilite upload direto irrestrito ao provedor. Configure redaction de logs de requisição no ingress/backend, inclusive multipart e extração, além do código desta aplicação.

Deploy: `npm ci`, `npm run lint`, `npm test`, `npm run build`, `npm start` (3001). Use HTTPS e `APP_URL` exato. Na Vercel, Fluid Compute/plano deve aceitar `maxDuration=180`; confirme o limite efetivo. Não alterar allowlist de origem para wildcard.

## Verificação

Testes automatizados usam API de contrato em 4010 e build de produção em 3001:

```sh
npm test
npm run lint
npm run typecheck
PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PRODUCTION=true npm run test:e2e
```

A cobertura inclui fotos-only com 11 arquivos e dois ciclos de análise, capa, texto incompleto/correção/fingerprint, áudio+texto sem segundo POST, multipart byte a byte, reenvio de upload parcial, quota, isolamento, verificação de e-mail, idempotência, rejeição/reabertura, rascunho privado e galeria pública com 205 fotos. Fixtures nunca entram na aplicação publicada.

Verificação real limitada: em 24/10/2026, GET não autenticado `/manual-listings/00000000-0000-4000-8000-000000000000` retornou **401 `unauthorized`**, confirmando a rota protegida publicada. Isso não valida credenciais dos provedores, uploads, IA ou migrations de produção. Não foram criados anúncios nem feitas chamadas pagas ou aprovações reais para testar. O operador deve validar um cadastro autorizado antes de abrir o fluxo aos anunciantes.

Resultados locais de 24/10/2026: **60 testes de unidade/contrato passaram**. Suíte completa de produção: **201 jornadas passaram, três puladas por dispositivo**. Depois dos ajustes finais de reconciliação do editor e validação da extração, a execução de `manual-intake.spec.ts` e `admin.spec.ts` passou com **38 jornadas desktop/mobile**. Inclui preservação de taxas ao remover outra cobrança e falha de salvamento sem mudança de fingerprint, evitando aprovar uma edição que não foi salva. Build e TypeScript estrito passaram. Lint sem erros; permanece o aviso preexistente de `<img>` em `media-image.tsx`. Testes locais não equivalem a auditoria de acessibilidade ou validação dos provedores de produção.
