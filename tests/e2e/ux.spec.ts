import { test, expect } from "@playwright/test";

test("detalhe oferece atalhos de seção e caminho claro às fontes", async ({ page }) => {
  await page.goto("/imovel/1/apartamento-com-varanda-no-batel");
  await page.getByRole("link", { name: "Consultar anúncios de origem", exact: true }).click();
  await expect(page).toHaveURL(/#fontes$/);
  await expect(page.locator("#fontes")).toBeInViewport();
  await expect(page.getByRole("link", { name: "Ver anúncio original" }).first()).toHaveAttribute("href", "https://example.com/one");
  await page.getByRole("navigation", { name: "Seções do imóvel" }).getByRole("link", { name: "Fotos", exact: true }).click();
  await expect(page).toHaveURL(/#fotos$/);
  await expect(page.locator("#fotos")).toBeInViewport();
});

test("cancelar compartilhamento não mostra erro; falha permite copiar manualmente", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => { throw new DOMException("Cancelado", "AbortError"); },
    });
  });
  await page.goto("/imovel/1/apartamento-com-varanda-no-batel#sobre");
  await page.getByRole("button", { name: "Compartilhar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Compartilhar", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Link deste imóvel")).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => { throw new Error("Indisponível"); },
    });
  });
  await page.getByRole("button", { name: "Compartilhar", exact: true }).click();
  const link = page.getByLabel("Link deste imóvel");
  await expect(link).toHaveValue(/\/imovel\/1\/apartamento-com-varanda-no-batel$/);
  await link.focus();
  expect(await link.evaluate((node: HTMLInputElement) => node.selectionEnd! - node.selectionStart!)).toBe((await link.inputValue()).length);
});

test("menu móvel fecha por Escape, clique fora e navegação entre modalidades", async ({ page }, info) => {
  test.skip(!info.project.use.isMobile, "Menu exclusivo de telas pequenas");
  await page.goto("/buscar?listing_type=sale");
  const menu = page.locator(".mobile-nav");
  const toggle = page.getByLabel("Abrir navegação");
  await toggle.click();
  await expect(menu).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open");
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.getByRole("heading", { level: 1 }).click({ position: { x: 5, y: 5 } });
  await expect(menu).not.toHaveAttribute("open");
  await toggle.click();
  await menu.getByRole("link", { name: "Alugar", exact: true }).click();
  await expect(page).toHaveURL(/listing_type=rental/);
  await expect(menu).not.toHaveAttribute("open");
});
