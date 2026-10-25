import { test, expect, type Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/auth/login");
  await page.getByLabel("E-mail").fill("admin@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("uma-senha-muito-segura");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL("/conta");
}
test("simula anúncio publicado e mantém a aprovação manual e o histórico", async ({ page }, info) => {
  const id = info.project.name === "mobile" ? 205 : 105;
  await login(page); await page.goto(`/admin/anuncios/${id}`);
  await expect(page.getByText("Pendente após análise da IA", { exact: true })).toBeVisible();
  await expect(page.getByText(/Pendências apontadas:.*Descrição/).first()).toBeVisible();
  const before = (await (await page.request.get(`/api/admin/anuncios/${id}`)).json()).data.publication_review;
  await page.getByLabel("Selecionar anúncio de origem").selectOption(String(id * 10 + 1));
  await page.getByRole("button", { name: "Simular revisão da IA", exact: true }).click();
  await expect(page.getByText("Simulação: Aprovado por IA", { exact: true }).first()).toBeVisible();
  const after = (await (await page.request.get(`/api/admin/anuncios/${id}`)).json()).data;
  expect(after.status).toBe("published"); expect(after.publication_review).toEqual(before);
  expect(after.automatic_review.applied).toBe(false); expect(after.review_history.length).toBe(2);
  await page.getByText(/Histórico de análises automáticas/).click();
  await expect(page.getByText("Pendente após análise da IA", { exact: true })).toBeVisible();
});
test("reavalia um rascunho e mostra aprovação e motivo da IA", async ({ page }, info) => {
  const id = info.project.name === "mobile" ? 206 : 106;
  await login(page); await page.goto(`/admin/anuncios/${id}`);
  await page.getByLabel("Selecionar anúncio de origem").selectOption(String(id * 10 + 1));
  await page.getByRole("button", { name: "Reavaliar com IA", exact: true }).click();
  await expect(page.getByText("Aprovado por IA", { exact: true }).first()).toBeVisible();
  const data = (await (await page.request.get(`/api/admin/anuncios/${id}`)).json()).data;
  expect(data.status).toBe("published"); expect(data.automatic_review.reason).toContain("Descrição é opcional");
});
test("fila e detalhe identificam rejeição da IA com motivo", async ({ page }, info) => {
  const id = info.project.name === "mobile" ? 207 : 107;
  await login(page); await page.goto("/admin/anuncios?status=rejected");
  await expect(page.getByText("Rejeitado por IA", { exact: true }).first()).toBeVisible();
  await page.goto(`/admin/anuncios/${id}`);
  await expect(page.getByText("Rejeitado por IA", { exact: true })).toBeVisible();
  await expect(page.getByText("Conteúdo explicitamente fictício.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reavaliar com IA", exact: true })).toHaveCount(0);
});
