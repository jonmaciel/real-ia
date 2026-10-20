import { test, expect } from "@playwright/test";

test("login presents focused recovery links and contextual request errors", async ({ page }) => {
  await page.goto("/auth/login");
  const navigation = page.getByRole("navigation", { name: "Acesso à conta" });
  await expect(navigation.getByRole("link")).toHaveCount(2);
  await expect(navigation.getByRole("link", { name: "Esqueci minha senha" })).toBeVisible();
  await page.getByLabel("E-mail").fill("invalidrequest@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("uma-senha-muito-segura");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Confira os dados informados");
  await expect(page.locator("form").getByRole("alert")).not.toContainText("filtros");
  await page.getByLabel("E-mail").fill("naoverificado@example.com");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("link", { name: "Confirmar meu e-mail" })).toBeVisible();
});
