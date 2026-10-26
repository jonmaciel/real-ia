import { test, expect } from "@playwright/test";
import { assistantResponse } from "../assistant-fixtures";

test("home oferece IA inicialmente e filtros apenas por escolha, sem geração automática", async ({ page }, info) => {
  let calls = 0;
  page.on("request", request => { if (request.url().includes("/api/assistente/")) calls++; });
  await page.clock.install(); await page.goto("/");
  await expect(page.getByRole("tab", { name: "Busca com IA", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("O que você procura?")).toBeVisible();
  await expect(page.getByPlaceholder("Digite a cidade")).toBeHidden();
  await expect(page.getByRole("button", { name: "Gravar áudio", exact: true })).toBeVisible();
  await page.clock.fastForward(60000);
  await expect(page.locator(".property-chat-widget")).toHaveCount(0);
  expect(calls).toBe(0);
  await page.getByRole("tab", { name: "Busca com IA", exact: true }).focus(); await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Usar filtros", exact: true })).toBeFocused();
  await expect(page.getByPlaceholder("Digite a cidade")).toBeVisible();
  await expect(page.getByLabel("O que você procura?")).toBeHidden();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByLabel("O que você procura?")).toBeVisible();
  expect(calls).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("home-ai-search.png"), fullPage: true });
});

test("prompt da home pensa, leva filtros e clarificação aos resultados e mantém uma só lista", async ({ page }) => {
  let calls = 0; let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/assistente/mensagens", async route => {
    calls++;
    const payload = route.request().postDataJSON();
    expect(payload.context.page).toBe(calls === 1 ? "home" : "search");
    if (calls === 2) expect(payload.history).toContainEqual({ role: "user", content: "uma casa em araucaria" });
    await ready;
    await route.fulfill({ json: { data: assistantResponse({ answer: "Você quer comprar ou alugar?", applied_filters: { city: "Araucária", property_type: "house" } }) } });
  });
  await page.goto("/");
  try {
    const input = page.getByLabel("O que você procura?");
    await input.fill("uma casa em araucaria"); await input.press("Enter");
    await expect(page.locator(".search-ai-status")).toHaveText("Pensando…");
    await expect(input).toBeDisabled(); await expect(page).toHaveURL("/");
    release();
    await expect(page).toHaveURL(/\/buscar\?assistant=1/);
    await expect(page).toHaveURL(/city=Arauc%C3%A1ria/);
    await expect(page.locator(".search-ai-status")).toContainText("Você quer comprar ou alugar?");
    await expect(page.getByRole("link", { name: "Remover filtro Araucária" })).toBeVisible();
    await expect(page.locator(".property-grid")).toHaveCount(1);
    await expect(page.locator(".main-search-results")).toContainText("Casa para comprar em Araucária");
    await expect(page.getByLabel("O que você procura?")).toHaveValue("");
    await page.getByLabel("O que você procura?").fill("para alugar"); await page.getByLabel("O que você procura?").press("Enter");
    await expect.poll(() => calls).toBe(2);
    await expect(page.locator(".search-ai-status")).toContainText("Lista atualizada.");
    await page.goBack(); await expect(page).toHaveURL("/");
    await expect(page.locator(".property-chat-widget")).toHaveCount(0);
  } finally { release(); }
});

test("falha da IA na home preserva prompt e oferece filtros sem navegar", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/assistente/mensagens", route => { calls++; return route.fulfill({ status: 503, json: { error: { code: "unavailable" } } }); });
  await page.goto("/");
  const input = page.getByLabel("O que você procura?");
  await input.fill("quero uma casa"); await input.press("Enter");
  await expect(page.locator(".search-ai-status")).toContainText("temporariamente indisponível");
  await expect(input).toHaveValue("quero uma casa"); await expect(input).toBeEnabled();
  await expect(page).toHaveURL("/"); expect(calls).toBe(1);
  await page.getByRole("tab", { name: "Usar filtros", exact: true }).click();
  await expect(page.getByRole("button", { name: "Buscar imóveis", exact: true })).toBeVisible();
});

test("áudio na home abre os resultados com transcrição sem segundo envio de texto", async ({ page, request }) => {
  let audioCalls = 0, textCalls = 0;
  page.on("request", req => { if (req.url().includes("/api/assistente/audio-mensagens")) audioCalls++; if (req.url().includes("/api/assistente/mensagens")) textCalls++; });
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Anexar áudio", exact: true }).click();
  await (await chooser).setFiles({ name: "busca.wav", mimeType: "audio/wav", buffer: Buffer.from([82,73,70,70,38,0,0,0,87,65,86,69,102,109,116,32,16,0,0,0,1,0,1,0,64,31,0,0,128,62,0,0,2,0,16,0,100,97,116,97,2,0,0,0,0,0]) });
  await expect(page.getByLabel("Ouvir áudio antes de enviar")).toBeVisible();
  await page.getByRole("button", { name: "Enviar áudio", exact: true }).click();
  await expect(page).toHaveURL(/\/buscar\?assistant=1/);
  await expect(page.locator(".audio-transcription")).toContainText("uma casa em Araucária para alugar");
  await expect(page.locator(".main-search-results")).toContainText("Casa para alugar em Araucária");
  expect(audioCalls).toBe(1); expect(textCalls).toBe(0);
  const observed = await (await request.get("http://localhost:4010/__audio-observation")).json();
  expect(observed.metadata.context.page).toBe("home");
});
