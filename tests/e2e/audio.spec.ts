import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
const audio = Buffer.from([82,73,70,70,38,0,0,0,87,65,86,69,102,109,116,32,16,0,0,0,1,0,1,0,64,31,0,0,128,62,0,0,2,0,16,0,100,97,116,97,2,0,0,0,0,0]);
const file = (name = "mensagem.wav", buffer = audio) => ({ name, mimeType: "audio/wav", buffer });
const origin = { Origin: "http://localhost:3001" };
const bff = "/api/assistente/audio-mensagens";
async function attach(page: Page, upload = file()) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Anexar áudio", exact: true }).click();
  await (await chooser).setFiles(upload);
}

test("anexo atravessa BFF byte a byte, exibe transcrição e atualiza lista sem segundo POST", async ({ page, request }) => {
  let audioCalls = 0; let textCalls = 0; let contentType = "";
  page.on("request", r => { if (r.url().includes(bff)) { audioCalls++; contentType = r.headers()["content-type"]; } if (r.url().includes("/api/assistente/mensagens")) textCalls++; });
  await page.goto("/buscar");
  const text = page.getByLabel("O que você procura?"); await text.fill("rascunho preservado");
  await attach(page);
  await expect(page.getByLabel("Ouvir áudio antes de enviar")).toBeVisible();
  await expect(text).toBeDisabled();
  await page.getByRole("button", { name: "Enviar áudio", exact: true }).dblclick();
  await expect(page.locator(".audio-transcription")).toContainText("uma casa em Araucária para alugar");
  await expect(page.locator(".property-card")).toContainText("Casa para alugar em Araucária");
  await expect(text).toHaveValue("rascunho preservado"); await expect(text).toBeEnabled();
  expect(audioCalls).toBe(1); expect(textCalls).toBe(0);
  const observed = await (await request.get("http://localhost:4010/__audio-observation")).json();
  expect(observed.contentType).toBe(contentType); expect(observed.audioSha256).toBe(createHash("sha256").update(audio).digest("hex"));
  expect(observed.fields.sort()).toEqual(["audio", "metadata"]);
  expect(observed.metadata).toMatchObject({ selected_listing_id: null, search_token: null, history: [], context: { page: "search" } });
  expect(observed.metadata.question).toBeUndefined();
});

test("BFF encaminha o multipart binário e o Content-Type originais sem reconstrução", async ({ request }) => {
  const boundary = "MoradaContractBoundary42";
  const contentType = `multipart/form-data; boundary=${boundary}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="mensagem.wav"\r\nContent-Type: audio/wav\r\n\r\n`), audio, Buffer.from([0, 255, 128, 13, 10]),
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n{}\r\n--${boundary}--\r\n`),
  ]);
  const response = await request.post(bff, { headers: { ...origin, "Content-Type": contentType }, data: body });
  expect(response.status()).toBe(200);
  const observed = await (await request.get("http://localhost:4010/__audio-observation")).json();
  expect(observed.sha256).toBe(createHash("sha256").update(body).digest("hex")); expect(observed.contentType).toBe(contentType);
});

test("áudio no imóvel mantém seleção e contexto, sem navegação implícita", async ({ page, request }) => {
  await page.goto("/imovel/2/um-novo-capitulo-no-agua-verde");
  await page.getByRole("button", { name: "Abrir conversa com o Morada", exact: true }).click();
  await expect(page.getByRole("button", { name: "Gravar áudio", exact: true })).toBeEnabled();
  await attach(page); await page.getByRole("button", { name: "Enviar áudio", exact: true }).click();
  await expect(page.locator(".question-user")).toContainText("Você · áudio transcrito");
  await expect(page.locator(".question-user")).toContainText("Quais taxas estão incluídas?");
  await expect(page.locator(".question-answer")).toContainText("Consulte os valores e taxas com o anunciante.");
  await expect(page).toHaveURL(/\/imovel\/2\//);
  const observed = await (await request.get("http://localhost:4010/__audio-observation")).json();
  expect(observed.metadata.selected_listing_id).toBe("2"); expect(observed.metadata.context.page).toBe("listing");
});

test("BFF rejeita tamanho, origem, formato e metadata inválidos; sanitiza erros", async ({ request }) => {
  const upload = (metadata: unknown, name = "mensagem.wav", buffer = audio) => request.post(bff, { headers: origin, multipart: { audio: file(name, buffer), metadata: JSON.stringify(metadata) } });
  expect((await request.post(bff, { headers: { Origin: "https://evil.example" }, multipart: { audio: file() } })).status()).toBe(403);
  for (const metadata of [{ question: "x" }, { model: "x" }, { history: [{ role: "system", content: "x" }] }, { context: { page: "search", html: "x" } }]) expect((await upload(metadata)).status()).toBe(400);
  expect((await upload({}, "big.wav", Buffer.alloc(4 * 1024 * 1024 + 1))).status()).toBe(413);
  expect((await upload({}, "empty.wav", Buffer.alloc(0))).status()).toBe(422);
  expect((await request.post(bff, { headers: origin, multipart: { audio: { name: "bad.ogg", mimeType: "audio/ogg", buffer: audio }, metadata: "{}" } })).status()).toBe(415);
  for (const [status, name] of [[413,"erro-413.wav"],[415,"erro-415.wav"],[422,"code-audio_not_understood.wav"],[422,"code-audio_transcript_too_long.wav"],[502,"erro-502.wav"],[503,"erro-503.wav"],[504,"erro-504.wav"],[502,"bad-response.wav"]] as const) {
    const response = await upload({}, name); expect(response.status()).toBe(status); expect(await response.text()).not.toContain("PRIVATE_PROVIDER_DETAIL"); expect(response.headers()["cache-control"]).toContain("no-store");
  }
  const limited = await upload({}, "erro-429.wav"); expect(limited.status()).toBe(429); expect(limited.headers()["retry-after"]).toBe("2");
});

test("falha preserva áudio para ação manual e mantém alternativa por texto", async ({ page }) => {
  let calls = 0; page.on("request", r => { if (r.url().includes(bff)) calls++; });
  await page.goto("/buscar"); await page.getByLabel("O que você procura?").fill("continuar digitando");
  await attach(page, file("code-audio_not_understood.wav"));
  await page.getByRole("button", { name: "Enviar áudio", exact: true }).click();
  await expect(page.locator(".search-ai-status")).toContainText("Não foi possível entender");
  await expect(page.getByLabel("Ouvir áudio antes de enviar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar áudio", exact: true })).toBeEnabled(); expect(calls).toBe(1);
  await page.getByRole("button", { name: "Descartar áudio", exact: true }).click();
  await expect(page.getByLabel("O que você procura?")).toBeEnabled(); await expect(page.getByLabel("O que você procura?")).toHaveValue("continuar digitando");
});

async function fakeMicrophone(page: import("@playwright/test").Page, denied = false, delayed = false) {
  await page.addInitScript(({ denied, delayed }) => {
    const stats = { requested: 0, stopped: 0 }; Object.assign(window, { microphoneStats: stats });
    const stream = { getTracks: () => [{ stop: () => { stats.stopped++; } }] };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: () => {
      stats.requested++;
      if (denied) return Promise.reject(new DOMException("denied", "NotAllowedError"));
      if (delayed) return new Promise(resolve => { Object.assign(window, { completeMicrophone: () => resolve(stream) }); });
      return Promise.resolve(stream);
    } } });
    class Recorder {
      static isTypeSupported(type: string) { return type.startsWith("audio/webm"); }
      state = "inactive"; mimeType = "audio/webm";
      ondataavailable: ((e: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null;
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; queueMicrotask(() => { this.ondataavailable?.({ data: new Blob([new Uint8Array([26,69,223,163,0,255])], { type: this.mimeType }) }); this.onstop?.(); }); }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: Recorder });
  }, { denied, delayed });
}
test("grava só por ação, para em 60 segundos e libera tracks ao cancelar ou trocar de aba", async ({ page }) => {
  await page.clock.install(); await fakeMicrophone(page); await page.goto("/buscar");
  expect(await page.evaluate(() => (window as unknown as { microphoneStats: { requested: number } }).microphoneStats.requested)).toBe(0);
  await page.getByRole("button", { name: "Gravar áudio", exact: true }).click();
  await expect(page.getByRole("button", { name: "Parar gravação", exact: true })).toBeVisible();
  await page.clock.fastForward(60000);
  await expect(page.getByRole("button", { name: "Enviar áudio", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { microphoneStats: { stopped: number } }).microphoneStats.stopped)).toBe(1);
  await page.getByRole("button", { name: "Descartar áudio", exact: true }).click();
  await page.getByRole("button", { name: "Gravar áudio", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar gravação", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { microphoneStats: { stopped: number } }).microphoneStats.stopped)).toBe(2);
  await page.getByRole("button", { name: "Gravar áudio", exact: true }).click();
  await page.getByRole("tab", { name: "Usar filtros", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { microphoneStats: { stopped: number } }).microphoneStats.stopped)).toBe(3);
});
test("negação de microfone preserva anexo e texto", async ({ page }) => {
  await fakeMicrophone(page, true); await page.goto("/buscar"); await page.getByRole("button", { name: "Gravar áudio", exact: true }).click();
  await expect(page.locator(".assistant-audio-error")).toContainText("não foi permitido"); await expect(page.getByLabel("O que você procura?")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Anexar áudio", exact: true })).toBeEnabled();
});
test("cancelar permissão pendente encerra captura concedida posteriormente", async ({ page }) => {
  await fakeMicrophone(page, false, true); await page.goto("/buscar");
  await page.getByRole("button", { name: "Gravar áudio", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar gravação", exact: true }).click();
  await page.evaluate(() => (window as unknown as { completeMicrophone: () => void }).completeMicrophone());
  await expect.poll(() => page.evaluate(() => (window as unknown as { microphoneStats: { stopped: number } }).microphoneStats.stopped)).toBe(1);
  await expect(page.getByLabel("O que você procura?")).toBeEnabled();
});
test("minimizar chat interrompe a gravação", async ({ page }) => {
  await fakeMicrophone(page); await page.goto("/imovel/2/um-novo-capitulo-no-agua-verde");
  await page.getByRole("button", { name: "Abrir conversa com o Morada", exact: true }).click();
  await page.getByRole("button", { name: "Gravar áudio", exact: true }).click();
  await page.getByRole("button", { name: "Minimizar conversa", exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { microphoneStats: { stopped: number } }).microphoneStats.stopped)).toBe(1);
});

test("timeout de 95 segundos preserva áudio e não repete o envio", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const original = AbortSignal.timeout.bind(AbortSignal);
    AbortSignal.timeout = milliseconds => {
      if (milliseconds !== 95000) return original(milliseconds);
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), milliseconds);
      return controller.signal;
    };
  });
  let calls = 0; let release!: () => void; const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**${bff}`, async route => { calls++; await delayed; await route.abort().catch(() => {}); });
  const response = await page.goto("/buscar");
  expect(response?.headers()["permissions-policy"]).toContain("microphone=(self)");
  await attach(page);
  await page.getByRole("button", { name: "Enviar áudio", exact: true }).click();
  await expect.poll(() => calls).toBe(1);
  await page.clock.fastForward(94000);
  await expect(page.locator(".search-ai-status")).toContainText("Transcrevendo e pensando");
  await page.clock.fastForward(1000);
  await expect(page.locator(".search-ai-status")).toContainText("demorou");
  await expect(page.getByRole("button", { name: "Enviar áudio", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Ouvir áudio antes de enviar")).toBeVisible();
  await page.clock.fastForward(120000); expect(calls).toBe(1); release();
});

test("cancelar envio descarta resposta tardia sem apagar o anexo", async ({ page }) => {
  let release!: () => void; const delayed = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route(`**${bff}`, async route => { calls++; await delayed; await route.fulfill({ json: { data: {} } }).catch(() => {}); });
  await page.goto("/buscar"); await attach(page);
  await page.getByRole("button", { name: "Enviar áudio", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancelar envio", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar envio", exact: true }).click(); release();
  await expect(page.getByRole("button", { name: "Enviar áudio", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Ouvir áudio antes de enviar")).toBeVisible();
  await expect(page.locator(".audio-transcription")).toHaveCount(0); expect(calls).toBe(1);
});
