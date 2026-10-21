import { test, expect, type Page } from "@playwright/test";
async function tiles(page: Page) {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({
    contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"),
  }));
}
const detail = "/imovel/4/seu-refugio-no-juveve";
test("contato público identificado e mapa gratuito só carregam mediante ação", async ({ page }, info) => {
  await tiles(page);
  let queries = 0;
  await page.route("https://overpass.private.coffee/api/interpreter", async (route) => {
    queries++;
    const query = new URLSearchParams(route.request().postData()!).get("data");
    expect(query).toContain('around:500,-25.43,-49.27');
    expect(query).toContain('["shop"="bakery"]');
    await route.fulfill({ json: { elements: [
      { type: "node", id: 1, lat: -25.431, lon: -49.27, tags: { name: "Padaria de teste" } },
      { type: "node", id: 2, lat: -25.4305, lon: -49.27, tags: { name: '<img src=x onerror="alert(1)">' } },
    ] } });
  });
  await page.goto(detail);
  await expect(page.getByRole("link", { name: "(41) 99999-1234", exact: true })).toHaveAttribute("href", "tel:+5541999991234");
  await expect(page.getByText("Rua de Teste, 123 - Curitiba", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".leaflet-tile")).toHaveCount(0);
  expect(queries).toBe(0);
  await page.getByRole("button", { name: "Carregar mapa e explorar" }).click();
  await expect(page.locator(".leaflet-control-attribution")).toContainText("OpenStreetMap");
  await expect(page.locator(".neighborhood-home-pin")).toBeVisible();
  expect(queries).toBe(0);
  await page.getByRole("button", { name: "Explorar arredores", exact: true }).click();
  await expect(page.locator(".neighborhood-places li")).toHaveCount(2);
  await expect(page.locator(".neighborhood-places")).toContainText("em linha reta");
  await expect(page.locator(".neighborhood-places img")).toHaveCount(0);
  await expect(page.locator(".neighborhood-place-pin")).toHaveCount(2);
  await page.locator(".neighborhood-places").getByRole("button", { name: /Padaria de teste/ }).click();
  await expect(page.locator(".neighborhood-places").getByRole("button", { name: /Padaria de teste/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".neighborhood-places li.is-selected").getByRole("link", { name: /Traçar rota/ })).toHaveAttribute("href", /origin=-25.43%2C-49.27.*travelmode=walking/);
  await page.getByRole("button", { name: "Explorar arredores", exact: true }).click();
  await expect(page.locator(".neighborhood-places li")).toHaveCount(2);
  expect(queries).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("neighborhood.png"), fullPage: true });
});
test("sem coordenadas não cria mapa nem consulta o entorno", async ({ page }) => {
  await page.goto("/imovel/1/apartamento-com-varanda-no-batel");
  await expect(page.getByText("A fonte não publicou coordenadas", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Carregar mapa e explorar" })).toHaveCount(0);
  await expect(page.locator(".leaflet-tile")).toHaveCount(0);
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
});
test("limite do provedor é recuperável e busca vazia não inventa estabelecimentos", async ({ page }) => {
  await tiles(page);
  await page.route("https://overpass.private.coffee/api/interpreter", (r) => r.fulfill({ status: 429 }));
  await page.goto(detail);
  await page.getByRole("button", { name: "Carregar mapa e explorar" }).click();
  await page.getByRole("button", { name: "Explorar arredores", exact: true }).click();
  await expect(page.locator(".neighborhood [role=alert]")).toContainText("serviço está ocupado");
  await expect(page.getByLabel("O que você quer ter por perto?")).toHaveValue("bakery");
  await page.route("https://overpass.private.coffee/api/interpreter", (r) => r.fulfill({ json: { elements: [] } }));
  await page.reload();
  await page.getByRole("button", { name: "Carregar mapa e explorar" }).click();
  await page.getByRole("button", { name: "Explorar arredores", exact: true }).click();
  await expect(page.locator(".neighborhood [role=status]")).toContainText("Nenhum local retornado");
});
