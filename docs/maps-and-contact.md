# Contatos, localização e arredores

## Integração gratuita

Leaflet 1.9.4 (BSD-2-Clause) é carregado dinamicamente após ação do visitante. O mapa usa os tiles de `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, diretamente pelo navegador, com atribuição visível, Referer normal e cache HTTP do navegador. Sem proxy, prefetch, download em massa, geolocalização do usuário ou Google Maps Platform. Não precisa de cartão, conta Google ou API key.

O mapa não recebe o endereço particular nem tenta reconstruí-lo. Usa exclusivamente latitude/longitude publicadas pela API do Morada; valores ausentes, vazios ou fora dos limites não viram zero. Ponto aproximado é identificado como tal. Sem coordenadas, mostramos a localização textual e orientação para consultar o anunciante, sem geocodificar bairro ou endereço.

Os links externos de localização e rota a pé abrem o site Google Maps por ação explícita. Eles não são chamadas a APIs pagas e não calculamos tempo de caminhada.

## Arredores no mesmo mapa

O navegador consulta Overpass via POST, sem cookies, apenas quando o visitante solicita. Endpoint padrão: `https://overpass.private.coffee/api/interpreter`. O operador declara suporte a projetos comerciais sem cadastro. Variável opcional `NEXT_PUBLIC_OVERPASS_API_URL` permite selecionar uma instância HTTPS própria/compatível; como qualquer variável pública do Next.js, requer novo build para alterar no Vercel.

- Categorias fixas: padarias, lojas, pontos de ônibus (`highway=bus_stop`), supermercados e farmácias.
- Raios fixos de 500 m e 1 km, timeout Overpass de 15 s e cancelamento do navegador em 20 s.
- Uma consulta em andamento por componente, intervalo mínimo de 5 s entre consultas não armazenadas e cache apenas na memória da página por categoria/raio. Sem polling, retry automático ou failover automático entre provedores.
- A consulta retorna no máximo 60 elementos OSM. O frontend valida a resposta, descarta posições inválidas/fora do raio, ordena os retornados por distância e mostra até 12. Não afirma que representam todos os locais ou os 12 mais próximos de todo o catálogo.
- Nós usam sua posição; vias/relações usam o centro retornado. O centro pode não coincidir com a entrada do estabelecimento. Cadastros podem estar ausentes ou desatualizados.
- Distância geodésica aproximada (Haversine), sempre indicada como **linha reta a partir do ponto publicado**. A linha desenhada ao selecionar um marcador não é uma rota nem representa ruas transitáveis.
- Lista acessível alternativa, seleção por marcador/lista, nomes tratados como texto (inclusive no tooltip), links por identificadores OSM validados e créditos ODbL.
- A busca de arredores não altera os filtros de anúncios e não habilita `geoSearch` (busca geográfica do catálogo).

## Contatos e endereço

Foi consultado o serializador público local do backend em `app/controllers/listings_platform/catalog_controller.rb` e a documentação de publicação. Não existem campos públicos próprios de telefone ou endereço completo; coordenadas só saem com `location_public`. A implementação não presume campos novos nem usa metadados administrativos ou dados privados.

Destacamos somente informações já publicadas em linhas explicitamente identificadas da descrição: `Endereço:` e telefone brasileiro associado a `Telefone`, `Tel`, `Fone`, `Contato` ou `WhatsApp`. Telefones com DDD e formato aceito geram links `tel:` normalizados; não são inferidos números de outros trechos, URLs WhatsApp ou contatos de sites terceiros. O texto e sua proveniência são mantidos como informação não verificada do anúncio. Descrições continuam como texto React, sem HTML externo.

Endereços em outros formatos continuam visíveis na descrição, sem extração automática. Para cobertura completa, o backend precisa de campos públicos explícitos e autorizados para contato/endereço, com proveniência e regras de divulgação. Não foram alterados backend ou regras de privacidade.

## Operação e dependências

Não há novas variáveis obrigatórias. Implantação: `npm ci`, variáveis existentes, build e deploy normais. O CSS do Leaflet é local, e seus scripts estão no bundle; só tiles/dados saem a terceiros após as ações correspondentes. A página de privacidade descreve os serviços envolvidos. Uma CSP adicionada futuramente deve permitir tiles em `img-src` e o endpoint selecionado em `connect-src`.

Serviços públicos não oferecem SLA. Para crescimento, planeje provedor de tiles adequado e instância Overpass própria ou serviço contratado, preserve créditos e monitore uso. Sem custo de API configurado não significa disponibilidade ou capacidade ilimitadas. Não se deve trocar silenciosamente para dados fictícios diante de falha.

Referências primárias:

- [Leaflet: versão estável](https://leafletjs.com/download.html)
- [Política dos tiles OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/)
- [Overpass Private.coffee: termos e privacidade](https://overpass.private.coffee/)
- [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL)
- [Acesso e capacidade das instâncias públicas](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)

## Verificação

Testes de contrato cobrem coordenadas ausentes/inválidas, contato identificado, telefone seguro, distância, whitelists de categoria/raio e payload parcial. Playwright intercepta tiles e Overpass; só a fixture do anúncio 4 contém coordenadas e telefone/endereço sintéticos. Produção não importa esses dados.

Uma checagem real separada, com consulta mínima em um ponto público de Curitiba, recebeu HTTP 406 em `overpass-api.de`; a instância Private.coffee teve timeout de 25 s neste ambiente. Não há afirmação de sucesso da consulta real ou de disponibilidade em produção. Falhas do provedor são recuperáveis na interface. Não foram feitos polling nem novas tentativas automáticas contra esses serviços.

Resultados em 21/10/2026: TypeScript e build passaram; lint terminou sem erros, com um aviso preexistente em `media-image.tsx`; 19 testes unitários/contrato passaram. A regressão completa teve 58 jornadas aprovadas, 3 omitidas por dispositivo e uma falha intermitente de histórico na paginação móvel (retorno a `about:blank`). Sem alterar essa jornada, a reexecução de `journeys.spec.ts` e `neighborhood.spec.ts` passou integralmente: 20 testes, incluindo navegação voltar/avançar e os seis casos de mapa/contato em desktop e móvel. Capturas com tiles e dados sintéticos de teste foram inspecionadas; não são evidência de resposta do provedor real.
