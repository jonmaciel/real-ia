import { test, expect } from "@playwright/test";
test("review shows the cover initially and navigates all gallery photos in source order", async ({ page }) => {
  await page.route("https://ik.imagekit.io/**", (route) => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=", "base64") }));
  await page.goto("/auth/login");
  await page.getByLabel("E-mail").fill("admin@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("uma-senha-muito-segura");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL("/conta");
  await page.goto("/admin/anuncios/101");
  const gallery = page.getByRole("region", { name: "Fotos do anúncio" });
  await expect(gallery.getByRole("button")).toHaveCount(2);
  await expect(gallery.locator("img.property-cover")).toHaveAttribute("src", "https://ik.imagekit.io/test/gallery-cover.jpg");
  await expect(gallery.getByRole("button", { name: "Ver foto 2 — capa" })).toHaveAttribute("aria-pressed", "true");
  await gallery.getByRole("button", { name: "Ver foto 1", exact: true }).click();
  await expect(gallery.locator("img.property-cover")).toHaveAttribute("src", "https://ik.imagekit.io/test/gallery-one.jpg");
  await expect(gallery.getByRole("button", { name: "Ver foto 1", exact: true })).toHaveAttribute("aria-pressed", "true");
});
