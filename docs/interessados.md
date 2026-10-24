# Interessados por imóvel

## Fluxo público

O botão “Tenho interesse” no detalhe abre um diálogo nativo, com foco contido,
Escape e retorno ao botão. Nome, ao menos um contato válido, canal correspondente
e consentimento explícito são obrigatórios. WhatsApp só aparece com telefone válido;
nenhum DDI é acrescentado. A pessoa revisa os dados e confirma antes do POST.
Não há cadastro obrigatório, registro implícito por navegação ou integração com IA.

`PropertyInterest` mantém payload e UUID em memória durante a tentativa. Em falha
de rede/timeout/503, a repetição manual usa exatamente a mesma chave e corpo JSON.
O sucesso é somente um recibo “Interesse registrado”. Uma nova solicitação
deliberada, inclusive após conflito de chave, recebe outro UUID. Não há retries
automáticos, cookies com dados pessoais, armazenamento local nem analytics.

## Rotas e contratos

- `POST /api/imoveis/:id/interesses` → `POST /listings/:id/interests`.
- `/admin/interessados`: fila, filtros e resumo de coorte.
- `/admin/interessados/:uuid`: contatos, snapshot, ações e linha do tempo.
- `GET /api/admin/interessados`, `/summary`, `/assignees`, `/:uuid` e
  `/:uuid/events`: BFF privado para os mesmos caminhos `/admin/leads` da API.
- `POST /api/admin/interessados/:uuid/events` → `POST /admin/leads/:uuid/events`.

Os caminhos do backend são relativos a `LISTINGS_API_BASE_URL`, sem duplicar o
prefixo. Os schemas de `src/lib/lead-contracts.ts` refletem os serializers Ruby,
`docs/listings_platform/leads.md` e `leads-frontend-prompt.txt` do backend.
Respostas são validadas nos limites; contatos nunca aparecem no recibo público.

## Sessão, IP e privacidade

As páginas usam `requireAdmin` existente. O BFF lê o cookie HttpOnly e envia o
Bearer somente ao servidor; a própria API exige admin em cada leitura e evento.
O BFF evita consultar `/users/me` a cada evento, preservando o limite de perfil.
401 limpa o cookie e solicita login; 403 oculta o conteúdo privado. Leituras e
escritas usam `no-store`, sem cache compartilhado de contatos ou histórico.
Escritas validam Origin/APP_URL, Fetch-Site, tamanho e campos permitidos.

A captação reutiliza `questionProxyHeaders`: na Vercel, somente o IP canônico de
`x-vercel-forwarded-for` sobrescrito pela plataforma pode ser assinado. O HMAC
inclui POST, caminho real completo, timestamp, IP e SHA-256 dos bytes JSON originais,
que são encaminhados sem serialização posterior. Cabeçalhos Morada do navegador
não são copiados. Falta de configuração na Vercel falha de forma fechada.
Fora da Vercel, cabeçalhos de IP recebidos não são confiados: configure o proxy
suportado no backend antes de disponibilizar uma instalação com outro provedor.

Variáveis existentes, exclusivamente no servidor:

```env
LISTINGS_API_BASE_URL=https://solo-leveling-api.onrender.com/api/v1/listings-platform
APP_URL=https://real-ia.vercel.app
LISTINGS_BFF_SHARED_SECRET=<mesmo segredo aleatório no frontend e backend>
DEMO_MODE=false
```

Não use `NEXT_PUBLIC_*` para sessão ou segredo. A captação tem limites próprios
de 10/hora e 50/dia por IP, além do limite geral; não consome cota de IA.
`Retry-After` é respeitado e não provoca reenvio. Não configure logs de corpos
de requisição nos proxies. Nome, contatos, notas e mensagens são texto inerte,
sem HTML/Markdown, e não entram no estado do assistente ou URLs de navegação e filtros.

## Acompanhamento e concorrência

`LeadEventForm` usa `allowed_event_types` e a versão recebida da API. Envia apenas
campos pertinentes à ação e pede revisão/confirmação. Uma nota também atualiza a
versão pelo retorno do backend. Não há PATCH de status, arrastar etapas, edição
de eventos, disparo de contato, integração de calendário ou alteração do anúncio.
Ganho não preenche valor/moeda pelo preço do imóvel. Perda/reabertura exigem motivo.

409 `lead_outdated` preserva o texto, recarrega o detalhe e bloqueia novo envio até
o operador revisar a versão atual. Nenhum evento é reenviado automaticamente.
Falha com resultado desconhecido oferece repetição com chave/payload originais.
Após sucesso, lead e evento são reconciliados pela resposta; a lista/resumo são
invalidados para a próxima consulta. O histórico inicia com 50 registros e segue
em page=2, per_page=50; IDs são reconciliados para evitar duplicação.

Datas de entrada e apresentação usam America/Sao_Paulo, convertidas para ISO UTC
com fuso explícito no envio. Data real, data de registro e visita prevista são
apresentadas separadamente. Não é possível registrar visita futura como realizada.
O snapshot da captação permanece e só há link para o anúncio atual quando sua
consulta pública confirma disponibilidade da rota.

O resumo separa status atual de marcos históricos. Taxas são frações da coorte
captada nos filtros, formatadas em porcentagem; denominador ausente é “—”. Não
há inferência de causalidade de campanha, comissão ou conversão entre etapas.

## Implantação e verificação

As rotas publicadas foram sondadas sem criar registros: `/admin/leads`, `/summary`
e `/assignees` responderam 401 sem sessão; POST vazio em `/listings/2/interests`
respondeu 422 `consent_required`. Isso confirma as rotas e proteções observadas,
mas não comprova a migration nem o fluxo autenticado completo em produção.
Antes de anunciar disponibilidade, confirme no Render a migration
`20261023190000_create_listings_platform_leads.rb` aplicada e uma leitura com uma
conta admin. Nenhum backend foi editado ou interessado real criado nesta tarefa.

Os testes usam exclusivamente `tests/mock-leads.ts` e a API local de contrato.
Não há fixtures ou fallback automático de captação em produção. Em demonstração,
o botão fica desabilitado e o BFF rejeita captação real.

```sh
npm test
npm run typecheck
npm run lint
PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PRODUCTION=true npm run test:e2e -- tests/e2e/leads.spec.ts
npm run build
```

O frontend precisa de runtime Next.js, não exportação estática. Os mesmos deploys,
allowlist exata de origem e cookie Secure existentes são mantidos.

### Resultados executados

- 56 testes unitários/contrato aprovados.
- Suíte completa Playwright: 175 aprovados e 3 omitidos por dispositivo (casos já
  existentes de menu/gesto de mouse), com API de contrato local e build de produção.
- Após os últimos ajustes de consistência, mais 4 verificações direcionadas
  desktop/mobile aprovadas: período preserva segundos/fuso ao alterar outro filtro;
  resposta antiga não sobrescreve versão mais recente após registrar evento.
- Build de produção e TypeScript aprovados; lint sem erros, com o aviso
  preexistente de `img` em `media-image.tsx`. Capturas do formulário e resumo em
  desktop/mobile foram inspecionadas. Não foi realizada auditoria WCAG completa.
- Verificação real em produção limitada às quatro sondagens seguras descritas
  acima. Nenhum interessado real, evento administrativo real ou chamada de IA
  foi criado/executado.
