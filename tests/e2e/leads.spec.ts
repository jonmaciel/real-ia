import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";
import { localDateInput } from "../../src/lib/lead-presentation";
type Seed = { first: string; removed: string; scheduled: string };
let seed: Seed;
test.beforeEach(async ({ request }) => { seed = (await (await request.post("http://127.0.0.1:4010/__leads-reset")).json()).data; });
async function login(page: Page, admin = true) {
  await page.goto("/auth/login"); await page.getByLabel("E-mail", { exact: true }).fill(admin ? "admin@example.com" : "ana@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("uma-senha-muito-segura"); await page.getByRole("button", { name: "Entrar", exact: true }).click(); await expect(page).toHaveURL("/conta");
}
async function publicReview(page: Page, message = "Gostaria de saber mais") {
  await page.goto("/imovel/2/um-novo-capitulo-no-agua-verde"); await page.getByRole("button", { name: "Tenho interesse", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill("Pessoa privada"); await dialog.getByLabel("E-mail", { exact: true }).fill("pessoa@example.test");
  await dialog.getByLabel("Mensagem (opcional)").fill(message); await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Revisar solicitação" }).click(); return dialog;
}
async function act(page: Page, kind: string, fill?: () => Promise<void>) {
  await page.getByLabel("Ação", { exact: true }).selectOption(kind); if (fill) await fill();
  await page.getByRole("button", { name: "Revisar ação", exact: true }).click(); await page.getByRole("button", { name: "Confirmar registro", exact: true }).click();
  await expect(page.getByRole("button", { name: "Revisar ação", exact: true })).toBeVisible();
}
const origin = { Origin: "http://localhost:3001" };
const capture = () => ({ name: "Contato privado", email: "private@example.test", preferred_contact: "email", consent: true, idempotency_key: randomUUID(), entry_point: "listing" });
async function write(request: APIRequestContext, id: string, body: unknown) { return request.post(`/api/admin/interessados/${id}/events`, { headers: origin, data: body }); }

test("filtro de período preserva instante, segundos e fuso ao alterar outro critério", async ({ page }) => {
  await login(page);
  const from = "2026-01-01T12:34:56.123Z", to = "2026-11-01T15:40:22.456-03:00";
  await page.goto(`/admin/interessados?${new URLSearchParams({ created_from: from, created_to: to })}`);
  await page.getByLabel("Responsável", { exact: true }).selectOption("unassigned"); await page.getByRole("button", { name: "Filtrar interessados" }).click();
  await expect(page).toHaveURL(/assigned_to_id=unassigned/);
  expect(new URL(page.url()).searchParams.get("created_from")).toBe(from); expect(new URL(page.url()).searchParams.get("created_to")).toBe(to);
});

test("leitura atrasada não sobrescreve a versão mais recente após registrar uma ação", async ({ page }) => {
  await login(page); await page.goto(`/admin/interessados/${seed.first}`);
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let fetched = false;
  await page.route(`**/api/admin/interessados/${seed.first}`, async route => { const old = await route.fetch(); fetched = true; await gate; await route.fulfill({ response: old }); });
  try {
    await page.getByRole("button", { name: "Atualizar detalhe", exact: true }).click(); await expect.poll(() => fetched).toBe(true);
    await act(page, "contacted"); await expect(page.locator(".section-heading .lead-stage").first()).toHaveText("Contato realizado");
    const finished = page.waitForResponse(response => response.url().endsWith("/api/admin/interessados/assignees")); release(); await finished;
    await expect(page.locator(".section-heading .lead-stage").first()).toHaveText("Contato realizado");
    expect((await (await page.request.get(`/api/admin/interessados/${seed.first}`)).json()).data.version).toBeGreaterThan(55);
  } finally { release(); }
});

test("captação é explícita, sem login, com consentimento, revisão e foco contido", async ({ page }, info) => {
  const calls: string[] = []; page.on("request", req => { if (req.url().includes("/interesses")) calls.push(req.postData() ?? ""); });
  await page.goto("/imovel/2/um-novo-capitulo-no-agua-verde"); expect(calls).toHaveLength(0);
  const trigger = page.getByRole("button", { name: "Tenho interesse", exact: true }); await trigger.click();
  const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible(); await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await dialog.getByRole("button", { name: "Fechar formulário de interesse" }).focus(); await page.keyboard.press("Shift+Tab"); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await dialog.screenshot({ path: info.outputPath("interest-form.png") });
  await expect(dialog.getByLabel("Canal preferido").getByRole("option", { name: "WhatsApp", exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Revisar solicitação" }).click(); await expect(dialog.locator("[aria-invalid=true]").first()).toBeFocused(); expect(calls).toHaveLength(0);
  await dialog.getByLabel("Nome", { exact: true }).fill("Pessoa privada"); await dialog.getByLabel("Telefone", { exact: true }).fill("(41) 99999-0100");
  await dialog.getByLabel("Canal preferido").selectOption("whatsapp"); await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Revisar solicitação" }).click(); expect(calls).toHaveLength(0);
  await dialog.getByRole("button", { name: "Confirmar interesse" }).click(); await expect(dialog.getByRole("heading", { name: "Interesse registrado", exact: true })).toBeVisible();
  const payload = JSON.parse(calls[0]); expect(payload.phone).toBe("(41) 99999-0100"); expect(payload.preferred_contact).toBe("whatsapp"); expect(payload.idempotency_key).toMatch(/^[a-f0-9-]{36}$/);
  expect(Object.keys(payload).sort()).toEqual(["name", "phone", "preferred_contact", "consent", "idempotency_key", "entry_point"].sort());
  await expect(dialog).toContainText("não significa mensagem entregue"); await dialog.getByRole("button", { name: "Concluir" }).click(); await expect(trigger).toBeFocused();
  await trigger.click(); await page.keyboard.press("Escape"); await expect(trigger).toBeFocused(); expect(calls).toHaveLength(1);
  expect(await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]))).not.toContain("Pessoa privada");
});

test("falha após criação repete bytes e chave, sem registro duplicado nem duplo envio", async ({ page, request }) => {
  const calls: string[] = []; let count = 0;
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/imoveis/2/interesses", async route => {
    calls.push(route.request().postData()!); const response = await route.fetch(); count++;
    if (count === 1) { await gate; return route.abort("failed"); } await route.fulfill({ response });
  });
  const dialog = await publicReview(page); await dialog.getByRole("button", { name: "Confirmar interesse" }).click();
  await expect(dialog.getByRole("button", { name: "Registrando…", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Registrando…", exact: true }).dispatchEvent("click"); expect(calls).toHaveLength(1); release();
  await expect(dialog.getByRole("alert")).toContainText("Não foi possível confirmar"); expect(calls).toHaveLength(1);
  await dialog.getByRole("button", { name: "Tentar o mesmo envio novamente" }).click(); await expect(dialog.getByRole("heading", { name: "Interesse registrado", exact: true })).toBeVisible();
  expect(calls).toHaveLength(2); expect(calls[0]).toBe(calls[1]);
  const obs = await (await request.get("http://127.0.0.1:4010/__leads-observation")).json(); expect(obs.sha256).toBe(createHash("sha256").update(calls[0]).digest("hex")); expect(obs.moradaIp).toBeNull();
  await login(page); const result = await (await page.request.get("/api/admin/interessados")).json(); expect(result.meta.total_count).toBe(4);
});

test("conflito exige nova solicitação deliberada; 429 mantém formulário e aguarda Retry-After", async ({ page }) => {
  let key = ""; let calls = 0;
  await page.route("**/api/imoveis/2/interesses", async route => {
    calls++; const body = route.request().postDataJSON();
    if (calls === 1) { key = body.idempotency_key; return route.fulfill({ status: 409, json: { error: { code: "idempotency_conflict" } } }); }
    expect(body.idempotency_key).not.toBe(key); await route.continue();
  });
  const dialog = await publicReview(page); await dialog.getByRole("button", { name: "Confirmar interesse" }).click();
  await expect(dialog.getByRole("alert")).toContainText("outros dados"); await expect(dialog.getByRole("button", { name: "Confirmar interesse" })).toHaveCount(0); expect(calls).toBe(1);
  await dialog.getByRole("button", { name: "Revisar nova solicitação", exact: true }).click(); await expect(dialog.getByLabel("Nome", { exact: true })).toHaveValue("Pessoa privada");
  await dialog.getByLabel("Mensagem (opcional)").fill("Limite"); await dialog.getByRole("button", { name: "Revisar solicitação" }).click(); await dialog.getByRole("button", { name: "Confirmar interesse" }).click();
  await expect(dialog.getByRole("button", { name: "Tentar o mesmo envio novamente" })).toBeDisabled(); await expect(dialog.getByRole("status")).toContainText("Tente novamente em"); expect(calls).toBe(2);
});

test("BFF valida contatos, consentimento, origem, campos e origem pertencente ao imóvel", async ({ request }) => {
  for (const extra of [{ consent: false }, { email: "invalid" }, { status: "won" }, { history: [] }, { source_listing_id: "0" }]) expect((await request.post("/api/imoveis/2/interesses", { headers: origin, data: { ...capture(), ...extra } })).status()).toBe(400);
  expect((await request.post("/api/imoveis/2/interesses", { headers: { Origin: "https://evil.example" }, data: capture() })).status()).toBe(403);
  expect((await request.post("/api/imoveis/2/interesses", { headers: { ...origin, "X-Morada-Client-IP": "8.8.8.8", "X-Morada-Signature": "spoof" }, data: { ...capture(), source_listing_id: "999" } })).status()).toBe(404);
  const unavailable = await request.post("/api/imoveis/6/interesses", { headers: origin, data: capture() }); expect(unavailable.status()).toBe(422); expect((await unavailable.json()).error.code).toBe("listing_unavailable");
  expect((await request.post("/api/imoveis/999999/interesses", { headers: origin, data: capture() })).status()).toBe(404);
  const body = capture(); const first = await request.post("/api/imoveis/2/interesses", { headers: origin, data: body }); expect(first.status()).toBe(201); expect(Object.keys((await first.json()).data)).toEqual(["id", "status", "submitted_at"]);
  const replay = await request.post("/api/imoveis/2/interesses", { headers: origin, data: body }); expect(replay.status()).toBe(200); expect((await replay.json()).meta.replayed).toBe(true);
  expect((await request.post("/api/imoveis/2/interesses", { headers: origin, data: { ...body, name: "Outro" } })).status()).toBe(409);
});

test("anônimo e membro não leem contatos, eventos ou métricas; admin tem acesso privado", async ({ page, request }) => {
  const urls = ["/api/admin/interessados", "/api/admin/interessados/summary", "/api/admin/interessados/assignees", `/api/admin/interessados/${seed.first}`, `/api/admin/interessados/${seed.first}/events`];
  for (const url of urls) { const response = await request.get(url); expect(response.status()).toBe(401); expect(await response.text()).not.toContain("private@example.test"); }
  await login(page, false); await expect(page.getByRole("link", { name: "Acompanhar interessados" })).toHaveCount(0);
  await page.goto("/admin/interessados"); await expect(page.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
  for (const url of urls) expect((await page.request.get(url)).status()).toBe(403);
  expect((await write(page.request, seed.first, { event_type: "note", note: "Teste", version: 0, idempotency_key: randomUUID() })).status()).toBe(403);
  await login(page); await page.goto("/admin/interessados"); await expect(page.getByRole("heading", { name: "Interessados", exact: true })).toBeVisible();
  const detail = await page.request.get(`/api/admin/interessados/${seed.first}`); expect(detail.headers()["cache-control"]).toBe("private, no-store"); expect((await detail.json()).data.email).toBe("private@example.test");
  expect((await page.request.get("/api/admin/interessados?q=private@example.test")).status()).toBe(400);
});

test("lista filtra e pagina com coorte, marcos históricos e frações corretas", async ({ page }, info) => {
  await login(page); await page.goto("/admin/interessados?per_page=1"); await expect(page.getByRole("region", { name: "Lista de interessados" }).locator("tbody tr")).toHaveCount(1);
  await expect(page.locator(".lead-milestones")).toContainText("33,3%");
  await page.locator(".lead-summary").screenshot({ path: info.outputPath("lead-summary.png") });
  await page.getByRole("link", { name: "Próxima →", exact: true }).click(); await expect(page).toHaveURL(/page=2/);
  await page.getByLabel("Responsável", { exact: true }).selectOption("unassigned"); await page.getByLabel("Etapa", { exact: true }).selectOption("lost");
  await page.getByRole("button", { name: "Filtrar interessados" }).click(); await expect(page).toHaveURL(/assigned_to_id=unassigned/); expect(new URL(page.url()).searchParams.get("page")).toBe("1");
  await expect(page.locator(".lead-milestones")).toContainText("100%"); await expect(page.locator(".lead-table tbody")).toContainText("Interessado após visita");
  await page.getByLabel("ID do imóvel").fill("888888"); await page.getByRole("button", { name: "Filtrar interessados" }).click(); await expect(page.locator(".lead-milestones")).toContainText("—");
  expect(page.url()).not.toContain("private@example.test"); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("detalhe mantém snapshot, texto inerte, histórico paginado e contato sem evento implícito", async ({ page }) => {
  await login(page); await page.goto(`/admin/interessados/${seed.first}`); const posts: string[] = []; page.on("request", req => { if (req.method() === "POST" && req.url().endsWith("/events")) posts.push(req.url()); });
  await expect(page.locator(".lead-timeline > li")).toHaveCount(50); await page.getByRole("button", { name: "Carregar eventos anteriores" }).click(); await expect(page.locator(".lead-timeline > li")).toHaveCount(56);
  const ids = await page.locator("[data-event-id]").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-event-id"))); expect(new Set(ids).size).toBe(ids.length);
  await expect(page.locator(".lead-detail-grid script")).toHaveCount(0); await expect(page.locator(".lead-free-text").first()).toContainText("<script>");
  const phone = page.getByRole("link", { name: "Abrir telefone", exact: true });
  await phone.evaluate(link => link.addEventListener("click", event => event.preventDefault())); await phone.dispatchEvent("click"); expect(posts).toHaveLength(0);
  await page.goto(`/admin/interessados/${seed.removed}`); await expect(page.getByRole("heading", { name: "Título preservado na captação" })).toBeVisible(); await expect(page.getByRole("link", { name: "Consultar anúncio público atual" })).toHaveCount(0);
  await page.goto("/imovel/2/um-novo-capitulo-no-agua-verde"); await expect(page.locator("body")).not.toContainText("private@example.test");
});

test("tentativa, contato, responsável, agendamento, perda e reabertura refletem ações reais", async ({ page }) => {
  await login(page); await page.goto(`/admin/interessados/${seed.first}`);
  await act(page, "assigned", async () => { await page.getByLabel("Responsável", { exact: true }).selectOption("2"); }); await expect(page.locator(".interest-review").first()).toContainText("Outro administrador");
  await act(page, "contact_attempt"); await expect(page.locator(".section-heading .lead-stage").first()).toHaveText("Novo");
  await act(page, "contacted"); await expect(page.locator(".section-heading .lead-stage").first()).toHaveText("Contato realizado");
  const future = localDateInput(new Date(Date.now() + 86400000).toISOString());
  await act(page, "visit_scheduled", async () => { await page.getByLabel("Visita prevista (horário de Brasília)", { exact: true }).fill(future); }); await expect(page.locator(".section-heading .lead-stage").first()).toHaveText("Visita agendada");
  await act(page, "visit_scheduled", async () => { await page.getByLabel("Visita prevista (horário de Brasília)", { exact: true }).fill(localDateInput(new Date(Date.now() + 172800000).toISOString())); });
  await act(page, "lost", async () => { await page.getByLabel("Motivo", { exact: true }).fill("Desistência informada"); });
  await expect(page.getByLabel("Ação", { exact: true }).locator("option")).toHaveText(["Selecione uma ação", "Adicionar nota", "Alterar responsável", "Reabrir caso"]);
  await act(page, "reopened", async () => { await page.getByLabel("Motivo", { exact: true }).fill("Retomou o interesse"); }); await expect(page.locator(".section-heading .lead-stage").first()).toHaveText("Novo");
});

test("visita realizada, negociação e ganho não inferem valor do negócio ou mudam anúncio", async ({ page }) => {
  await login(page); await page.goto(`/admin/interessados/${seed.scheduled}`); await act(page, "visit_completed");
  await expect(page.locator(".section-heading .lead-stage").first()).toHaveText("Visita realizada"); await act(page, "negotiating");
  await page.getByLabel("Ação", { exact: true }).selectOption("won"); await expect(page.getByLabel("Valor do fechamento", { exact: true })).toHaveValue(""); await expect(page.getByLabel("Moeda do fechamento", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Revisar ação" }).click(); await page.getByRole("button", { name: "Confirmar registro" }).click(); await expect(page.locator(".section-heading .lead-stage").first()).toHaveText("Ganho");
  const detail = (await (await page.request.get(`/api/admin/interessados/${seed.scheduled}`)).json()).data; expect(detail.closed_amount).toBeNull(); expect(detail.first_visit_completed_at).toBeTruthy();
  await act(page, "note", async () => { await page.getByLabel("Nota", { exact: true }).fill("Acompanhamento final"); });
  await page.goto("/imovel/2/um-novo-capitulo-no-agua-verde"); await expect(page.getByRole("button", { name: "Tenho interesse", exact: true })).toBeEnabled();
});

test("conflito de versão preserva nota, recarrega e exige outra confirmação sem retry", async ({ page }) => {
  await login(page); await page.goto(`/admin/interessados/${seed.first}`); const bodies: Record<string, unknown>[] = [];
  page.on("request", req => { if (req.method() === "POST" && req.url().endsWith("/events")) bodies.push(req.postDataJSON()); });
  await page.getByLabel("Ação", { exact: true }).selectOption("note"); await page.getByLabel("Nota", { exact: true }).fill("Conflito entre operadores"); await page.getByRole("button", { name: "Revisar ação" }).click(); await page.getByRole("button", { name: "Confirmar registro" }).click();
  await expect(page.getByRole("button", { name: "Revisar versão atual e preparar nova ação" })).toBeEnabled(); expect(bodies).toHaveLength(1);
  await page.getByRole("button", { name: "Revisar versão atual e preparar nova ação" }).click(); await expect(page.getByLabel("Nota", { exact: true })).toHaveValue("Conflito entre operadores");
  await page.getByRole("button", { name: "Revisar ação" }).click(); await page.getByRole("button", { name: "Confirmar registro" }).click(); await expect(page.getByRole("status").filter({ hasText: "Acompanhamento registrado." })).toBeVisible();
  expect(bodies).toHaveLength(2); expect(bodies[1].version).toBe(Number(bodies[0].version) + 1); expect(bodies[1].idempotency_key).not.toBe(bodies[0].idempotency_key);
});

test("ação com resposta perdida repete a mesma chave e reconcilia evento sem duplicar", async ({ page }) => {
  await login(page); await page.goto(`/admin/interessados/${seed.first}`); const bodies: string[] = [];
  await page.route(`**/api/admin/interessados/${seed.first}/events`, async route => { bodies.push(route.request().postData()!); const response = await route.fetch(); if (bodies.length === 1) return route.abort("failed"); await route.fulfill({ response }); });
  await page.getByLabel("Ação", { exact: true }).selectOption("note"); await page.getByLabel("Nota", { exact: true }).fill("Nota idempotente"); await page.getByRole("button", { name: "Revisar ação" }).click(); await page.getByRole("button", { name: "Confirmar registro" }).click();
  await page.getByRole("button", { name: "Repetir a mesma ação" }).click(); await expect(page.locator(".lead-timeline > li").filter({ hasText: "Nota idempotente" })).toHaveCount(1); expect(bodies[0]).toBe(bodies[1]);
});

test("503 preserva envio e 422 mostra validação próxima ao contato sem detalhes internos", async ({ page }) => {
  let attempts = 0; const bodies: string[] = [];
  await page.route("**/api/imoveis/2/interesses", async route => { bodies.push(route.request().postData()!); attempts++; if (attempts === 1) return route.fulfill({ status: 503, json: { error: { code: "lead_capture_unavailable" } } }); await route.continue(); });
  let dialog = await publicReview(page); await dialog.getByRole("button", { name: "Confirmar interesse" }).click();
  await expect(dialog.getByRole("alert")).toContainText("temporariamente indisponível"); expect(bodies).toHaveLength(1);
  await dialog.getByRole("button", { name: "Tentar o mesmo envio novamente" }).click(); await expect(dialog.getByRole("heading", { name: "Interesse registrado", exact: true })).toBeVisible(); expect(bodies[1]).toBe(bodies[0]);
  await dialog.getByRole("button", { name: "Concluir" }).click();
  await page.getByRole("button", { name: "Tenho interesse", exact: true }).click(); dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Registrar outra solicitação" }).click();
  await dialog.getByLabel("Nome", { exact: true }).fill("Pessoa privada"); await dialog.getByLabel("E-mail", { exact: true }).fill("rejected@example.test"); await dialog.getByRole("checkbox").check(); await dialog.getByRole("button", { name: "Revisar solicitação" }).click(); await dialog.getByRole("button", { name: "Confirmar interesse" }).click();
  await expect(dialog.getByRole("alert")).toContainText("campos destacados"); await expect(dialog).not.toContainText("PRIVATE_");
  await dialog.getByRole("button", { name: "Revisar nova solicitação", exact: true }).click(); const field = dialog.getByLabel("E-mail", { exact: true }); await expect(field).toHaveValue("rejected@example.test"); await expect(field).toHaveAttribute("aria-invalid", "true");
});

test("eventos rejeitam campos indevidos, origem, transição, horário e responsável inválidos", async ({ page }) => {
  await login(page);
  const current = (await (await page.request.get(`/api/admin/interessados/${seed.first}`)).json()).data;
  const body = { event_type: "note", note: "Fato confirmado", version: current.version, idempotency_key: randomUUID() };
  expect((await write(page.request, seed.first, { ...body, status: "won" })).status()).toBe(400);
  expect((await page.request.post(`/api/admin/interessados/${seed.first}/events`, { headers: { Origin: "https://evil.example" }, data: body })).status()).toBe(403);
  expect((await write(page.request, seed.first, { event_type: "won", version: current.version, idempotency_key: randomUUID() })).status()).toBe(422);
  expect((await write(page.request, seed.first, { ...body, occurred_at: new Date(Date.now() + 86400000).toISOString() })).status()).toBe(422);
  expect((await write(page.request, seed.first, { event_type: "assigned", assigned_to_id: "999", version: current.version, idempotency_key: randomUUID() })).status()).toBe(422);
  const first = await write(page.request, seed.first, body); expect(first.status()).toBe(201); const result = await first.json();
  const replay = await write(page.request, seed.first, body); expect(replay.status()).toBe(200); const repeated = await replay.json(); expect(repeated.meta.replayed).toBe(true); expect(repeated.data.event.id).toBe(result.data.event.id);
  expect((await write(page.request, seed.first, { ...body, note: "Outro fato" })).status()).toBe(409);
  expect((await page.request.get(`/api/admin/interessados/${randomUUID()}`)).status()).toBe(404);
});

test("perda de permissão durante acompanhamento oculta dados privados e solicita login", async ({ page }) => {
  for (const status of [403, 401]) {
    await login(page); await page.goto(`/admin/interessados/${seed.first}`);
    await page.route(`**/api/admin/interessados/${seed.first}/events`, route => route.fulfill({ status, json: { error: { code: status === 401 ? "unauthorized" : "forbidden" } } }));
    await page.getByLabel("Ação", { exact: true }).selectOption("note"); await page.getByLabel("Nota", { exact: true }).fill("Não confirmar sem permissão"); await page.getByRole("button", { name: "Revisar ação" }).click(); await page.getByRole("button", { name: "Confirmar registro" }).click();
    if (status === 401) await expect(page).toHaveURL(/\/auth\/login/); else await expect(page.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
    await expect(page.locator(".lead-detail-grid")).toHaveCount(0); await page.unroute(`**/api/admin/interessados/${seed.first}/events`);
  }
});
