import { test, expect } from "@playwright/test";
import { assistantResponse } from "../assistant-fixtures";

test("pensa mantendo a lista atual e só atualiza os imóveis após a resposta do backend", async ({ page }) => {
  let releaseAnswer!: () => void;
  let releaseResults!: () => void;
  const answer = new Promise<void>(resolve => { releaseAnswer = resolve; });
  const results = new Promise<void>(resolve => { releaseResults = resolve; });
  let resultRequests = 0;
  await page.route("**/api/assistente/mensagens", async route => {
    await answer;
    await route.fulfill({ json: { data: assistantResponse({
      answer: "Você quer comprar ou alugar?", applied_filters: { city: "Araucária", property_type: "house" },
    }) } });
  });
  await page.goto("/buscar?per_page=1");
  await page.route("**/buscar?**", async route => {
    if (route.request().headers().rsc === "1" && new URL(route.request().url()).searchParams.get("assistant") === "1") {
      resultRequests++;
      await results;
    }
    await route.continue();
  });
  const list = page.locator(".main-search-results");
  const status = page.locator(".search-ai-status");
  const input = page.getByLabel("O que você procura?");
  try {
    await expect(list.locator(".property-card")).toContainText("Apartamento com varanda no Batel");
    await input.fill("uma casa em araucaria"); await input.press("Enter");
    await expect(status).toHaveText("Pensando…");
    await expect(input).toBeDisabled();
    await expect(list).toHaveAttribute("aria-busy", "false");
    await expect(list.locator(".property-card")).toBeVisible();
    await expect(page.locator(".search-results-loading")).toHaveCount(0);
    expect(resultRequests).toBe(0);
    releaseAnswer();
    await expect(status).toHaveText("Atualizando imóveis…");
    await expect(list).toHaveAttribute("aria-busy", "true");
    await expect(page.locator(".search-results-loading")).toBeVisible();
    await expect(list.locator(".property-card")).toHaveCount(0);
    await expect(input).toBeDisabled();
    await expect.poll(() => resultRequests).toBe(1);
    releaseResults();
    await expect(status).toHaveText("Lista atualizada. Você quer comprar ou alugar?");
    await expect(list).toHaveAttribute("aria-busy", "false");
    await expect(list.locator(".property-card")).toContainText("Casa para comprar em Araucária");
    await expect(input).toBeEnabled();
  } finally { releaseAnswer(); releaseResults(); }
});

test("erro ao pensar preserva os imóveis e o prompt sem iniciar atualização da lista", async ({ page }) => {
  let resultRequests = 0;
  await page.goto("/buscar?per_page=1");
  page.on("request", request => {
    if (request.headers().rsc === "1" && new URL(request.url()).searchParams.get("assistant") === "1") resultRequests++;
  });
  await page.route("**/api/assistente/mensagens", route => route.fulfill({ status: 503, json: { error: { code: "unavailable" } } }));
  const input = page.getByLabel("O que você procura?");
  await input.fill("uma casa em araucaria"); await input.press("Enter");
  await expect(page.getByRole("button", { name: "Tentar novamente", exact: true })).toBeEnabled();
  await expect(input).toHaveValue("uma casa em araucaria");
  await expect(page.locator(".main-search-results")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".property-card")).toContainText("Apartamento com varanda no Batel");
  await expect(page.locator(".search-results-loading")).toHaveCount(0);
  expect(resultRequests).toBe(0);
});

test("IA inicial tem somente um input; filtros são opcionais por teclado e não geram chamadas", async ({ page }, info) => {
  let calls = 0;
  page.on("request", request => { if (request.url().includes("/api/assistente/mensagens")) calls++; });
  await page.clock.install(); await page.goto("/buscar");
  const ai = page.getByRole("tab", { name: "Busca com IA", exact: true });
  const manual = page.getByRole("tab", { name: "Usar filtros", exact: true });
  await expect(ai).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("O que você procura?")).toBeVisible();
  await expect(page.locator(".full-search")).toBeHidden();
  await expect(page.locator(".property-grid")).toHaveCount(1);
  await expect(page.locator(".assistant-recommendations, .question-history, .property-chat-widget")).toHaveCount(0);
  await page.clock.fastForward(25000); expect(calls).toBe(0);
  await ai.focus(); await ai.press("ArrowRight");
  await expect(manual).toBeFocused(); await expect(page.locator(".full-search")).toBeVisible();
  await manual.press("Home"); await expect(ai).toBeFocused();
  await expect(page.locator(".full-search")).toBeHidden(); expect(calls).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".search-assistant").screenshot({ path: info.outputPath("simple-ai-search.png") });
});

test("cada prompt atualiza a lista principal, inclusive na clarificação, sem segunda lista", async ({ page }) => {
  const calls: Record<string, unknown>[] = [];
  page.on("request", request => { if (request.url().includes("/api/assistente/mensagens")) calls.push(request.postDataJSON()); });
  await page.goto("/buscar?per_page=1");
  const input = page.getByLabel("O que você procura?");
  await input.fill("uma casa em araucaria"); await input.press("Enter");
  await expect(page).toHaveURL(/assistant=1/);
  await expect(page.locator(".search-ai-status")).toContainText("Lista atualizada. Você quer comprar ou alugar?");
  await expect(page.locator(".property-grid")).toHaveCount(1);
  await expect(page.locator(".property-card")).toHaveCount(1);
  await expect(page.locator(".property-card")).toContainText("Casa para comprar em Araucária");
  await expect(page.locator(".assistant-recommendations, .question-turn")).toHaveCount(0);
  await input.fill("alugar, até 3000"); await input.press("Enter");
  await expect(page.locator(".search-ai-status")).toHaveText("Lista atualizada.");
  await expect(page.locator(".property-card")).toHaveCount(1);
  await expect(page.locator(".property-card")).toContainText("Casa para alugar em Araucária");
  await expect(page.getByText("Casa para comprar em Araucária", { exact: true })).toHaveCount(0);
  expect(calls).toHaveLength(2); expect(calls[1].history).toHaveLength(2); expect(calls[1].search_token).toBeTruthy();
  const params = new URL(page.url()).searchParams;
  expect(params.get("city")).toBe("Araucária"); expect(params.get("property_type")).toBe("house");
  expect(params.get("listing_type")).toBe("rental"); expect(params.get("max_price")).toBe("3000"); expect(params.get("page")).toBe("1");
  expect(page.url()).not.toContain(String(calls[1].search_token));
  await page.getByRole("tab", { name: "Usar filtros", exact: true }).click();
  await expect(page.locator("input[name=city]")).toHaveValue("Araucária");
  await expect(page.getByRole("radio", { name: "Alugar", exact: true })).toBeChecked();
  await expect(page.getByLabel("Preço máximo", { exact: true })).toHaveValue("3000");
  await page.getByLabel("Preço máximo", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Buscar imóveis", exact: true }).click();
  await expect(page).toHaveURL(/max_price=1000/);
  expect(new URL(page.url()).searchParams.get("property_type")).toBe("house");
  await expect(page.locator(".property-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Ainda não encontramos seu lugar." })).toBeVisible();
  await page.goBack(); await expect(page.locator(".property-card")).toContainText("Casa para alugar em Araucária");
  await page.goForward(); await expect(page.locator(".property-card")).toHaveCount(0);
});

test("paginação, reload e orçamento total preservam todos os critérios sem IA extra", async ({ page }) => {
  let calls = 0; page.on("request", request => { if (request.url().includes("/api/assistente/mensagens")) calls++; });
  await page.goto("/buscar?assistant=1&city=Arauc%C3%A1ria&property_type=house&furnished=false&bedrooms=0&price_basis=total_monthly&preferred_amenities=pet_friendly&per_page=1");
  await expect(page.locator(".property-card")).toContainText("Casa para comprar em Araucária");
  await page.getByRole("link", { name: "Próxima →", exact: true }).click();
  await expect(page.locator(".property-card")).toContainText("Casa para alugar em Araucária");
  for (const [key, value] of Object.entries({ furnished: "false", bedrooms: "0", preferred_amenities: "pet_friendly", price_basis: "total_monthly", property_type: "house" })) expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  await page.reload(); await expect(page.locator(".property-card")).toContainText("Casa para alugar em Araucária"); expect(calls).toBe(0);
  await page.goto("/buscar?assistant=1&city=Arauc%C3%A1ria&property_type=house&listing_type=rental&price_basis=total_monthly&max_price=3000");
  await expect(page.locator(".property-card")).toHaveCount(0); // Base 2800 is not total 3200.
});

test("GET indisponível não vira lista antiga ou sucesso; erro de mensagem preserva o rascunho", async ({ page }) => {
  await page.route("**/api/assistente/mensagens", route => route.fulfill({ json: { data: assistantResponse({ applied_filters: { city: "Erro404" } }) } }));
  await page.goto("/buscar"); const input = page.getByLabel("O que você procura?");
  await input.fill("busca com erro de resultado"); await input.press("Enter");
  await expect(page.locator(".search-ai-status")).toContainText("Não foi possível atualizar");
  await expect(page.locator(".property-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Vamos tentar de novo?" })).toBeVisible();
  await page.unroute("**/api/assistente/mensagens");
  await input.fill("Erro 503"); await input.press("Enter");
  await expect(input).toHaveValue("Erro 503");
  await expect(page.locator(".search-ai-status")).not.toHaveText("Lista atualizada.");
});

test("sem exclusões autoritativas não aplica uma busca incompleta", async ({ page }) => {
  await page.route("**/api/assistente/mensagens", route => route.fulfill({ json: { data: assistantResponse({ excluded_ids: undefined, applied_filters: { city: "Araucária" } }) } }));
  await page.goto("/buscar"); const input = page.getByLabel("O que você procura?");
  await input.fill("uma casa em araucaria"); await input.press("Enter");
  await expect(page.locator(".search-ai-status")).toContainText("Não foi possível atualizar");
  await expect(page.locator(".property-card")).toHaveCount(0);
  await expect(page).not.toHaveURL(/assistant=1/);
});
