# Contatos, localização e arredores

## Mapa aberto e provedores

O mapa abre automaticamente quando há coordenadas públicas. Seu contêiner fica
visível desde a primeira renderização, com altura reservada, posição relativa e
camadas contidas. ResizeObserver corrige dimensões ao mudar o layout; o SDK só é
inicializado depois de o contêiner existir. Sem coordenadas, há localização textual
em vez de mapa ou geocodificação inferida. Nenhum endereço privado é reconstruído.
O ponto do anunciante pode ser aproximado; trocar o provedor não corrige dados
incorretos na origem. A posição deve ser confirmada antes de visitar.

`NEXT_PUBLIC_MAPS_PROVIDER=openstreetmap` é o padrão e permanece ativo nesta
entrega. Leaflet 1.9.4 usa tiles oficiais HTTPS do OpenStreetMap, com atribuição,
Referer e cache normais. Sem proxy aberto, download em massa ou geolocalização do
visitante. Google Maps tem adaptador separado, carregado **somente** quando o
operador configura `google`; não há chamadas Google pagas no modo gratuito.
Falhas não trocam de provedor silenciosamente nem usam locais fictícios.

## Serviços úteis para a decisão

A visão inicial “Essenciais” faz uma consulta com padarias, farmácias, mercados
(incluindo lojas de conveniência) e pontos de ônibus. Mostra até três registros
retornados de cada categoria, ordenados por distância. Botões permitem consultar
uma categoria específica (até 12 resultados), inclusive lojas, em raio de 500 m
ou 1 km. Não é inventário completo dos arredores nem garantia de horários,
funcionamento, segurança da região ou acessibilidade.

Marcadores numerados têm cores por categoria e correspondem aos cartões com
ícone, nome, categoria e distância. Selecionar marcador/cartão destaca ambos e
liga o ponto ao imóvel. “Centralizar no imóvel” restaura a visão. Há lista textual
alternativa e links externos de rota; não se calculam trajetos ou tempos de viagem.

Distância é geodésica aproximada (Haversine), em **linha reta a partir do ponto
publicado**. Centros de vias/relações OSM não são necessariamente a entrada do
local. Uma linha entre marcadores não é uma rota a pé. Os nomes externos são
tratados como texto, incluindo tooltips e atribuições; URLs passam por whitelist
de protocolo HTTPS sem credenciais. A busca não altera filtros do catálogo nem
ativa `geoSearch`.

### Provedor gratuito

Overpass recebe uma consulta inicial automática e novas consultas por ação do
visitante, sem cookies. Endpoint padrão: `https://overpass.private.coffee/api/interpreter`.
A instância declara suporte comercial sem cadastro, sem SLA. Pode ser substituída
por uma instância HTTPS própria via `NEXT_PUBLIC_OVERPASS_API_URL` e novo build.

Uma consulta por vez; sem polling, retries ou failover automáticos. Respostas
ficam só na memória da página por categoria/raio; “Atualizar arredores” faz nova
consulta explícita. Overpass tem timeout de 15 s, navegador 20 s, cancelamento ao
sair/trocar o imóvel e descarte de respostas antigas. União de essenciais limita
a resposta a 80 elementos; categoria individual a 60; o schema aceita até 100.
Posições inválidas/fora do raio e respostas parciais são rejeitadas. A cobertura
pode ser incompleta mesmo quando a consulta retorna zero.

### Preparar e ativar Google Maps

O usuário informou que ainda não possui projeto/chave Google Cloud. A integração
está preparada e testada por contrato; **não está ativada nem validada com uma
chave real**. Para ativar, no projeto Google Cloud do operador:

1. Associar faturamento e habilitar **Maps JavaScript API** e **Places API (New)**.
2. Criar chave de navegador, restringindo aplicações por HTTP referrers a
   `https://real-ia.vercel.app/*` e ao domínio próprio, se houver. Usar chave de
   desenvolvimento separada para `http://localhost:3001/*`; não liberar wildcard
   de todos os domínios ou de todos os previews da Vercel.
3. Restringir a chave somente às duas APIs acima. Criar um Map ID JavaScript
   próprio para os marcadores avançados. Configurar quotas compatíveis com o
   tráfego e alertas de orçamento; alertas não são um bloqueio automático de gastos.
4. Na Vercel, definir para o ambiente correspondente e fazer novo deploy:

```env
NEXT_PUBLIC_MAPS_PROVIDER=google
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=CHAVE_DE_NAVEGADOR_RESTRITA
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=MAP_ID_DO_PROJETO
```

Essas duas identificações são públicas por definição no SDK de navegador. Nunca
usar chave OpenAI, credencial de serviço ou chave de servidor nessas variáveis.
A aplicação usa canal estável `quarterly`, idioma pt-BR e região BR; não usa
APIs legadas de Places, geocodificação ou rotas. A única dependência adicional é
`@types/google.maps` de desenvolvimento; o SDK não é carregado no provedor gratuito.

O adaptador usa AdvancedMarkerElement e `Place.searchNearby`, com campos
id/displayName/location/primaryType/googleMapsURI/attributions, máximo 20,
ranking por distância e os tipos confirmados de cada categoria. Carregar o mapa
pode gerar uso de Dynamic Maps; consultar arredores usa Places e pode gerar
cobrança separada. Há uma consulta inicial por página com mapa e consultas apenas
por ações posteriores, sem retries pagos automáticos. Atribuições Google/de
terceiros permanecem visíveis; resultados Google só são exibidos no mapa Google.
O SDK não permite cancelar uma consulta Places já aceita: o frontend interrompe
a espera após 20 s, ignora respostas antigas e não promete cancelar a cobrança.
O cache de consultas por categoria/raio é exclusivo do provedor OSM. Places
mantém apenas a resposta em exibição; não há cache manual entre consultas nem
armazenamento persistente. A página pública de privacidade inclui os links de
termos/políticas Google; o operador deve completar seus próprios termos e dados
de controlador antes de ativar o serviço em produção.

Não é preciso alterar o backend, migrations, CORS ou serviços de IA. Sem chave/
Map ID configurados, selecionar `google` mostra erro recuperável e link externo;
não apresenta o mapa gratuito como se fosse Google Maps.

## Contatos e endereço

A apresentação de contato existente destaca somente linhas públicas explicitamente
identificadas da descrição: `Endereço:` e telefone brasileiro associado a
`Telefone`, `Tel`, `Fone`, `Contato` ou `WhatsApp`. Telefones com DDD/formato aceito
geram links `tel:` normalizados. Não se extraem números de URLs ou de outros
metadados administrativos; a descrição continua como texto React.

O backend local atual também serializa `address`. A adaptação desse objeto ainda
não é feita por essa seção do frontend: não se deve confundir essa limitação de
apresentação com ausência do campo no backend. Esta entrega preserva o contato
existente e usa somente as coordenadas públicas para o mapa; não geocodifica o
endereço, não reconstrói localização privada e não altera regras de divulgação.

## Operação e verificação

Com o provedor gratuito, nenhuma variável nova é obrigatória. Na Vercel, manter
os ambientes existentes; o padrão já é `openstreetmap`. A implantação usa
`npm ci`, build e deploy normais. A página de privacidade descreve o carregamento
automático e os provedores. CSP futura precisa permitir tiles OSM em img-src e
Overpass em connect-src; Google exige seus hosts oficiais de scripts, mapas e
Places conforme sua documentação de CSP.

Serviços públicos não oferecem capacidade ilimitada. Para crescimento, planejar
provedor de tiles e instância Overpass adequados. Não remover créditos e não
armazenar dados de Places em banco/caches persistentes sem avaliar seus termos.

```sh
npm run lint
npm run typecheck
npm test
PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PRODUCTION=true npm run test:e2e -- tests/e2e/neighborhood.spec.ts tests/e2e/admin-previews.spec.ts tests/e2e/admin.spec.ts tests/e2e/public-gallery.spec.ts
```

Testes usam exclusivamente API de contrato, tiles sintéticos e SDK Google simulado,
sem custo Google/Places ou consulta a estabelecimentos reais. Cobrem abertura
inicial, geometria das camadas/resize, essenciais por categoria, distância, seleção,
cache, XSS, ausência de coordenadas, erro 429 e tentativa manual. A ativação real
Google depende do operador e requer uma verificação separada com quotas definidas.

Referências primárias consultadas:

- [Leaflet: invalidateSize](https://leafletjs.com/reference.html#map-invalidatesize)
- [Política dos tiles OSM](https://operations.osmfoundation.org/policies/tiles/)
- [Overpass Private.coffee](https://overpass.private.coffee/)
- [Carregar Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/load-maps-js-api)
- [Nearby Search (New)](https://developers.google.com/maps/documentation/javascript/nearby-search)
- [Tipos de Places](https://developers.google.com/maps/documentation/places/web-service/place-types)
- [Marcadores avançados](https://developers.google.com/maps/documentation/javascript/advanced-markers/html-markers)
- [Google Maps: faturamento](https://developers.google.com/maps/documentation/javascript/usage-and-billing)
- [Places: políticas e atribuição](https://developers.google.com/maps/documentation/places/web-service/policies)

Resultados desta entrega: build e TypeScript concluídos, lint sem erros (aviso
preexistente de imagem), 46 testes unitários e 42 E2E aprovados; dois casos de
mouse da galeria são ignorados no perfil mobile. Os seis casos do mapa passaram
novamente após os ajustes de zoom/destaque. Inspeção visual realizada em desktop
e mobile com tiles sintéticos, sem confundir a fixture com geografia real.

Checagem externa separada: a API pública retornou 200 e forneceu coordenadas
públicas do anúncio #2. A consulta direta de diagnóstico ao Private.coffee retornou
429; uma alternativa em overpass-api.de retornou 406. No Chrome, a partir da origem
pública da Morada, não foi possível obter resposta utilizável nessa rede. Não foi
validado retorno real de estabelecimentos. O provedor padrão foi preservado,
sem rodízio/failover automático nem tentativas em loop; a interface mostra falha
recuperável, sem declarar busca vazia ou criar dados. Disponibilidade do serviço
externo e ativação Google permanecem verificações operacionais separadas.
