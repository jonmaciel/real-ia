# Identidade e compartilhamento

Metadados públicos usam `APP_URL` como origem canônica. Sem configuração, a origem é `https://real-ia.vercel.app`; nunca é derivada do Host recebido. A busca tem seus próprios título e descrição, mantendo `noindex`; autenticação, conta, cadastro e admin continuam privados e sem indexação.

A identidade usa a mesma casa e a cor `#c4470a` do cabeçalho. Inclui favicon ICO 16/32/48, SVG, Apple Touch Icon 180 e ícones 192/512 no manifest (inclusive maskable). O manifest oferece identidade ao salvar na tela inicial; não há promessa de funcionamento offline.

O Open Graph da marca é PNG 1200×630, com uma ilustração vetorial de arquitetura. Cada imóvel público tem sua própria imagem no segmento `/imovel/:id/:slug/opengraph-image`: foto de capa, localização, características existentes, preço anunciado e identidade Morada. WhatsApp/Facebook/LinkedIn usam Open Graph; X recebe `summary_large_image`. Os bots compatíveis recebem as tags no `<head>` pelo comportamento nativo do Next.js.

Preços usam o valor anunciado e a periodicidade informada, sem somar taxas ou aplicar descontos novamente. Uma descrição ausente recebe resumo a partir dos fatos públicos. Contatos e textos livres da descrição não são copiados para a prévia. Preço desconhecido ou sob consulta fica explícito. URLs usam o ID estável e o slug canônico; o compartilhamento nativo inclui título e resumo e remove campanha/âncora da URL do imóvel.

Somente a capa do endpoint público pode ser baixada para a imagem. HTTPS, hosts autorizados (`ik.imagekit.io` e `MEDIA_ALLOWED_HOSTS`), sem credenciais, IP literal, portas alternativas ou redirects. Timeout de 5 segundos, corpo de até 5 MB e decodificação de até 25 milhões de pixels. JPEG/PNG/WebP são normalizados; conteúdo inválido usa a ilustração identificada como foto indisponível. Falhas da API usam a imagem da marca; anúncio não publicado/inexistente não recebe uma prévia com seus dados.

As imagens de imóveis revalidam em 60 segundos. Redes sociais mantêm caches próprios: uma conversa antiga pode conservar a prévia anterior até que o aplicativo a atualize. As verificações cobrem metadados no head para agentes sociais, imagem real e fallback, download limitado, ícones, compartilhamento nativo e preservação de noindex.

Gere novamente os ícones após alterar a marca com `npm run icons:generate`. O ícone maskable mantém a casa na área segura central. A busca pode ser lida pelos crawlers para compartilhar a prévia e interpretar `noindex`; não é bloqueada por `robots.txt`. Referência: [Google Search Central](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
