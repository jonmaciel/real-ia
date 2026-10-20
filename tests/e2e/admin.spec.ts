import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, admin = true) {
  await page.goto("/auth/login");
  await page
    .getByLabel("E-mail")
    .fill(admin ? "admin@example.com" : "ana@example.com");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("uma-senha-muito-segura");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL("/conta");
}
test("apenas admin acessa fila, detalhe e aprovação", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/admin/anuncios/101")).status()).toBe(401);
  await login(page, false);
  await expect(
    page.getByRole("link", { name: "Revisar anúncios" }),
  ).toHaveCount(0);
  await page.goto("/admin/anuncios");
  await expect(
    page.getByRole("heading", { name: "Acesso restrito" }),
  ).toBeVisible();
  await page.goto("/admin/anuncios/101");
  await expect(
    page.getByRole("heading", { name: "Acesso restrito" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      async () =>
        (
          await fetch("/api/admin/anuncios/101/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source_listing_id: "1011",
              fingerprint: "v1",
            }),
          })
        ).status,
    ),
  ).toBe(403);
  await login(page);
  await expect(
    page.getByRole("link", { name: "Revisar anúncios" }),
  ).toBeVisible();
  const headers = { Origin: "http://localhost:3001" };
  expect(
    (await page.request.get("/api/admin/anuncios/101")).headers()[
      "cache-control"
    ],
  ).toContain("private, no-store");
  expect(
    (
      await page.request.post("/api/admin/anuncios/101/approve", {
        headers,
        data: { source_listing_id: 1011, fingerprint: "v1" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/admin/anuncios/101/approve", {
        headers: { Origin: "https://hostil.example" },
        data: { source_listing_id: "1011", fingerprint: "v1" },
      })
    ).status(),
  ).toBe(403);
});
test("fila preserva filtros, paginação has_more e falha recuperável", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/anuncios?city=Curitiba&source_id=9&per_page=1");
  await expect(page.locator(".admin-queue article")).toHaveCount(1);
  await page.getByRole("link", { name: "Próxima →" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/city=Curitiba/);
  await page.goBack();
  await expect(page.getByLabel("Cidade", { exact: true })).toHaveValue(
    "Curitiba",
  );
  await page.getByLabel("Cidade", { exact: true }).fill("Erro500");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(
    page.getByRole("link", { name: "Tentar novamente" }),
  ).toHaveAttribute("href", /city=Erro500/);
  await expect(page.getByLabel("Cidade", { exact: true })).toHaveValue(
    "Erro500",
  );
  await page.goto("/admin/anuncios?status=invalid");
  await expect(
    page.getByRole("heading", { name: "Filtros inválidos" }),
  ).toBeVisible();
});
test("dados incompletos e aprovação individual atualizam busca pública", async ({
  page,
}, info) => {
  const id = info.project.name === "mobile" ? 201 : 101;
  await page.goto("/buscar?city=Curitiba");
  await expect(
    page.getByRole("heading", { name: `Imóvel coletado ${id}`, exact: true }),
  ).toHaveCount(0);
  await login(page);
  await page.goto(`/admin/anuncios/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    `Imóvel coletado ${id}`,
  );
  await expect(
    page.getByText("Preço não informado", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Disponibilidade não confirmada", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Área informada: 82,5 m²")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aprovar e publicar" }),
  ).toBeDisabled();
  await page
    .getByLabel("Selecionar anúncio de origem")
    .selectOption(String(id * 10 + 1));
  await expect(
    page.getByRole("link", { name: "Abrir anúncio original" }),
  ).toHaveAttribute("href", "https://example.com/original");
  await page.getByLabel("Revisei os dados").check();
  await page.screenshot({
    path: info.outputPath("admin-review.png"),
    fullPage: true,
  });
  const approval = page.waitForRequest((r) =>
    r.url().endsWith(`/api/admin/anuncios/${id}/approve`),
  );
  await page.getByRole("button", { name: "Aprovar e publicar" }).click();
  expect((await approval).postDataJSON()).toEqual({
    source_listing_id: String(id * 10 + 1),
    fingerprint: "v1",
  });
  await expect(page.getByRole("status")).toContainText("aprovado e publicado");
  await page.getByRole("link", { name: "Ver imóvel publicado" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    `Imóvel coletado ${id}`,
  );
  await expect(
    page.locator("article.detail .price-panel .property-price"),
  ).toBeVisible();
  await expect(
    page
      .locator("article.detail .price-panel")
      .getByText("Disponibilidade não confirmada", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Nenhuma fotografia disponível.")).toBeVisible();
  await page.goto("/buscar?city=Curitiba");
  const card = page.locator(".property-card").filter({
    has: page.getByRole("heading", {
      name: `Imóvel coletado ${id}`,
      exact: true,
    }),
  });
  await expect(card).toContainText("Preço não informado");
  await expect(card).toContainText("Disponibilidade não confirmada");
  await expect(card).toContainText("Área informada: 82,5 m²");
});
test("409 atualiza versão e exige nova revisão sem reenvio", async ({
  page,
}, info) => {
  const id = info.project.name === "mobile" ? 202 : 102;
  await login(page);
  await page.goto(`/admin/anuncios/${id}`);
  await page
    .getByLabel("Selecionar anúncio de origem")
    .selectOption(String(id * 10 + 1));
  await page.getByLabel("Revisei os dados").check();
  let calls = 0;
  page.on("request", (r) => {
    if (r.url().endsWith(`/api/admin/anuncios/${id}/approve`)) calls++;
  });
  await page.getByRole("button", { name: "Aprovar e publicar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Imóvel atualizado ${id}`,
  );
  await expect(page.locator(".admin-review [role=alert]")).toContainText(
    "dados mudaram",
  );
  await expect(
    page.getByRole("button", { name: "Aprovar e publicar" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Selecionar anúncio de origem")).toHaveValue("");
  expect(calls).toBe(1);
  await page
    .getByLabel("Selecionar anúncio de origem")
    .selectOption(String(id * 10 + 1));
  await page.getByLabel("Revisei os dados").check();
  const sent = page.waitForRequest((r) =>
    r.url().endsWith(`/api/admin/anuncios/${id}/approve`),
  );
  await page.getByRole("button", { name: "Aprovar e publicar" }).click();
  expect((await sent).postDataJSON().fingerprint).toBe("v2");
  await expect(page.getByRole("status")).toContainText("aprovado e publicado");
});
test("422 recarrega status e bloqueia aprovação; 404 explícito", async ({
  page,
}, info) => {
  const id = info.project.name === "mobile" ? 203 : 103;
  await login(page);
  await page.goto(`/admin/anuncios/${id}`);
  await page
    .getByLabel("Selecionar anúncio de origem")
    .selectOption(String(id * 10 + 1));
  await page.getByLabel("Revisei os dados").check();
  await page.getByRole("button", { name: "Aprovar e publicar" }).click();
  await expect(page.locator(".status-badge")).toHaveText("Expirado");
  await expect(page.locator(".admin-review [role=alert]")).toContainText(
    "condições de aprovação",
  );
  await expect(
    page.getByRole("button", { name: "Aprovar e publicar" }),
  ).toBeDisabled();
  await page.goto("/admin/anuncios/99999");
  await expect(
    page.getByRole("heading", { name: "Anúncio não encontrado" }),
  ).toBeVisible();
});
test("falha de rede exige conciliação e não reenvia aprovação", async ({
  page,
}, info) => {
  const id = info.project.name === "mobile" ? 204 : 104;
  await login(page);
  await page.goto(`/admin/anuncios/${id}`);
  await page
    .getByLabel("Selecionar anúncio de origem")
    .selectOption(String(id * 10 + 2));
  await expect(
    page.getByRole("link", { name: "Abrir anúncio original" }),
  ).toHaveCount(0);
  await page.getByLabel("Revisei os dados").check();
  await page.route(`**/api/admin/anuncios/${id}/approve`, (route) =>
    route.abort(),
  );
  await page.getByRole("button", { name: "Aprovar e publicar" }).click();
  await expect(page.locator(".admin-review [role=alert]")).toContainText(
    "pode ter sido concluída",
  );
  await expect(
    page.getByRole("button", { name: "Aprovar e publicar" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Atualizar detalhe" }).click();
  await expect(page.getByRole("status")).toContainText("Dados atualizados");
  await expect(page.getByLabel("Selecionar anúncio de origem")).toHaveValue("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("sessão expirada durante a revisão solicita novo login", async ({
  page,
  context,
}, info) => {
  const id = info.project.name === "mobile" ? 204 : 104;
  await login(page);
  await page.goto(`/admin/anuncios/${id}`);
  await page
    .getByLabel("Selecionar anúncio de origem")
    .selectOption(String(id * 10 + 1));
  await page.getByLabel("Revisei os dados").check();
  await context.addCookies([
    {
      name: "morada_session",
      value: "sessao-expirada",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.getByRole("button", { name: "Aprovar e publicar" }).click();
  await expect(page).toHaveURL("/auth/login");
  expect(
    (await context.cookies()).find((c) => c.name === "morada_session"),
  ).toBeUndefined();
});
