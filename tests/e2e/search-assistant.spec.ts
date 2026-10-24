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
  const pills = page.getByLabel("Filtros aplicados", { exact: true });
  await expect(pills.getByRole("link", { name: "Remover filtro Araucária", exact: true })).toBeVisible();
  await expect(pills.getByRole("link", { name: "Remover filtro Casa", exact: true })).toBeVisible();
  await expect(page.locator(".assistant-recommendations, .question-turn")).toHaveCount(0);
  await input.fill("alugar, até 3000"); await input.press("Enter");
  await expect(page.locator(".search-ai-status")).toHaveText("Lista atualizada.");
  await expect(page.locator(".property-card")).toHaveCount(1);
  await expect(page.locator(".property-card")).toContainText("Casa para alugar em Araucária");
  await expect(pills.getByRole("link", { name: "Remover filtro Alugar", exact: true })).toBeVisible();
  await expect(pills.getByRole("link", { name: /Remover filtro Até R\$/ })).toBeVisible();
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

test("pills visíveis na IA permitem remover critérios sem apagar outros ou chamar a IA", async ({ page }) => {
  let calls = 0;
  page.on("request", request => { if (request.url().includes("/api/assistente/mensagens")) calls++; });
  await page.goto("/buscar?assistant=1&city=Arauc%C3%A1ria&property_type=house&listing_type=rental&furnished=false&bedrooms=0&price_basis=total_monthly&min_price=0&max_price=4000&amenities=balcony,pet_friendly&preferred_amenities=pet_friendly,gym&excluded_ids=2&page=2&per_page=1");
  const pills = page.getByLabel("Filtros aplicados", { exact: true });
  await expect(page.getByRole("tab", { name: "Busca com IA", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(pills.getByRole("link", { name: "Remover filtro Sem mobília", exact: true })).toBeVisible();
  await expect(pills.getByRole("link", { name: "Remover filtro Mínimo de 0 quartos", exact: true })).toBeVisible();
  await expect(pills.getByText("Orçamento: total mensal informado pela origem", { exact: true })).toBeVisible();
  await expect(pills.getByText("1 imóvel excluído", { exact: true })).toBeVisible();
  await pills.getByRole("link", { name: "Remover filtro Sem mobília", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has("furnished")).toBe(false);
  expect(new URL(page.url()).searchParams.get("page")).toBe("1");
  await pills.getByRole("link", { name: "Remover filtro Preferência: Aceita pets", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("preferred_amenities")).toBe("gym");
  const params = new URL(page.url()).searchParams;
  for (const [key, value] of Object.entries({ assistant: "1", city: "Araucária", property_type: "house", listing_type: "rental", bedrooms: "0", price_basis: "total_monthly", max_price: "4000", min_price: "0", excluded_ids: "2", amenities: "balcony,pet_friendly", per_page: "1" })) expect(params.get(key)).toBe(value);
  await expect(pills.getByRole("link", { name: "Remover filtro Preferência: Academia", exact: true })).toBeVisible();
  await expect(pills.getByRole("link", { name: "Remover filtro Requisito: Aceita pets", exact: true })).toBeVisible();
  await expect(page.locator(".property-grid")).toHaveCount(1);
  expect(calls).toBe(0);
  await page.getByRole("tab", { name: "Usar filtros", exact: true }).click();
  await expect(pills.getByRole("link", { name: "Remover filtro Casa", exact: true })).toBeVisible();
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

test("buscar pelos filtros atualiza só os resultados, mantém formulário, URL, histórico e rascunho", async ({ page }) => {
  await page.goto("/buscar?page=2&per_page=1");
  await page.getByLabel("O que você procura?").fill("rascunho da conversa");
  const manual = page.getByRole("tab", { name: "Usar filtros", exact: true });
  await manual.click();
  const form = page.locator(".full-search");
  await form.evaluate(element => element.setAttribute("data-instance", "preserved"));
  await page.getByPlaceholder("Digite a cidade").fill("Curitiba");
  await page.getByRole("radio", { name: "Alugar", exact: true }).check();
  let documents = 0; let aiCalls = 0; let resultRequests = 0;
  page.on("request", request => {
    if (request.isNavigationRequest() && request.resourceType() === "document") documents++;
    if (request.url().includes("/api/assistente/mensagens")) aiCalls++;
  });
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/buscar?**", async route => {
    if (route.request().headers().rsc === "1" && new URL(route.request().url()).searchParams.get("city") === "Curitiba") {
      resultRequests++; await delayed;
    }
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "Buscar imóveis", exact: true }).click();
    await expect.poll(() => resultRequests).toBe(1);
    await expect(page.locator(".main-search-results")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator(".search-results-loading")).toBeVisible();
    await expect(form).toBeVisible(); await expect(form).toHaveAttribute("data-instance", "preserved");
    await expect(manual).toHaveAttribute("aria-selected", "true");
    const scroll = await page.evaluate(() => scrollY);
    release();
    await expect(page.locator(".main-search-results")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator(".property-card")).toContainText("Apartamento com varanda no Batel");
    await expect(form).toHaveAttribute("data-instance", "preserved");
    await expect(manual).toHaveAttribute("aria-selected", "true");
    await expect(page.getByPlaceholder("Digite a cidade")).toHaveValue("Curitiba");
    await expect(page.getByLabel("O que você procura?")).toHaveValue("rascunho da conversa");
    expect(Math.abs(await page.evaluate(() => scrollY) - scroll)).toBeLessThan(3);
    const params = new URL(page.url()).searchParams;
    expect(params.get("page")).toBe("1"); expect(params.get("listing_type")).toBe("rental"); expect(params.get("per_page")).toBe("1");
    await page.goBack(); await expect(page).toHaveURL(/page=2/);
    await expect(page.getByPlaceholder("Digite a cidade")).toHaveValue("");
    await expect(manual).toHaveAttribute("aria-selected", "true");
    await page.goForward(); await expect(page.getByPlaceholder("Digite a cidade")).toHaveValue("Curitiba");
    expect(documents).toBe(0); expect(aiCalls).toBe(0);
  } finally { release(); }
});

test("falha na busca manual preserva filtros e permite corrigir sem recarregar o documento", async ({ page }) => {
  await page.goto("/buscar"); await page.getByRole("tab", { name: "Usar filtros", exact: true }).click();
  let documents = 0;
  page.on("request", request => { if (request.isNavigationRequest() && request.resourceType() === "document") documents++; });
  const form = page.locator(".full-search"); await form.evaluate(element => element.setAttribute("data-instance", "preserved"));
  const city = page.getByPlaceholder("Digite a cidade");
  await city.fill("Erro503"); await page.getByRole("button", { name: "Buscar imóveis", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vamos tentar de novo?" })).toBeVisible();
  await expect(city).toHaveValue("Erro503"); await expect(form).toBeVisible();
  await expect(form).toHaveAttribute("data-instance", "preserved");
  await city.fill("Curitiba"); await page.getByRole("button", { name: "Buscar imóveis", exact: true }).click();
  await expect(page.locator(".property-card")).not.toHaveCount(0);
  await expect(form).toHaveAttribute("data-instance", "preserved"); expect(documents).toBe(0);
});
