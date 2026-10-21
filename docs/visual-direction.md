# Morada — Atlas de possibilidades (histórico)

Esta direção foi substituída a pedido do usuário pela linguagem de portal descrita em [portal-design.md](portal-design.md). O SVG e a camada editorial anterior saíram da aplicação.

## Referências consultadas em 21/10/2026

- [The Modern House](https://themodernhouse.com/): relação editorial entre morar, arquitetura e descoberta. Inspirou títulos de leitura expressiva e maior espaço para os anúncios.
- [Aucoot](https://aucoot.com/): identidade ligada a casas com personalidade e apresentação de arquitetura. Inspirou uma direção menos padronizada de portal, com ritmo de publicação.
- [Airbnb Design](https://www.airbnb.com/stays/design): descoberta visual de lugares. O Morada mantém a busca convencional confirmada pela API, sem adotar avaliações, categorias temáticas ou recomendações que não possui.

As referências são ponto de partida; não foram copiados layouts, imagens ou marcas. As decisões visuais abaixo são uma interpretação para o Morada.

## Expressão do produto

Conceito: diferentes caminhos e anúncios convergem para uma decisão de moradia. A abertura usa um desenho isométrico original em SVG, linhas de ligação e uma casa central. O desenho é identificado como conceitual, não representa anúncio, planta real, endereço ou ferramenta de busca geográfica.

Papel quente, verde profundo e terracota, com títulos serifados e UI em DM Sans, estabelecem uma linguagem editorial. Linhas, índices de seção, superfícies abertas e raios discretos substituem o excesso de cartões arredondados. A cor terracota indica as ações principais. Nenhuma dependência ou fonte remota foi adicionada; Georgia é uma fonte de sistema com fallback serif.

A homepage passa por ponto de partida → imóveis recentes → compra/aluguel → origem da informação. O visual deve expressar descoberta com procedência, sem sugerir curadoria automatizada, IA, deduplicação ou totais de catálogo.

## Implementação

- `src/app/editorial.css`: camada visual sobre os estilos funcionais existentes, organizada por componente e responsividade. Inclui shell, home, cards, resultados, detalhe, autenticação e galeria. Regras de movimento reduzido preservadas.
- `DiscoveryAtlas`: Server Component com SVG original, texto alternativo e legenda explícita.
- Homepage: nova composição, seção própria de busca e índice editorial.
- Galeria: removido somente o indicador visual “Ampliar”. A fotografia continua sendo botão acessível, com clique para abrir a imagem e atalhos de teclado, zoom, arraste e pinça preservados.
- As buscas e os contratos da API permanecem iguais. Fotografias e atributos não foram inventados. Mídias sintéticas só existem no servidor de testes.

## Verificação

Capturas da homepage em 390, 1440 e 2560 px e detalhe foram inspecionadas. Os testes verificam ausência de overflow horizontal, formulário disponível e rodapé com largura integral. A inspeção levou a ajustes nos placeholders e nos índices dos passos.

A regressão com build de produção passou: 53 jornadas Playwright, 3 cenários omitidos por dispositivo; 15 testes unitários/contrato, TypeScript e lint sem erros (um aviso preexistente de imagem em `media-image.tsx`). Após os refinamentos finais de CSS e a asserção da ausência do indicador de ampliação, a reexecução de UX/galeria passou: 21 jornadas, 3 omitidas por dispositivo, com novo build de produção. Não foi feita auditoria completa WCAG ou medição de Core Web Vitals; as referências não constituem garantia de acessibilidade.
