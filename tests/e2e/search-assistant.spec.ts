import { test, expect } from "@playwright/test";
import { assistantResponse } from "../assistant-fixtures";

test("preenche Araucária durante a pergunta de modalidade e refina a cada resposta", async ({ page }) => {
  let turn = 0;
  await page.route("**/api/assistente/mensagens", route => route.fulfill({ json: { data: assistantResponse({
    answer: turn++ === 0 ? "Você quer comprar ou alugar?" : "Qual bairro você prefere?",
    applied_filters: turn === 1
      ? { city: "Araucária", property_type: "house", currency: "BRL", price_basis: "base" }
      : { city: "Araucária", property_type: "house", currency: "BRL", listing_type: "rental", max_price: "3000.00", price_basis: "base" },
  }) } }));
  await page.goto("/buscar?city=Curitiba&listing_type=rental&max_price=5000&q=antigo&page=2");
  const originalUrl = page.url();
  const form = page.locator(".full-search");
  await expect(form.locator("input[name=city]")).toHaveValue("Curitiba");
  await page.getByRole("button", { name: /Prefere descrever/ }).click();
  const input = page.getByLabel("O que você procura?");
  await input.fill("uma casa em araucaria");
  await input.press("Enter");
  await expect(page.getByText("Você quer comprar ou alugar?", { exact: true })).toBeVisible();
  await expect(form.locator("input[name=city]")).toHaveValue("Araucária");
  await expect(form.getByRole("radio", { name: "Todos", exact: true })).toBeChecked();
  await expect(form.getByLabel("Preço máximo", { exact: true })).toHaveValue("");
  await expect(form.locator("input[name=q]")).toHaveValue("");
  await expect(page.locator(".assistant-filters").getByText("Casa", { exact: true })).toBeVisible();
  expect(page.url()).toBe(originalUrl);
  await input.fill("alugar, até 3000");
  await input.press("Enter");
  await expect(form.getByRole("radio", { name: "Alugar", exact: true })).toBeChecked();
  await expect(form.getByLabel("Preço máximo", { exact: true })).toHaveValue("3000.00");
  await expect(form.locator("input[name=city]")).toHaveValue("Araucária");
  await form.locator("input[name=city]").fill("Cidade editada");
  await input.fill("rascunho sem envio");
  await page.getByRole("button", { name: /Prefere descrever/ }).click();
  await page.getByRole("button", { name: /Prefere descrever/ }).click();
  await expect(form.locator("input[name=city]")).toHaveValue("Cidade editada");
  await form.getByRole("button", { name: "Buscar imóveis", exact: true }).click();
  await expect(page).toHaveURL(/city=Cidade\+editada/);
  const params = new URL(page.url()).searchParams;
  expect(params.get("listing_type")).toBe("rental");
  expect(params.get("max_price")).toBe("3000.00");
  expect(params.has("page")).toBe(false);
  expect(params.has("property_type")).toBe(false);
  await expect(form.locator("input[name=city]")).toHaveValue("Cidade editada");
  await page.goBack();
  await expect(page).toHaveURL(originalUrl);
  await expect(form.locator("input[name=city]")).toHaveValue("Curitiba");
  await page.goForward();
  await expect(form.locator("input[name=city]")).toHaveValue("Cidade editada");
});

test("sanfona conversa e retorna critérios sem alterar a lista ou duplicar o chat", async ({ page }, info) => {
  const calls: Record<string, unknown>[] = [];
  page.on("request", request => {
    if (request.url().includes("/api/assistente/mensagens")) calls.push(request.postDataJSON());
  });
  await page.clock.install();
  await page.goto("/buscar?city=Curitiba&listing_type=rental");
  const originalUrl = page.url();
  const toggle = page.getByRole("button", { name: /Prefere descrever/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.focus();
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#property-question")).toHaveCount(1);
  await expect(page.locator(".property-chat-widget")).toHaveCount(0);
  expect(calls).toHaveLength(0);
  await page.clock.fastForward(25000);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const input = page.getByLabel("O que você procura?");
  await input.fill("Quero alugar em Curitiba, até R$ 3.000, com dois quartos e pets");
  await input.press("Enter");
  const accordion = page.locator(".search-assistant");
  await expect(accordion.getByText("Mínimo de 2 quartos", { exact: true })).toBeVisible();
  await expect(accordion.getByText("Requisito: Aceita pets", { exact: true })).toBeVisible();
  await expect(accordion.getByText("Critérios da conversa", { exact: true })).toBeVisible();
  expect(page.url()).toBe(originalUrl);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ selected_listing_id: null, search_token: null, history: [] });
  await input.fill("E com uma vaga?");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await accordion.screenshot({ path: info.outputPath("search-accordion.png") });
  await toggle.click();
  await page.getByRole("button", { name: "Abrir conversa com o Morada", exact: true }).click();
  await expect(page.locator("#property-question")).toHaveCount(1);
  await expect(input).toHaveValue("E com uma vaga?");
  await expect(page.locator(".question-turn")).toHaveCount(1);
  await input.press("Enter");
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1].search_token).toBeTruthy();
  expect(calls[1].history).toHaveLength(2);
});

test("falha preserva o prompt e filtros; navegar restaura a janela flutuante", async ({ page }) => {
  await page.goto("/buscar?city=Curitiba&max_price=3000");
  await page.getByRole("button", { name: /Prefere descrever/ }).click();
  const input = page.getByLabel("O que você procura?");
  await input.fill("Erro 503");
  await input.press("Enter");
  await expect(page.locator(".question-error")).toBeVisible();
  await expect(input).toHaveValue("Erro 503");
  await expect(page).toHaveURL(/city=Curitiba&max_price=3000/);
  await page.locator(".breadcrumb").getByRole("link", { name: "Início", exact: true }).click();
  await expect(page.getByRole("button", { name: "Abrir conversa com o Morada", exact: true })).toBeVisible();
});
