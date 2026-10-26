import { test, expect, type Page } from "@playwright/test";
async function tiles(page: Page) {
  await page.route("https://tile.openstreetmap.org/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8eee4"/><path d="M0 70H256M0 170H256M70 0V256M170 0V256" stroke="white" stroke-width="14"/></svg>' }));
}
const detail = "/imovel/4/seu-refugio-no-juveve";
const places = [
  { type: "node", id: 1, lat: -25.431, lon: -49.27, tags: { name: "Padaria de teste", shop: "bakery" } },
  { type: "node", id: 2, lat: -25.4305, lon: -49.27, tags: { name: '<img src=x onerror="alert(1)">', amenity: "pharmacy" } },
  { type: "node", id: 3, lat: -25.431, lon: -49.272, tags: { name: "Mercado de teste", shop: "supermarket" } },
  { type: "node", id: 4, lat: -25.432, lon: -49.269, tags: { name: "Ponto de ônibus de teste", highway: "bus_stop" } },
];
test("mapa abre automaticamente, mostra essenciais por categoria e mantém tiles contidos após resize", async ({ page }, info) => {
  await tiles(page); let queries = 0; let googleCalls = 0;
  page.on("request", request => { if (/googleapis\.com|maps\.gstatic\.com/.test(request.url())) googleCalls++; });
  await page.route("https://overpass.private.coffee/api/interpreter", async route => {
    queries++; const query = new URLSearchParams(route.request().postData()!).get("data")!;
    expect(query).toMatch(/around:(500|1000),-25.43,-49.27/);
    await route.fulfill({ json: { elements: query.includes("out center 80") ? places : places.filter(place => place.tags.shop === "bakery") } });
  });
  await page.goto(detail);
  await expect(page.getByRole("link", { name: "(41) 99999-1234", exact: true })).toHaveAttribute("href", "tel:+5541999991234");
  await expect(page.getByText("Rua de Teste, 123 - Curitiba", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".neighborhood-map")).toBeVisible();
  await expect(page.getByRole("button", { name: "Carregar mapa e explorar" })).toHaveCount(0);
  await expect(page.locator(".leaflet-control-attribution")).toContainText("OpenStreetMap");
  await expect(page.locator(".neighborhood-home-pin")).toBeVisible();
  await expect(page.locator(".home-marker")).toHaveText("");
  await expect(page.locator(".home-marker svg")).toBeVisible();
  await expect(page.locator(".neighborhood-home-pin")).toHaveAttribute("aria-label", "Ponto publicado do imóvel");
  await expect(page.locator(".neighborhood-places li")).toHaveCount(4);
  for (const category of ["bakery", "pharmacy", "supermarket", "bus"]) await expect(page.locator(`.neighborhood-places li[data-category=${category}]`)).toHaveCount(1);
  await expect(page.locator(".neighborhood-places img")).toHaveCount(0);
  await expect(page.locator(".neighborhood-place-pin")).toHaveCount(4);
  await expect(page.locator(".neighborhood-map").getByRole("button", { name: /Padaria de teste, .* em linha reta/ })).toBeVisible();
  await expect(page.locator(".nearby-distance").first()).toContainText("em linha reta");
  expect(queries).toBe(1); expect(googleCalls).toBe(0);
  const geometry = await page.locator(".neighborhood-map").evaluate(element => {
    const map = element.getBoundingClientRect(); const marker = element.querySelector(".neighborhood-home-pin")!.getBoundingClientRect();
    return { position: getComputedStyle(element).position, overflow: getComputedStyle(element).overflow, canvas: getComputedStyle(element.querySelector(".neighborhood-map-canvas")!).position, pane: getComputedStyle(element.querySelector(".leaflet-pane")!).position, tile: getComputedStyle(element.querySelector(".leaflet-tile")!).position, height: map.height, inside: marker.left >= map.left && marker.right <= map.right && marker.top >= map.top && marker.bottom <= map.bottom };
  });
  expect(geometry).toMatchObject({ position: "relative", overflow: "hidden", canvas: "relative", pane: "absolute", tile: "absolute", inside: true });
  expect(geometry.height).toBeGreaterThanOrEqual(370);
  await page.locator(".neighborhood-places").getByRole("button", { name: /Padaria de teste/ }).click();
  await expect(page.locator(".neighborhood-places li.is-selected")).toHaveCount(1);
  await expect(page.locator(".neighborhood-place-pin.is-selected")).toHaveCount(1);
  await expect(page.locator(".neighborhood-places li.is-selected").getByRole("link", { name: "Consultar rota" })).toHaveAttribute("href", /origin=-25.43%2C-49.27.*travelmode=walking/);
  await page.getByRole("button", { name: "Padarias", exact: true }).click();
  await expect(page.locator(".neighborhood-places li")).toHaveCount(1); expect(queries).toBe(2);
  await page.getByRole("button", { name: "Essenciais", exact: true }).click();
  await expect(page.locator(".neighborhood-places li")).toHaveCount(4); expect(queries).toBe(2);
  await page.getByRole("combobox", { name: "Raio de busca", exact: true }).selectOption("1000");
  await expect(page.locator(".nearby-results-header [role=status]")).toContainText("4 locais"); expect(queries).toBe(3);
  await page.locator(".neighborhood-explorer").screenshot({ path: info.outputPath("nearby-map.png") });
  await page.setViewportSize({ width: info.project.name === "mobile" ? 430 : 960, height: 850 });
  await page.getByRole("button", { name: "Centralizar no imóvel" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator(".neighborhood-map-canvas").evaluate(element => Math.abs(element.clientWidth - element.parentElement!.clientWidth) < 2)).toBe(true);
});
test("sem coordenadas não cria mapa nem consulta o entorno", async ({ page }) => {
  let queries = 0; page.on("request", request => { if (/overpass|tile\.openstreetmap|maps\.googleapis/.test(request.url())) queries++; });
  await page.goto("/imovel/1/apartamento-com-varanda-no-batel");
  await expect(page.getByText("A fonte não publicou coordenadas", { exact: false })).toBeVisible();
  await expect(page.locator(".neighborhood-map")).toHaveCount(0);
  await expect(page.locator(".leaflet-tile")).toHaveCount(0); expect(queries).toBe(0);
});
test("limite do provedor mantém mapa e só repete mediante ação; vazio não inventa estabelecimentos", async ({ page }) => {
  await tiles(page); let queries = 0;
  await page.route("https://overpass.private.coffee/api/interpreter", route => { queries++; return queries === 1 ? route.fulfill({ status: 429 }) : route.fulfill({ json: { elements: [] } }); });
  await page.goto(detail);
  await expect(page.locator(".nearby-results-header [role=status]")).toContainText("serviço está ocupado");
  await expect(page.locator(".neighborhood-home-pin")).toBeVisible(); expect(queries).toBe(1);
  await expect(page.getByRole("button", { name: "Essenciais", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.locator(".nearby-results-header [role=status]")).toContainText("Nenhum local retornado");
  await expect(page.locator(".neighborhood-places li")).toHaveCount(0); expect(queries).toBe(2);
});
