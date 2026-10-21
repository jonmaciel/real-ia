# Morada — portal de descoberta

## Referência solicitada

[Imovelweb — homepage](https://www.imovelweb.com.br/) e [busca em Curitiba](https://www.imovelweb.com.br/apartamentos-venda-curitiba-pr.html), consultados em 21/10/2026 no navegador e pela documentação pública das páginas. Foram observados busca na abertura com abas de modalidade, fundo fotográfico, interface sem serifa, superfícies brancas e hierarquia de anúncios com preço, características e localização.

O Morada adota esses princípios de navegação de portal, sem copiar marca, anúncios, fotografias, estatísticas ou recursos do Imovelweb. Não foram adicionados favoritos, alertas, mapas de catálogo, filtros por cômodos ou serviços de corretagem não disponíveis na API.

## Mudanças

- A abertura fotográfica agora reúne título, texto e formulário. A ilustração isométrica, os índices editoriais e a tipografia Georgia foram removidos.
- Manrope e DM Sans locais, fundo branco, cinzas neutros, ações em laranja, raios de 8–16 px e sombras discretas.
- Cards com preço primeiro, endereço resumido, atributos conhecidos, disponibilidade e link Ver imóvel. Na página de busca, os cards são horizontais no desktop e verticais no celular.
- Compra/aluguel têm atalhos próprios. A seção de cidades usa apenas cidades da seleção retornada; não afirma popularidade nem cobertura de todo o catálogo.
- Detalhe, conta, formulários, galeria e rodapé seguem a linguagem atual. Foco, movimento reduzido, retorno da galeria e estados ausentes foram preservados.
- `src/app/portal.css` substitui `editorial.css`; estilos do mapa estão em `neighborhood.css`. A infraestrutura e os contratos continuam iguais.

## Imagem de ambientação

Arquivo de produção: `public/images/morada-home.webp` (1672 × 940, 370176 bytes). Usado apenas na abertura, com legenda explícita de ambientação gerada por IA, nunca em um anúncio ou como placeholder de um imóvel real. Imagens ausentes dos anúncios continuam com placeholder neutro.

Gerado com a ferramenta integrada `image_gen` pela skill imagegen, sem chamada de IA pelo navegador e sem chave de API da aplicação. O PNG original foi convertido em WebP com Sharp para entrega local via Next Image, com prioridade e dimensões reservadas. O original permanece em `$CODEX_HOME/generated_images`; a aplicação referencia somente o arquivo do próprio repositório.

Prompt utilizado:

> Use case: photorealistic-natural. Asset type: wide marketing hero background for Morada, a modern Brazilian property discovery website. Generate a refined contemporary Brazilian apartment living room with indoor-outdoor connection: soft white sofa, light oak wood cabinetry, limestone, indoor tropical plants, large black-framed windows opening onto a leafy garden. Bright natural daylight, realistic editorial interior photograph, inviting and modern rather than formal or antique. Wide panoramic composition, no people, no text, no logo, no watermark. This is conceptual marketing imagery, not a real listing. Main architectural and furniture interest toward the right half, calmer darker greenery toward the left and upper center suitable for a white headline overlay. High quality photographic realism, wide 16:9 framing.

## Mapa e contatos

Este pacote também inclui as alterações locais anteriores de Leaflet/OpenStreetMap, arredores Overpass e destaque de contatos explicitamente publicados. Consulte [maps-and-contact.md](maps-and-contact.md). Não exige Google Cloud nem chave de mapas. A disponibilidade dos serviços gratuitos é externa à aplicação; o timeout observado na consulta real está registrado nessa documentação.

## Verificação final

Em 21/10/2026, build de produção, TypeScript e 19 testes unitários/contrato passaram. Lint: zero erros, um aviso preexistente de imagem em `media-image.tsx`. Regressão completa: 61 jornadas aprovadas, 3 omitidas por dispositivo. Após o ajuste final do resumo de benefícios no celular e das superfícies do mapa, novo build e reexecução de UX/arredores: 15 aprovadas, 1 omitida.

Capturas de homepage em 390, 1440 e 2560 px, resultados em 390/1440 px e detalhe foram inspecionadas. Os testes verificam largura integral do rodapé, ausência de overflow, fonte sem Georgia, identificação da ambientação e disposição horizontal/vertical dos cards. Fixtures e imagens sintéticas de testes não são dados de produção. Não foi feita auditoria integral de acessibilidade ou medição de Core Web Vitals.
