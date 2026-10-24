# Áudio no assistente Morada

A busca em `/buscar` e a janela flutuante aceitam gravação e anexo, além do texto.
`AssistantAudio` pede permissão somente ao clicar em “Gravar áudio”, limita a
captura a 60 segundos e permite parar, ouvir, descartar e enviar explicitamente.
Sem suporte ou permissão, anexo e texto continuam disponíveis. Tracks, timers e
URLs locais são liberados ao cancelar, minimizar, trocar de contexto ou desmontar.

## Integração

- Browser → BFF: `POST /api/assistente/audio-mensagens`.
- BFF → API: `POST /assistant/audio-messages`, relativo a `LISTINGS_API_BASE_URL`.
- Base publicada: `https://solo-leveling-api.onrender.com/api/v1/listings-platform`.
- Multipart com um `audio: File`, não vazio, até 4 MiB, e `metadata` contendo
  `JSON.stringify({history, selected_listing_id, search_token, context})`.
- Metadata estrita: histórico limitado já existente e contexto apenas
  `page/current_filters`; sem `question`, modelo, instruções ou fatos do imóvel.
- Formatos: WebM, MP4/M4A, MP3 e WAV. A checagem de nome/MIME no frontend é
  preliminar; o backend valida o conteúdo real. Metadata até 64 KiB; corpo
  completo até 4 MiB + 128 KiB.
- Resposta normal validada por Zod, acrescida de `input_type: audio` e
  `transcription.text/model`. A transcrição aparece na interface e entra no
  histórico. Ela **não é reenviada** ao endpoint de texto.

`AssistantProvider` aplica a resposta pelo mesmo fluxo do texto: seleção, token,
histórico, filtros, pills, resultados e citações. O rascunho digitado é preservado.
Na busca, atualiza a única lista principal depois da resposta válida. Nas outras
páginas, links/cartões mantêm a navegação dependente da ação do visitante.

## Bytes, assinatura e sessão de requisição

O BFF lê o corpo com limite de bytes, valida uma cópia e encaminha o `Uint8Array`
original junto com o `Content-Type` original, incluindo o boundary. Não recria
FormData, não converte binário em UTF-8 e não troca o Content-Type após assinar.
O protocolo HMAC existente é preservado: cinco linhas com POST, caminho completo
novo do backend, timestamp, IP canônico e SHA256 dos bytes originais. O contrato
atual do backend não acrescenta Content-Type como uma sexta linha de assinatura.

Reutiliza `LISTINGS_BFF_SHARED_SECRET` somente no servidor e o IP sobrescrito
pela Vercel, sem confiar em headers Morada ou IP arbitrários do navegador.
Origem exata `APP_URL`, no-store, sem logs de áudio, transcrição ou metadata.
Não há nova variável pública nem chave de provedor no frontend.

O navegador e o BFF têm deadline de 95 segundos. A rota exporta `maxDuration=100`
para permitir o retorno do erro: a hospedagem precisa aceitar essa duração e o
corpo de até 4 MiB + overhead multipart. Nenhuma tentativa automática, duplicação
ou chamada ao abrir a interface. Cancelamento descarta respostas antigas e não
promete interromper processamento/cobrança no servidor. Limites e orçamento
continuam no backend. `Retry-After` é preservado, com espera na interface.

`Permissions-Policy` permite `microphone=(self)`; câmera e geolocalização continuam
bloqueadas. Gravação exige HTTPS em produção e permissão do visitante. Áudio é
oferecido por `flags.voiceSearch`; não depende de endpoints futuros.

## Erros e verificação

400/403/404/413/415/422/429/502/503/504 têm mensagens seguras. Áudio ininteligível ou
transcrição longa não são truncados nem reenviados. Falhas preservam o arquivo
local para nova tentativa manual ou descarte; catálogo, texto e navegação continuam.

```sh
npm run lint
npm run typecheck
npm test
PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PRODUCTION=true npm run test:e2e -- tests/e2e/audio.spec.ts tests/e2e/search-assistant.spec.ts tests/e2e/questions.spec.ts tests/e2e/assistant.spec.ts tests/e2e/chat-window.spec.ts
```

Testes locais usam exclusivamente o servidor de contrato e áudio sintético.
Cobrem bytes multipart/Content-Type, HMAC binário, transcrição sem segundo POST,
seleção e contexto, filtros e lista única, gravação/60 s/liberação de tracks,
permissão recusada/tardia, cancelamento, deadline de 95 s, erros e Retry-After.
Desktop e mobile em Chromium; não constituem validação de hardware ou Safari.

Resultado local em 23/10/2026: build de produção e TypeScript concluídos;
41 testes unitários e 60 E2E aprovados. Lint sem erros, com o aviso preexistente
de `<img>` em `src/components/media-image.tsx`.

Em 23/10/2026, uma requisição inválida sem áudio ao endpoint publicado retornou
400 `invalid_request`, confirmando a presença da rota sem transcrição paga.
Não foi executada transcrição real em produção nem alterado o backend. O sucesso
com o provedor e a chave de produção permanece uma validação operacional separada.
