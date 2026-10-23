# Detalhe do imóvel — referência Rentola

Referência solicitada: [anúncio Rentola em Curitiba](https://rentola.com.br/en/listings/apartamento-1-quarto-vila-izabel-25m-p2d7770), examinado no navegador em 23/10/2026. O leitor web não conseguiu abrir a página; a inspeção visual foi feita no navegador, após rejeitar cookies opcionais. Foram observados galeria antes do título, painel lateral de preço, ficha de características e seções de descrição/localização.

## Aplicação no Morada

- Galeria de largura integral antes do título. Com pelo menos três imagens autorizadas, o desktop exibe uma foto principal com carrossel e duas prévias clicáveis, todas abrindo o visualizador existente. As prévias mantêm atribuição e não demandam novas chamadas à API.
- No desktop, o mosaico substitui a faixa redundante de miniaturas; Ver todas abre o álbum completo. No celular permanecem carrossel e miniaturas, com gestos, teclado, foco, tela cheia e zoom preservados.
- Preço ao lado do bloco de título no desktop e após título/atalhos no celular. O painel permanece acessível sem login; as datas estão em um disclosure nativo para reduzir ruído.
- Características conhecidas em ficha semântica `dl`. O adaptador reconhece tipo imobiliário, quartos, banheiros, vagas, área útil explicitamente fornecida, área informada e varanda. Valores ausentes ou inválidos não se tornam zero. Um zero explícito de vagas é preservado. Detalhes estruturados nulos não apagam atributos já publicados.
- A área sem classificação continua rotulada Área informada, sem equivalência com área útil. Sem atributos, a ficha informa a ausência.
- Descrição, fontes, contatos e mapa gratuito mantidos. Nenhuma classificação “abaixo do mercado”, alertas, recomendações ou bloqueio por cadastro foi adicionada: esses recursos vistos na referência não têm sustentação no contrato atual do Morada.

## Arquivos

`PropertyGallery` mantém as interações existentes e ganhou prévias; `PropertyFacts` é Server Component, com adaptação central em `presentation.ts`. A página de detalhe recebeu a composição em áreas de grid (introdução, preço e corpo), e os estilos continuam em `portal.css`. Não foram adicionadas dependências, imagens ilustrativas nos imóveis ou endpoints.

## Verificação

Testes unitários verificam atributos ausentes/inválidos, fallback de dados estruturados e distinção de áreas. Playwright verifica a galeria antes do título, prévia → visualizador → retorno, painel alinhado no desktop, ordem móvel, teclado, gestos, mapa, fontes e ausência de overflow. As capturas usam dados de contrato, não anúncios reais.

Resultados em 23/10/2026: build de produção e TypeScript passaram; lint sem erros, com um aviso preexistente de `<img>` em `media-image.tsx`; 21 testes unitários/contrato passaram. Na composição final, 31 jornadas Playwright de galeria, arredores e UX passaram, com 3 omitidas por dispositivo. Capturas de desktop e celular foram inspecionadas. Não foi feita auditoria integral WCAG ou medição de Core Web Vitals.
