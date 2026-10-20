import { test, expect } from "@playwright/test";
test("início → busca → detalhe → fonte original; voltar preserva filtros", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Encontre um lugar",
  );
  await page.getByPlaceholder("Digite a cidade").fill("Curitiba");
  await page.locator('input[value="rental"]').check();
  await page.getByRole("button", { name: "Buscar imóveis" }).click();
  await expect(page).toHaveURL(/city=Curitiba/);
  await expect(page.locator(".property-card")).toHaveCount(3);
  await page
    .getByRole("heading", { name: "Apartamento com varanda no Batel" })
    .getByRole("link")
    .click();
  await expect(
    page.getByRole("heading", { name: "Onde encontramos este imóvel" }),
  ).toBeVisible();
  await expect(page.getByText("R$ 3.700,00", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ver anúncio original" }).first(),
  ).toHaveAttribute("href", "https://example.com/one");
  await expect(page.getByText("Nenhuma fotografia disponível.")).toBeVisible();
  await page.goBack();
  await expect(page.getByPlaceholder("Digite a cidade")).toHaveValue(
    "Curitiba",
  );
});
test("paginação sem total; filtro desconhecido não é aplicado", async ({
  page,
}) => {
  await page.goto("/buscar?per_page=2&bedrooms=3");
  await expect(page.locator(".property-card")).toHaveCount(2);
  await page.getByRole("link", { name: "Próxima →" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator(".property-card")).toHaveCount(2);
  await page.goBack();
  await expect(page).toHaveURL(/per_page=2/);
});
test("vazio e falhas recuperáveis", async ({ page }) => {
  await page.goto("/buscar?city=Inexistente");
  await expect(
    page.getByRole("heading", { name: "Ainda não encontramos seu lugar." }),
  ).toBeVisible();
  for (const status of [400, 401, 403, 404, 422, 429, 500]) {
    await page.goto(`/buscar?city=Erro${status}`);
    await expect(
      page.getByRole("heading", { name: "Vamos tentar de novo?" }),
    ).toBeVisible();
  }
});
test("cadastro, verificação, recuperação, login, rotação e logout seguros", async ({
  page,
  context,
}) => {
  await page.goto("/auth/register");
  await page.getByLabel("Nome", { exact: true }).fill("Ana");
  await page.getByLabel("E-mail", { exact: true }).fill("ana@example.com");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("uma-senha-muito-segura");
  await page.getByLabel("Confirme a senha").fill("uma-senha-muito-segura");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("status")).toContainText("Conta criada");
  expect(
    (await context.cookies()).find((c) => c.name === "morada_session"),
  ).toBeUndefined();
  await page.goto("/auth/verify");
  await page.getByLabel("Token recebido por e-mail").fill("token-valido");
  await page.getByRole("button", { name: "Verificar e-mail" }).click();
  await expect(page.getByRole("status")).toContainText("Operação concluída");
  await page.goto("/auth/forgot");
  await page.getByLabel("E-mail").fill("ana@example.com");
  await page.getByRole("button", { name: "Enviar instruções" }).click();
  await expect(page.getByRole("status")).toContainText("Se houver uma conta");
  await page.goto("/auth/reset");
  await page.getByLabel("Token recebido por e-mail").fill("token-valido");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("uma-senha-muito-segura");
  await page.getByLabel("Confirme a senha").fill("uma-senha-muito-segura");
  await page.getByRole("button", { name: "Redefinir senha" }).click();
  await expect(page.getByRole("status")).toContainText("Senha redefinida");
  await page.goto("/auth/login");
  await page.getByLabel("E-mail").fill("ana@example.com");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("uma-senha-muito-segura");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL("/conta");
  const cookie = (await context.cookies()).find(
    (c) => c.name === "morada_session",
  )!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  await page.getByRole("button", { name: "Renovar sessão" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Operação concluída" }),
  ).toBeVisible();
  const rotated = (await context.cookies()).find(
    (c) => c.name === "morada_session",
  )!;
  expect(rotated.value).not.toBe(cookie.value);
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL("/auth/login");
  expect(
    (await context.cookies()).find((c) => c.name === "morada_session"),
  ).toBeUndefined();
});
test("CSRF e métodos não autorizados são bloqueados", async ({ request }) => {
  const res = await request.post("/api/session/login", {
    headers: { Origin: "https://hostil.example" },
    data: { email: "ana@example.com", password: "uma-senha-muito-segura" },
  });
  expect(res.status()).toBe(403);
  expect((await request.get("/api/session/login")).status()).toBe(405);
});
test("foco de teclado e layout sem rolagem horizontal", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo" }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("token inválido, login não verificado, expiração e exclusão", async ({
  page,
  context,
  request,
}) => {
  await page.goto("/auth/verify");
  await page.getByLabel("Token recebido por e-mail").fill("invalido");
  await page.getByRole("button", { name: "Verificar e-mail" }).click();
  await expect(page.locator(".auth-form [role=alert]")).toContainText("token");
  const origin = { Origin: "http://localhost:3001" };
  const blocked = await request.post("/api/session/login", {
    headers: origin,
    data: {
      email: "naoverificado@example.com",
      password: "uma-senha-muito-segura",
    },
  });
  expect(blocked.status()).toBe(403);
  await context.addCookies([
    {
      name: "morada_session",
      value: "expired-opaque-token",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/conta");
  await expect(page).toHaveURL("/auth/login");
  expect(
    (await context.cookies()).find((c) => c.name === "morada_session"),
  ).toBeUndefined();
  await page.getByLabel("E-mail").fill("ana@example.com");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("uma-senha-muito-segura");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL("/conta");
  await page.getByLabel("Nome", { exact: true }).fill("Ana Silva");
  await page.getByRole("button", { name: "Salvar nome" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Operação concluída" }),
  ).toBeVisible();
  await page
    .getByLabel("Senha", { exact: true })
    .fill("uma-senha-muito-segura");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Excluir minha conta permanentemente" })
    .click();
  await expect(page).toHaveURL("/auth/login");
  expect(
    (await context.cookies()).find((c) => c.name === "morada_session"),
  ).toBeUndefined();
});
