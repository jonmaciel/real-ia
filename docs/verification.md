# Verificações executadas

Data: 20/10/2026. Node.js 24.18.0, npm 11.16.0, Next.js 16.4.2.

- `npm test`: **10 testes passaram**, zero falhas. Whitelist, limites/valores repetidos, correspondência exata, moeda sem perda por ponto flutuante, protocolos, ausência de atributos/coordenadas, paginação sem total, senhas/bytes/Unicode, perfil restrito e flags desativadas.
- `npm run typecheck`: passou. O build final também concluiu a checagem TypeScript estrita.
- `npm run build`: passou, incluindo SSR, handlers, imagem Open Graph e rotas de metadados. Não requer rede/API para gerar o build.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`: **14 jornadas passaram**, sete em desktop e sete em viewport mobile Chromium. API de contrato isolada em 4010, frontend em 3001. Chrome instalado utilizado; o Chromium esperado pela instalação padrão do Playwright não estava baixado.
- Verificação visual: homepage de demonstração em 1440px e 390px. Sem rolagem horizontal em 390px. Banner explícito e metatag `noindex, nofollow` conferidos. Screenshots temporários em `/private/tmp/morada-desktop.png` e `/private/tmp/morada-mobile.png`.
- Instalação npm final: nenhuma vulnerabilidade reportada pelo audit da instalação; isso não substitui auditoria de segurança.

## Jornadas automatizadas

1. Homepage → cidade/modalidade → resultados → detalhe sem imagem/coordenadas → fontes com preços diferentes → link original HTTPS. Voltar preserva cidade na URL/formulário.
2. Paginação usando has_more, sem total; parâmetro desconhecido não encaminhado. Mock rejeita busca sem a categoria imobiliária correta.
3. Vazio e erros HTTP 400, 401, 403, 404, 422, 429 e 500 com recuperação.
4. Cadastro sem sessão automática; verificação por token; solicitação e redefinição de senha; login; cookie HttpOnly/SameSite; rotação altera token; logout remove cookie.
5. CSRF por Origin hostil e método GET de autenticação bloqueados.
6. Skip link acessível pelo teclado e ausência de overflow horizontal.
7. Token inválido; e-mail não verificado; token de sessão expirado removido; atualização de nome e exclusão confirmada por senha.

Os projetos rodam em um worker porque usam a mesma conta sintética e o reset revoga sessões. Não há retry automático para ocultar falhas. Uma rodada intermediária identificou interferência entre resets paralelos; foi resolvida com a execução serial do contrato. Outra rodada foi invalidada pelo reinício do servidor durante a formatação; a rodada completa seguinte passou sem edição concorrente.

## Verificação real e limites

A cópia local do backend estava limpa no commit f50571d. Foram inspecionados documentação, OpenAPI, controladores e modelos. A URL pública `/api/v1/listings-platform/categories` retornou HTTP 500. A API publicada não foi considerada funcional nem foram feitas escritas de autenticação em produção.

Não foram exercitados SMTP real, migrações de produção, tráfego/capacidade, auditoria completa WCAG, Core Web Vitals, hosts reais de mídia ou preços de anúncios reais. O cookie Secure é configurado por NODE_ENV em produção; as jornadas locais HTTP validam HttpOnly e SameSite, sem simular TLS de produção.

A inspeção visual não equivale a uma auditoria de acessibilidade. O teste de teclado cobre o acesso inicial; a aplicação mantém controles HTML nativos e foco visível, mas revisão assistiva completa continua sendo uma etapa de lançamento.

## Ampliação: revisão administrativa (20/10/2026)

A suíte atual passou com **13 testes de unidade/contrato e 28 jornadas desktop/mobile**; o servidor Playwright foi iniciado com `npm run build && npm start` para verificar a invalidação do cache em produção. Lint passou com um aviso existente de `<img>` e TypeScript passou. A rota administrativa real, sem credenciais, respondeu 401. Detalhes, limitações e avisos das ferramentas de desenvolvimento: [revisão administrativa](admin-review.md).

## Ampliação: galeria pública (20/10/2026)

Validação atual: **15 testes unitários/contrato e 42 jornadas Playwright passaram** no build de produção, com desktop e viewport móvel. TypeScript e build passaram; lint sem erros, mantendo um aviso existente de imagem externa. A cobertura nova inclui capa/ordem, álbum, plantas, fullscreen/zoom, foco, gestos de toque e mouse, falhas de imagem e ausência de mídia. [Referências e decisões](gallery-ux.md).
