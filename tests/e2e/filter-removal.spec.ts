import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("remoções rápidas respondem imediatamente, acumulam critérios e restauram resultados", async ({ page }) => {
  let calls = 0, requests = 0; let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  page.on("request", request => { if (request.url().includes("/api/assistente/")) calls++; });
  await page.goto("/buscar?assistant=1&city=Curitiba&property_type=land&furnished=false&excluded_ids=4&page=2&per_page=2");
  await expect(page.getByRole("heading", { name: "Ainda não encontramos seu lugar." })).toBeVisible();
  await page.route("**/buscar?**", async route => {
    const params = new URL(route.request().url()).searchParams;
    if (route.request().headers().rsc === "1" && !params.has("property_type")) { requests++; await waiting; }
    await route.continue();
  });
  try {
    await page.getByRole("link", { name: "Remover filtro Terreno", exact: true }).click();
    await expect(page.getByRole("link", { name: "Remover filtro Terreno", exact: true })).toHaveCount(0);
    await expect(page.locator(".main-search-results")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator(".search-results-loading")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ainda não encontramos seu lugar." })).toHaveCount(0);
    await expect.poll(() => requests).toBeGreaterThan(0);
    await page.getByRole("link", { name: "Remover filtro Curitiba", exact: true }).click();
    await expect(page.getByRole("link", { name: "Remover filtro Curitiba", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Remover filtro Sem mobília", exact: true })).toBeVisible();
    await expect(page.getByText("1 imóvel excluído", { exact: true })).toBeVisible();
    release();
    await expect(page).toHaveURL(url => !url.searchParams.has("city") && !url.searchParams.has("property_type") && url.searchParams.get("page") === "1");
    await expect(page.locator(".property-card")).toHaveCount(2);
    await expect(page.locator(".main-search-results")).toHaveAttribute("aria-busy", "false");
    expect(new URL(page.url()).searchParams.get("furnished")).toBe("false");
    expect(new URL(page.url()).searchParams.get("excluded_ids")).toBe("4");
    expect(calls).toBe(0);
    await page.goBack(); await expect(page.getByRole("link", { name: "Remover filtro Terreno", exact: true })).toBeVisible();
    await page.goForward(); await expect(page.locator(".property-card")).toHaveCount(2);
  } finally { release(); }
});

test("pills tradicionais também removem imediatamente sem recarregar o documento", async ({ page }) => {
  let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.goto("/buscar?city=Inexistente&neighborhood=Centro&per_page=2");
  const visit = await page.evaluate(() => { (window as Window & { filterVisit?: string }).filterVisit = "preserved"; return "preserved"; });
  await page.route("**/buscar?**", async route => { if (route.request().headers().rsc === "1") await waiting; await route.continue(); });
  try {
    await page.getByRole("link", { name: "Remover filtro Cidade", exact: true }).click();
    await expect(page.getByRole("link", { name: "Remover filtro Cidade", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Remover filtro Bairro", exact: true }).click();
    await expect(page.getByRole("link", { name: "Remover filtro Bairro", exact: true })).toHaveCount(0);
    await expect(page.locator(".search-results-loading")).toBeVisible();
    release();
    await expect(page).toHaveURL(url => !url.searchParams.has("city") && !url.searchParams.has("neighborhood"));
    await expect(page.locator(".property-card")).toHaveCount(2);
    expect(await page.evaluate(() => (window as Window & { filterVisit?: string }).filterVisit)).toBe(visit);
  } finally { release(); }
});

test("falha da consulta mostra erro recuperável, sem inventar lista vazia", async ({ page }) => {
  await page.goto("/buscar?assistant=1&city=Erro503&property_type=house");
  await page.getByRole("link", { name: "Remover filtro Casa", exact: true }).click();
  await expect(page).toHaveURL(url => !url.searchParams.has("property_type"));
  await expect(page.getByRole("heading", { name: "Vamos tentar de novo?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ainda não encontramos seu lugar." })).toHaveCount(0);
  await expect(page.getByLabel("Filtros selecionados", { exact: true })).toContainText("Erro503");
  await page.getByRole("link", { name: "Remover filtro Erro503", exact: true }).click();
  await expect(page.locator(".property-card")).toHaveCount(4);
});

test("retirar último orçamento mantém a restrição de total visível até remoção explícita", async ({ page }) => {
  await page.goto("/buscar?assistant=1&city=Arauc%C3%A1ria&price_basis=total_monthly&max_price=100");
  await page.getByRole("link", { name: "Remover filtro Até R$ 100,00", exact: true }).click();
  const basis = page.getByRole("link", { name: "Remover filtro Somente imóveis com total mensal informado", exact: true });
  await expect(basis).toBeVisible();
  await expect(page).toHaveURL(url => !url.searchParams.has("max_price") && url.searchParams.get("price_basis") === "total_monthly");
  await basis.click();
  await expect(page).toHaveURL(url => !url.searchParams.has("price_basis"));
  await expect(page.locator(".property-card")).toHaveCount(3);
});

test("resposta acima de dez segundos usa cache público, invalidado pela aprovação editorial", async ({ page, request }) => {
  test.setTimeout(60000);
  const city = `RespostaLenta${randomUUID()}`;
  await page.goto(`/buscar?assistant=1&city=${city}&per_page=2`);
  await expect(page.locator(".property-card")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Vamos tentar de novo?" })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".property-card")).toHaveCount(2);
  const counts = await (await request.get("http://localhost:4010/__search-observation")).json() as Record<string, number>;
  expect(Object.entries(counts).filter(([query]) => new URLSearchParams(query).get("city") === city).reduce((sum, [, count]) => sum + count, 0)).toBe(1);
  const headers = { Origin: "http://localhost:3001" };
  expect((await page.request.post("/api/session/login", { headers, data: { email: "admin@example.com", password: "uma-senha-muito-segura" } })).ok()).toBe(true);
  expect((await page.request.post("/api/admin/anuncios/104/approve", { headers, data: { source_listing_id: "1041", fingerprint: "v1" } })).ok()).toBe(true);
  await page.reload(); await expect(page.locator(".property-card")).toHaveCount(2);
  const refreshed = await (await request.get("http://localhost:4010/__search-observation")).json() as Record<string, number>;
  expect(Object.entries(refreshed).filter(([query]) => new URLSearchParams(query).get("city") === city).reduce((sum, [, count]) => sum + count, 0)).toBe(2);
});
