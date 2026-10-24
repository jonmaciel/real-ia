import { test, expect } from "@playwright/test";
import { assistantResponse } from "../assistant-fixtures";

test("resposta formata Markdown, mantém negrito na linha e resolve fontes conhecidas", async ({ page }) => {
  await page.route("**/api/assistente/mensagens", route => route.fulfill({ json: { data: assistantResponse({
    mode: "property", action: "answer", selected_listing_id: 2,
    answer: "### Custos do imóvel\n\nO anúncio informa **custo total de R$ 1.577,72 por mês** [source-2].\n\n- Aluguel: **R$ 1.200**\n- Seguro: *R$ 27,72*\n\n> Confirme as condições com o anunciante.\n\n| Item | Valor | Período | Condição |\n| --- | --- | --- | --- |\n| IPTU | R$ 120 | Anual | Conforme origem |\n\nUse `preço base` para comparar.\n\n```text\nUm bloco de código que pode ser mais largo que a janela da conversa no celular.\n```\n\n[Anúncio original](https://example.com/original) e [source-inexistente].",
    citations: [{ id: "source-2", url: "https://example.com/source-2", title: "Fonte do imóvel", kind: "listing" }],
  }) } }));
  await page.goto("/imovel/2/um-novo-capitulo-no-agua-verde");
  await page.getByRole("button", { name: "Abrir conversa com o Morada", exact: true }).click();
  await page.getByRole("button", { name: "Qual é o custo total?", exact: true }).click();
  const answer = page.locator(".question-answer .assistant-markdown");
  await expect(answer.getByRole("heading", { name: "Custos do imóvel", level: 3 })).toBeVisible();
  const bold = answer.locator("strong").first();
  await expect(bold).toHaveText("custo total de R$ 1.577,72 por mês");
  await expect(bold).toHaveCSS("display", "inline");
  await expect(answer.locator("ul > li")).toHaveCount(2);
  await expect(answer.locator("em")).toHaveText("R$ 27,72");
  await expect(answer.locator("blockquote")).toContainText("Confirme as condições");
  await expect(answer.getByRole("table")).toBeVisible();
  await expect(answer.locator("pre code")).toContainText("Um bloco de código");
  await expect(answer.getByRole("link", { name: "source-2", exact: true })).toHaveAttribute("href", "https://example.com/source-2");
  await expect(answer.getByRole("link", { name: "Anúncio original", exact: true })).toHaveAttribute("rel", "noopener noreferrer");
  await expect(answer).toContainText("[source-inexistente]");
  expect(await page.locator(".question-conversation").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Markdown não executa HTML, não carrega imagens externas e bloqueia links inseguros", async ({ page }) => {
  const trackingRequests: string[] = [];
  page.on("request", request => { if (request.url().includes("tracking.example")) trackingRequests.push(request.url()); });
  await page.route("**/api/assistente/mensagens", route => route.fulfill({ json: { data: assistantResponse({
    mode: "property", action: "answer", selected_listing_id: 2,
    answer: '<script>alert(1)</script>\n\n<img src="https://tracking.example/pixel" onerror="alert(1)">\n\n![Imagem externa](https://tracking.example/markdown)\n\n[JavaScript](javascript:alert%281%29) · [Dados](data:text/html,teste) · [Credenciais](https://user:password@example.com) · [Relativo](//example.com) · [source-insegura]\n\n[Link seguro](https://example.com/safe)',
    citations: [{ id: "source-insegura", url: "javascript:alert(1)", title: "Inválida", kind: "web" }],
  }) } }));
  await page.goto("/imovel/2/um-novo-capitulo-no-agua-verde");
  await page.getByRole("button", { name: "Abrir conversa com o Morada", exact: true }).click();
  await page.getByRole("button", { name: "Qual é o custo total?", exact: true }).click();
  const answer = page.locator(".question-answer .assistant-markdown");
  await expect(answer.getByRole("link")).toHaveCount(1);
  await expect(answer.getByRole("link", { name: "Link seguro" })).toHaveAttribute("target", "_blank");
  await expect(answer.locator("script, img, iframe")).toHaveCount(0);
  await expect(answer).toContainText("Imagem externa");
  await expect(answer).toContainText("[source-insegura]");
  expect(trackingRequests).toEqual([]);
});

test("busca formata somente a última clarificação e preserva a lista principal", async ({ page }) => {
  let count = 0;
  await page.route("**/api/assistente/mensagens", route => route.fulfill({ json: { data: assistantResponse({
    answer: ++count === 1 ? "Você prefere **comprar ou alugar**?" : "Qual é o seu **orçamento**?",
    applied_filters: { city: "Araucária", property_type: "house" },
  }) } }));
  await page.goto("/buscar?per_page=1");
  const input = page.getByLabel("O que você procura?");
  const status = page.locator(".search-ai-status");
  await input.fill("casa em Araucária"); await input.press("Enter");
  await expect(status.locator("strong")).toHaveText("comprar ou alugar");
  await expect(page.locator(".property-card")).toContainText("Casa para comprar em Araucária");
  await input.fill("alugar"); await input.press("Enter");
  await expect(status.locator("strong")).toHaveText("orçamento");
  await expect(status).not.toContainText("comprar ou alugar");
  await expect(status.locator(".assistant-markdown")).toHaveCount(1);
  await expect(page.locator(".property-grid")).toHaveCount(1);
  await expect(page.locator(".assistant-recommendations, .question-turn")).toHaveCount(0);
});
