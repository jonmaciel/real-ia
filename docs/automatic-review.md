# Revisão automática administrativa

A fila e o detalhe exibem `automatic_review` do backend: autoria, resultado,
motivo, pendências, confiança, data e política. `review_history` preserva as
últimas dez análises mesmo após aprovação humana. Rejeição explícita recebe
o rótulo **Rejeitado por IA**; `needs_review` permanece pendente e `error` não
é rejeição. Uma descrição ausente é opcional na política `2026-10-25-v2`.

O BFF aceita `POST /api/admin/anuncios/:id/auto-review` com strings
`source_listing_id`, `fingerprint` e `mode` (`apply` para rascunhos, `preview`
para simular sem alterar o status). O backend exige admin, verifica a versão
e limita as ações explícitas a cinco chamadas por janela diária por padrão,
compartilhadas entre admins. Isso é separado das 100 chamadas do cron. O
cliente não envia modelo, critérios, contexto factual nem credenciais.

O BFF mantém proteção de origem/cookie, timeout de 35 segundos e ausência de
retries automáticos. O cliente recarrega o detalhe após sucesso, erro ou
conflito; não presume que uma resposta perdida significa que nada foi aplicado.
Rejeitados exigem reabertura explícita e cadastros manuais mantêm revisão humana.

Publicado continua publicado após uma simulação, com a aprovação anterior
preservada. O resultado da simulação é identificado no histórico e nunca
apresentado como decisão aplicada. Contratos Zod preservam os metadados,
inclusive motivos antigos e suas políticas anteriores.
