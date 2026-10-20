# Morada · descoberta de imóveis

Frontend independente da ListingsPlatform, em português brasileiro. Next.js App Router, React, TypeScript estrito, Zod e CSS com tokens. O diretório estava vazio; nenhum código do backend foi alterado. Os ícones usam Lucide (ISC). DM Sans e Manrope são servidas localmente via Fontsource (OFL), sem requisições ao Google Fonts. A ilustração arquitetônica é CSS original; nenhum card usa fotografia fictícia.

## Executar

Node.js 22.13+ ou 24 e npm. As versões resolvidas estão no package-lock.json.

```sh
npm ci
cp .env.example .env.local
npm run dev
# http://localhost:3001
npm test
npm run typecheck
npx playwright install chromium
npm run test:e2e
npm run build
npm start
```

Para usar o Chrome instalado: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`. Os testes sobem uma API de contrato em 4010 e o frontend em 3001; essas portas precisam estar livres. Não acessam o backend real. Não execute uma prévia na mesma porta durante os testes.

## Ambientes

| Variável              | Uso                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LISTINGS_API_BASE_URL | URL completa, com `/api/v1/listings-platform` uma única vez. Padrão local: http://localhost:3000/api/v1/listings-platform                                |
| APP_URL               | Origem canônica do frontend. Local: http://localhost:3001. Produção: origem HTTPS real, sem caminhos                                                     |
| DEMO_MODE             | `true` ativa exclusivamente fixtures fictícias; padrão `false`. Aviso visível, noindex, sem contas. Nunca há fallback automático                         |
| MEDIA_ALLOWED_HOSTS   | Lista de hostnames HTTPS separados por vírgula autorizados a renderizar imagens, após revisão. Vazia por padrão; demais mídias ficam como links externos |

Nenhuma variável pública de API é necessária: chamadas passam pelo servidor. Reinicie o processo ao mudar o ambiente. Um ambiente de demonstração deve ser separado do ambiente real, incluindo cache e build.

## Arquitetura e rotas

- `src/lib/contracts.ts`: validação de envelopes e campos, complementada pelos controladores reais.
- `src/lib/api.ts`: cliente exclusivamente servidor, timeout de 10 segundos, sem retries, cache público de 60 segundos e deduplicação por renderização. Perfil e escritas usam no-store.
- `src/lib/filters.ts`: whitelist de filtros, intervalos e serialização da URL; categoria definida pelo servidor após confirmação de `/categories`.
- `src/lib/presentation.ts`: BRL/moedas, periodicidade, atributos, datas, links e slugs. Valores monetários são strings e BigInt; não há cálculos de custo total.
- `src/lib/auth-contracts.ts`: schemas de entrada compartilhados entre cliente e servidor.
- `src/components`: shell, busca, cards/grade/preço/atributos, formulários de conta e compartilhamento.
- `/`: homepage SSR, busca convencional, publicações recentes e explicação das fontes.
- `/buscar`: resultados SSR, filtros GET na URL, ordenação, chips e anterior/próxima usando has_more. Sem total global. Alterar formulário reinicia a página.
- `/imovel/[id]/[slug]`: ID estável; slug derivado redireciona para canônico. Fontes, mídias, atribuições, descrição textual, datas reais e compartilhamento.
- `/auth/login`, `/auth/register`, `/auth/verify`, `/auth/forgot`, `/auth/reset`: fluxos independentes; tokens recebidos por e-mail são colados em formulários.
- `/conta`: perfil, alteração de nome, rotação, logout e exclusão com confirmação e senha.
- `/api/session/[action]`: BFF restrito a ações conhecidas, POST local; traduz métodos e caminhos do backend.
- `/api/session-expired`: remove exclusivamente o cookie inválido e volta ao login.
- `/privacidade`, `/robots.txt`, `/sitemap.xml`: informação e SEO. Sitemap inclui apenas a homepage conhecida; não varre o catálogo. Busca e contas não são indexadas.

Formulários nativos acessíveis e Zod dispensaram React Hook Form. Navegação SSR e fetch no servidor dispensaram TanStack Query. Não foi necessário Tailwind/shadcn para este conjunto de componentes. CSS mantém tokens e estados centralizados. A aplicação não contém Rails, persistência própria, coleta, interpretação de IA ou endpoints presumidos.

## Contrato confirmado e implantação da API

Em 20/10/2026, o acesso HTTP ao GitHub indicado retornou 404. Foi encontrada uma cópia local limpa do backend exatamente no commit **f50571d**. Foram lidos `docs/listings_platform/README.md`, OpenAPI, seed e os controladores `CatalogController` e `AuthController`; a cópia do OpenAPI está em `docs/backend-openapi.json`. O OpenAPI não detalha os payloads; os schemas TypeScript refletem os serializers Ruby.

A consulta a `https://solo-leveling-api.onrender.com/api/v1/listings-platform/categories` retornou **HTTP 500**. A implantação das novas capacidades NÃO está confirmada. É necessário aplicar migrações, verificar seeds/categorias e obter respostas válidas antes do lançamento. Não foram executadas escritas contra produção.

Busca sempre exige categoria confirmada `real-estate`; a ausência dela é um erro recuperável, sem exposição de veículos. Apenas a categoria exata é utilizada nesta fase. Categorias imobiliárias filhas adicionais precisam ser explicitamente mapeadas após confirmação; não inferimos pelo nome. Os atributos bedrooms/balcony usam o schema da categoria e só aparecem quando presentes. Nenhum filtro por atributo, IA ou mapa é enviado.

A API não oferece capa, número de fotos ou de fontes na listagem. Cards usam placeholder sem requisições individuais. Mídias e fontes são buscadas apenas no detalhe, no máximo as 100 que o backend entrega; imagens têm lazy loading e dimensões. Vídeos e documentos são links, sem iframes nem reprodução automática. Não há proxy aberto de imagens. Links exigem HTTPS, sem credenciais; origens HTTP não são incorporadas. Descrição é texto React, nunca HTML.

## Sessão e segurança

O BFF recebe JSON limitado a campos permitidos. Exige Origin idêntica a APP_URL e rejeita Sec-Fetch-Site cross-site nas escritas, além do cookie SameSite=Lax. O token opaco é armazenado em cookie `morada_session`, HttpOnly, Path=/, sete dias no máximo e Secure em produção. Só o servidor envia Authorization: Bearer. Login/rotação jamais retornam token ao cliente. Cadastro não faz login. Rotação substitui o cookie, logout/exclusão/reset apagam-no; 401 nas ações ou no perfil remove a sessão local. Perfil não é compartilhado por cache.

Não há localStorage, JWT decode, refresh token, logs de credenciais ou polling. O token ainda existe no transporte servidor/API: use HTTPS e infraestrutura confiável. Não configure log de corpos de requisição nos proxies. Configure limites de tamanho de corpo e rate limiting também na borda do frontend.

O BFF agrega o tráfego no IP do servidor. O backend limita autenticação/perfil a 20 requisições por IP em 15 minutos e geral a 120/minuto. Defina uma política de proxy confiável em conjunto com o backend antes de aumentar tráfego; o frontend NÃO forja X-Forwarded-For. Nenhuma requisição de perfil é feita no cabeçalho global. CORS não é necessário ao BFF; se introduzir chamadas de navegador, configure exatamente a origem em LISTINGS_PLATFORM_ALLOWED_ORIGINS, nunca wildcard.

## Qualidade e limitações

Testes de unidade cobrem whitelist, correspondência exata, paginação, campos ausentes, preços sem perda por ponto flutuante, URLs e senhas (12 caracteres/72 bytes). Playwright cobre descoberta, detalhe/fontes, filtros na URL e voltar, paginação, erros, cadastro/verificação/reset, sessão, CSRF e foco/mobile com API de contrato isolada.

Os resultados efetivamente executados estão em `docs/verification.md`. Não foi feita auditoria completa WCAG nem medição de Core Web Vitals. O projeto inclui foco visível, skip link, labels, regiões de status, alvos de toque e movimento reduzido. O painel móvel de filtros usa disclosure nativo. Recursos futuros estão desativados em `flags`, sem componentes ativos nem chamadas.

Dependências de lançamento: corrigir/confirmar implantação da API e migrações; SMTP/worker e entrega real de tokens; permissão e hosts de mídias; catálogo real (seeds são sintéticos); configuração de proxy/rate limits; identidade e contato do controlador de dados e retenção para substituir a nota de pré-lançamento na página de privacidade. Fontes externas não têm condições suficientes para afirmar economia ou menor custo total, por isso nenhum destaque de menor preço é calculado.

## Implantação

Use hospedagem Node compatível com Next.js (por exemplo, Vercel ou contêiner Node 24). `npm ci && npm run build`, seguido de `npm start`; configure APP_URL HTTPS, API HTTPS e DEMO_MODE=false. Use um único domínio/origem para a sessão. Em plataformas que fornecem PORT, execute `npx next start -p "$PORT"` em vez do script local. Não publique `.env.local`. Não é exportação estática: sessão e SSR exigem runtime servidor.

Faça smoke test separado com GET /categories, /search?category=real-estate e um ID público conhecido antes de apontar tráfego. Testes de contrato não provam implantação real, entrega de e-mail ou validade dos anúncios.

O Git local foi inicializado para este frontend. Nenhum remoto, commit ou deploy foi criado. Para revisar a aparência sem backend: `DEMO_MODE=true npm run dev`; para integração real, mantenha DEMO_MODE=false. A prévia usada no QA é temporária e pode ser reiniciada com esses comandos.
