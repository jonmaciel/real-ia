import { test, expect } from "@playwright/test";

test("detalhe exibe aluguel, desconto, taxas e total da origem sem somar novamente", async ({ page }, info) => {
  await page.goto("/imovel/701/imovel-com-composicao-de-custos");
  const panel = page.locator(".detail-sidebar .price-panel");
  await expect(panel.locator(".property-price")).toContainText("R$ 1.200,00");
  await expect(panel.getByText("Condomínio, IPTU e outras taxas não informados.", { exact: false })).toHaveCount(0);
  const rows = panel.locator(".cost-breakdown > div");
  await expect(rows).toHaveText([
    "Aluguel brutoR$ 1.500,00/mês", "Desconto condicionadoR$ 300,00/mês", "Aluguel com descontoR$ 1.200,00/mês",
    "CondomínioR$ 350,00/mês", "Seguro incêndioR$ 27,72/mês",
  ]);
  await expect(panel.getByText("IPTU", { exact: true })).toHaveCount(0);
  await expect(panel.getByText("Taxa de limpeza", { exact: true })).toHaveCount(0);
  await expect(panel.locator(".cost-condition")).toContainText("Pagamento em dia");
  await expect(panel.locator(".cost-total")).toHaveText("Total informado pela origemR$ 1.577,72/mês");
  await expect(panel).toContainText("sem somar as taxas novamente");
  await expect(panel).toContainText("Disponibilidade não confirmada");
  await panel.locator(".cost-total").scrollIntoViewIfNeeded();
  await panel.screenshot({ path: info.outputPath("cost-breakdown.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("custos incompletos e legado não viram zero ou total estimado", async ({ page }) => {
  await page.goto("/imovel/702/imovel-com-custos-parciais");
  const costs = page.locator(".detail-sidebar .property-costs");
  await expect(costs.locator(".cost-breakdown > div")).toHaveText([
    "CondomínioNão informado", "IPTUR$ 120,00/ano", "Taxa administrativaR$ 10,00 · periodicidade não informada",
  ]);
  await expect(costs.locator(".cost-total")).toHaveText("Total não informado");
  await expect(costs.locator(".cost-total strong")).toHaveCount(0);
  await page.goto("/imovel/703/imovel-antigo-sem-composicao");
  await expect(page.locator(".detail-sidebar .property-price")).toHaveText("Preço não informado");
  await expect(costs.locator(".cost-total")).toHaveText("Total não informado");
  await expect(costs.locator(".cost-breakdown")).toHaveCount(0);
});

test("taxas zeradas não exibem linhas, nomes ou seção vazia de cobranças", async ({ page }) => {
  await page.goto("/imovel/705/imovel-com-taxas-zeradas");
  const costs = page.locator(".detail-sidebar .property-costs");
  await expect(costs.locator(".cost-breakdown")).toHaveCount(0);
  await expect(costs.getByRole("heading", { name: "Preço e taxas" })).toHaveCount(0);
  await expect(costs.getByText("Condomínio", { exact: true })).toHaveCount(0);
  await expect(costs.getByText("IPTU", { exact: true })).toHaveCount(0);
  await expect(costs.locator(".cost-total")).toHaveText("Total não informado");
  await expect(costs).toContainText("Confirme se existem outras despesas.");
  await expect(page.locator(".detail-sidebar .property-price")).toContainText("R$ 1.200,00");
});

test("compra mantém IPTU anual e condomínio mensal separados do preço de venda", async ({ page }) => {
  await page.goto("/imovel/704/imovel-para-compra-com-despesas");
  const panel = page.locator(".detail-sidebar .price-panel");
  await expect(panel.locator(".property-price")).toHaveText("R$ 685.000,00");
  await expect(panel.locator(".cost-breakdown > div")).toHaveText(["CondomínioR$ 350,00/mês", "IPTUR$ 1.200,00/ano"]);
  await expect(panel.locator(".cost-total")).toHaveText("Total não informado");
  await expect(panel).toContainText("despesas separadas do preço de compra");
});

test("fontes preservam preços e periodicidades independentes", async ({ page }) => {
  await page.goto("/imovel/701/imovel-com-composicao-de-custos");
  const sources = page.locator(".source-row");
  await expect(sources).toHaveCount(2);
  await sources.nth(0).getByText("Preço e taxas desta origem", { exact: true }).click();
  await sources.nth(1).getByText("Preço e taxas desta origem", { exact: true }).click();
  await expect(sources.nth(0).getByText("IPTU", { exact: true })).toHaveCount(0);
  await expect(sources.nth(0).getByText("Taxa de limpeza", { exact: true })).toHaveCount(0);
  await expect(sources.nth(0).locator(".cost-total")).toHaveText("Total informado pela origemR$ 1.577,72/mês");
  await expect(sources.nth(1).locator(".cost-breakdown > div")).toHaveText(["IPTUR$ 120,00/ano"]);
  await expect(sources.nth(1).locator(".cost-total")).toHaveText("Total não informado");
  await expect(sources.nth(1).getByRole("link", { name: "Ver anúncio original" })).toHaveAttribute("href", "https://example.com/two");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
