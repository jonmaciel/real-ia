import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, admin = true) {
  await page.goto("/auth/login"); await page.getByLabel("E-mail").fill(admin ? "admin@example.com" : "ana@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("uma-senha-muito-segura");
  await page.getByRole("button", { name: "Entrar", exact: true }).click(); await expect(page).toHaveURL("/conta");
}
test("prévias protegidas expõem só três imagens seguras e preservam a revisão", async ({ page, request }, info) => {
  expect((await request.get("/api/admin/anuncios/104/previews")).status()).toBe(401);
  await login(page, false);
  expect((await page.request.get("/api/admin/anuncios/104/previews")).status()).toBe(403);
  await login(page);
  const response = await page.request.get("/api/admin/anuncios/104/previews");
  expect(response.status()).toBe(200); expect(response.headers()["cache-control"]).toContain("private, no-store");
  const body = await response.json(); expect(body.data).toHaveLength(3);
  expect(body.data.map((photo: { id: string }) => photo.id)).toEqual(["402", "400", "401"]);
  expect(Object.keys(body.data[0]).sort()).toEqual(["attribution", "id", "url"]);
  expect(JSON.stringify(body)).not.toMatch(/fingerprint|extraction_metadata|publication_review|Bearer/);
  expect((await page.request.get("/api/admin/anuncios/999/previews")).status()).toBe(404);
  await page.route("https://ik.imagekit.io/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#e6dfd1"/></svg>' }));
  await page.goto("/admin/anuncios");
  const row = page.locator(".admin-queue article").filter({ has: page.getByRole("heading", { name: "Imóvel coletado 104", exact: true }) });
  await row.scrollIntoViewIfNeeded();
  await expect(row.locator(".admin-preview-photo img")).toHaveCount(3);
  await expect(row.locator(".admin-preview-photo img").first()).toHaveAttribute("src", /preview-2/);
  await expect(row.locator("figcaption").first()).toHaveText("Fonte sintética de teste");
  await row.screenshot({ path: info.outputPath("admin-row-previews.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await row.getByRole("link", { name: /— foto 1/ }).click(); await expect(page).toHaveURL(/\/admin\/anuncios\/104$/);
});

test("carrega apenas linhas visíveis, limita concorrência e preserva ação Revisar sem fotos", async ({ page }) => {
  await login(page);
  let active = 0; let maximum = 0; const ids = new Set<string>();
  let release!: () => void; const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/admin/anuncios/*/previews", async route => {
    ids.add(route.request().url().split("/").at(-2)!); active++; maximum = Math.max(maximum, active);
    await delayed; active--; await route.fulfill({ json: { data: [] } }).catch(() => {});
  });
  await page.goto("/admin/anuncios");
  const rows = page.locator(".admin-queue article");
  try {
    await rows.first().scrollIntoViewIfNeeded();
    await expect.poll(() => ids.size).toBeGreaterThan(0); expect(ids.size).toBeLessThan(await rows.count());
    for (let index = 0; index < await rows.count(); index++) await rows.nth(index).scrollIntoViewIfNeeded();
    await expect.poll(() => ids.size).toBe(2); expect(maximum).toBe(2);
    release();
    await rows.first().scrollIntoViewIfNeeded();
    await expect(rows.first().getByText("Nenhuma foto processada disponível")).toBeVisible();
    await expect(rows.first().getByRole("link", { name: /^Revisar/ })).toBeVisible();
    expect(maximum).toBeLessThanOrEqual(2);
  } finally { release(); }
});

test("falha de prévia não bloqueia a fila e só repete mediante ação", async ({ page }) => {
  await login(page); let calls = 0;
  await page.route("**/api/admin/anuncios/*/previews", async route => {
    calls++; await route.fulfill({ status: calls === 1 ? 503 : 200, json: calls === 1 ? { message: "PRIVATE_UPSTREAM_ERROR" } : { data: [] } });
  });
  await page.goto("/admin/anuncios?per_page=1");
  const row = page.locator(".admin-queue article"); await row.scrollIntoViewIfNeeded();
  await expect(row.getByRole("button", { name: "Tentar carregar fotos" })).toBeVisible();
  await expect(row).not.toContainText("PRIVATE_UPSTREAM_ERROR"); expect(calls).toBe(1);
  await expect(row.getByRole("link", { name: /^Revisar/ })).toBeVisible();
  await row.getByRole("button", { name: "Tentar carregar fotos" }).click();
  await expect(row.getByText("Nenhuma foto processada disponível")).toBeVisible(); expect(calls).toBe(2);
});
