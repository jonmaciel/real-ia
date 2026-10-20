# Galeria de imóveis · decisão de UX

## Referências pesquisadas

- [Airbnb — photo tour](https://www.airbnb.com/help/article/477): explorar o imóvel além da capa. O Morada adota visão geral → álbum → ampliação, sem usar a classificação automática de cômodos do Airbnb, pois esses dados não existem no contrato atual.
- [W3C — Carousels](https://www.w3.org/WAI/tutorials/carousels/) e [ARIA carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/): controle do usuário, teclado, foco e comunicação do slide atual. Nenhuma rotação automática.
- [Embla v8 — opções](https://www.embla-carousel.com/docs/v8/api/options): carrossel sem aparência imposta, com arrastar, controles personalizados e breakpoints. A versão estável verificada no registro foi 8.6.0; a versão 9 ainda estava em RC.
- [Swiper React](https://swiperjs.com/react): alternativa com amplo conjunto de módulos. Para este fluxo, preferimos a liberdade visual do Embla em vez de adotar seu conjunto de componentes e estilos. Não foi feito benchmark de tamanho ou desempenho entre bibliotecas.
- [PhotoSwipe](https://photoswipe.com/getting-started/): alternativa adequada para ampliação e gestos, avaliada junto com [Yet Another React Lightbox](https://yet-another-react-lightbox.com/documentation). Escolhemos YARL 3.32.2 pela integração React, dimensões opcionais e composição de plugins de zoom, legendas, contador e fullscreen. [Zoom: gestos e atalhos](https://yet-another-react-lightbox.com/plugins/zoom).

“Melhor” aqui significa adequada ao fluxo e à arquitetura do Morada; não uma classificação universal de bibliotecas.

## Experiência implementada

1. **Detalhe:** uma imagem grande por vez, capa primeiro, proporções preservadas, contador, setas e até sete miniaturas. A ação Ver todas abre o conjunto completo sem criar uma coluna de fotografias na página principal. Arrastar não deve disparar o clique de ampliação. As setas do teclado, Home e End funcionam no carrossel.
2. **Álbum:** diálogo que ocupa a janela, mosaico editorial responsivo inspirado na navegação por grade de álbuns. A primeira foto recebe destaque e as demais permanecem facilmente alcançáveis. Quando existem plantas, aparecem os filtros Todas/Fotos/Plantas, derivados exclusivamente do kind da mídia. Não são inventados cômodos ou legendas descritivas. O filtro é preservado ao retornar da ampliação.
3. **Ampliação:** clique direto na foto ou em um item do álbum abre um visualizador sobre toda a janela, com imagem inteira, zoom, navegação e créditos. O plugin oferece tela cheia do navegador por ação explícita, quando suportada. Escape fecha; Tab permanece nos controles. Ao sair, a foto selecionada e o contexto de origem são preservados; o foco retorna ao controle correspondente.

O diferencial é a continuidade entre as três vistas e a transparência: a foto ampliada mantém atribuição, capa e ordem; plantas são identificadas como plantas; imagens não disponíveis recebem fallback. Não há alegação de tour 360°, IA ou classificação de ambientes.

## Implementação e limites

- `src/lib/gallery.ts`: adaptação de mídia, validação de HTTPS sem credenciais, whitelist de hosts, capa/position e separação de anexos. Sem deduplicação por semelhança e sem alteração de URLs assinadas.
- `PropertyGallery`: carrossel Embla, estado da imagem atual e entrada para álbum/ampliação.
- `PhotoAlbum`: diálogo nativo, grade e filtros. Montado somente quando solicitado.
- `GalleryLightbox`: YARL e plugins carregados dinamicamente no primeiro uso, sem fazer a página pública inteira virar Client Component.
- `GalleryImage`: dimensões reservadas, primeira foto eager e demais lazy, política no-referrer e fallback que cobre falhas anteriores à hidratação.
- O endpoint `/listings/:id/media` continua sendo consultado no servidor. Não foi criado endpoint nem chamada por card. A galeria administrativa existente não foi substituída.
- Vídeos, documentos e imagens de hosts não autorizados permanecem como links HTTPS na origem; não viram iframe ou mídia incorporada automaticamente. O host ImageKit já autorizado foi preservado, além dos hosts explícitos de MEDIA_ALLOWED_HOSTS.
- A contagem usa apenas as imagens autorizadas e incorporáveis retornadas pela API, incluindo plantas. Não representa total de fontes ou fotos que possam existir fora da API.
- As miniaturas reutilizam a URL autorizada, com cache do navegador. Não há serviço de otimização aberto nem geração de variantes não confirmadas pelo backend.
- O carrossel respeita movimento reduzido; YARL também possui suporte próprio a essa preferência. Os testes de teclado não equivalem a uma auditoria completa com tecnologias assistivas.

## Validação

Os testes de contrato e Playwright usam mídias sintéticas apenas em `tests/mock-api.ts` e interceptações do navegador. Nenhuma fotografia fictícia foi adicionada à aplicação ou à API real.

Cobertura nova: ordenação por capa e posição, URLs inseguras/hosts bloqueados, plantas, carrossel/miniaturas/contador, álbum e retorno, ampliação/zoom, teclado/foco, arrastar, imagem única quebrada e ausência de mídia. As jornadas são executadas em desktop e viewport móvel.

Resultados finais em 20/10/2026: **15 testes unitários/contrato e 42 jornadas Playwright passaram**, executados com build e servidor de produção. Incluem dez cenários novos da galeria, distribuídos entre desktop e celular. O gesto móvel usa eventos de toque reais do Chromium; o desktop usa arrastar com mouse. TypeScript passou e lint terminou sem erros, com um aviso já existente de `<img>` em `media-image.tsx`. As capturas do álbum e visualizador foram inspecionadas em ambas as larguras. Não foram medidas métricas de Core Web Vitals nem feita auditoria completa WCAG. As alterações permanecem locais até commit/push.

## Refinamento de gestos — 20/10/2026

O carrossel aceita rolagem horizontal de Magic Mouse/trackpad: acumula intenção (40 px), normaliza unidades e permite uma troca por gesto, aguardando 200 ms sem eventos antes de aceitar o próximo. A rolagem vertical da página e Ctrl+wheel (pinça do navegador) permanecem livres. O listener não passivo é restrito ao viewport e removido ao desmontar.

No visualizador, rolagem vertical controla zoom; rolagem horizontal navega quando a imagem está sem zoom. Quando ampliada, o arraste explora a imagem. Pinça, duplo clique, botões de zoom, teclado e tela cheia nativa continuam disponíveis pela biblioteca. A imagem ocupa a janela ao clicar no carrossel; fullscreen nativo é uma ação explícita por compatibilidade entre navegadores.

Verificação desta revisão: build, TypeScript e lint passaram (um aviso preexistente de `<img>`); 15 testes unitários passaram. Playwright: 12 jornadas da galeria passaram, com dois cenários de mouse omitidos no projeto móvel; duas jornadas adicionais confirmaram duplo clique no desktop e pinça com dois pontos de toque no Chromium móvel. A navegação horizontal foi exercitada com eventos de wheel e inércia simulada, sem teste físico de Magic Mouse ou Safari/iOS.
