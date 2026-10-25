import { test, expect } from "@playwright/test";
import sharp from "sharp";
const path = "/imovel/1/apartamento-com-varanda-no-batel";

test("bots recebem título, descrição e prévia exclusiva dentro do head", async ({ request }) => {
  for (const agent of ["WhatsApp/2.0", "facebookexternalhit/1.1", "Twitterbot/1.0", "LinkedInBot/1.0"]) {
    const response = await request.get(path, { headers: { "User-Agent": agent } });
    expect(response.status()).toBe(200);
    const head = (await response.text()).split("</head>")[0];
    expect(head).toContain("Apartamento com varanda no Batel | Morada");
    expect(head).toContain('property="og:site_name" content="Morada"');
    expect(head).toContain('name="twitter:card" content="summary_large_image"');
    expect(head).toContain(`${path}/opengraph-image`);
    expect(head).toContain(`rel="canonical" href="http://localhost:3001${path}"`);
  }
});
test("home, ícones e manifest têm recursos de compartilhamento válidos", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Morada — Imóveis para comprar e alugar");
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toMatch(/^http:\/\/localhost:3001\/opengraph-image/);
  const png = await request.get(image!); expect(png.ok()).toBe(true);
  const dimensions = await sharp(await png.body()).metadata();
  expect([dimensions.width, dimensions.height]).toEqual([1200, 630]);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("sizes", "180x180");
  const manifestLink = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(manifestLink!)).json();
  expect(manifest.short_name).toBe("Morada"); expect(manifest.theme_color).toBe("#c4470a");
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect((await request.get("/favicon.ico")).ok()).toBe(true);
});
test("compartilhamento nativo envia resumo factual e URL canônica sem campanha ou âncora", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: async (data: ShareData) => { (window as Window & { shared?: ShareData }).shared = data; } }));
  await page.goto(`${path}?utm_source=teste#fotos`);
  await page.getByRole("button", { name: "Compartilhar", exact: true }).click();
  const payload = await page.evaluate(() => (window as Window & { shared?: ShareData }).shared);
  expect(payload?.url).toBe(`http://localhost:3001${path}`);
  expect(payload?.title).toBe("Apartamento com varanda no Batel");
  expect(payload?.text).toContain("R$ 3.500,00/mês");
});
test("páginas privadas, busca e imóvel ausente continuam fora da indexação", async ({ page, request }) => {
  for (const path of ["/auth/login", "/buscar"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  }
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).not.toContain("Disallow: /buscar");
  expect(robots).toContain("Disallow: /admin");
  const response = await request.get("/imovel/999999/inexistente", { headers: { "User-Agent": "WhatsApp/2.0" } });
  expect(await response.text()).toContain("noindex");
  expect((await request.get("/imovel/999999/inexistente/opengraph-image")).status()).toBe(404);
});
