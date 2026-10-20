import { test, expect, type Page } from "@playwright/test";
const picture =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900"><rect width="1400" height="900" fill="#d5dfcb"/><rect x="180" y="180" width="1040" height="600" fill="#f3eddd"/><path d="M160 180 L700 40 L1240 180Z" fill="#a5b493"/><rect x="350" y="330" width="250" height="300" fill="#758b76"/><rect x="840" y="330" width="180" height="450" fill="#b7a582"/><text x="70" y="850" fill="#254d40" font-size="32">Imagem sintética · teste de contrato</text></svg>';
async function images(page: Page) {
  await page.route("https://ik.imagekit.io/test/public-*.jpg", (r) =>
    r.fulfill({ contentType: "image/svg+xml", body: picture }),
  );
}
async function detail(page: Page) {
  await page.goto("/imovel/2/um-novo-capitulo-no-agua-verde");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Água Verde",
  );
}
test("carrossel mostra capa, contador, miniaturas e atalhos sem criar lista vertical", async ({
  page,
}, info) => {
  await images(page);
  await detail(page);
  await page.screenshot({
    path: info.outputPath("carousel.png"),
    fullPage: true,
  });
  const gallery = page.getByRole("region", {
    name: "Mídias do imóvel",
    exact: true,
  });
  await expect(
    gallery.locator(".property-carousel-slide").first().locator("img"),
  ).toHaveAttribute("src", /public-2.jpg$/);
  await expect(gallery.getByRole("status")).toContainText("1 de 8");
  await gallery
    .getByRole("button", { name: "Próxima imagem", exact: true })
    .click();
  await expect(gallery.getByRole("status")).toContainText("2 de 8");
  await gallery
    .getByRole("button", { name: "Ampliar foto 2", exact: true })
    .focus();
  await page.keyboard.press("End");
  await expect(gallery.getByRole("status")).toContainText("8 de 8");
  await expect(
    gallery.getByRole("button", { name: "Próxima imagem", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Home");
  await expect(gallery.getByRole("status")).toContainText("1 de 8");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    gallery.getByRole("link", { name: "Vídeo na origem" }),
  ).toHaveAttribute("target", "_blank");
  await expect(page.locator("iframe,video")).toHaveCount(0);
});
test("Ver todas abre álbum, filtro de plantas e fullscreen com retorno e foco", async ({
  page,
}, info) => {
  await images(page);
  await detail(page);
  await page
    .getByRole("button", { name: "Ver todas (8)", exact: true })
    .click();
  const album = page.getByRole("dialog", {
    name: "Conheça este lugar por inteiro.",
  });
  await expect(album).toBeVisible();
  await expect(album.locator(".album-grid figure")).toHaveCount(8);
  await page.screenshot({
    path: info.outputPath("album.png"),
    animations: "disabled",
  });
  await album.getByRole("button", { name: "Plantas", exact: true }).click();
  await expect(album.locator(".album-grid figure")).toHaveCount(1);
  await album
    .getByRole("button", { name: "Ampliar planta do imóvel", exact: true })
    .click();
  const viewer = page.getByRole("dialog", { name: "Imagem em tela cheia" });
  await expect(viewer).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: "Fechar imagem", exact: true }),
  ).toBeVisible();
  await expect(
    viewer.getByText("Fonte autorizada · contrato de teste").first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(album).toBeVisible();
  await expect(
    album.getByRole("button", { name: "Ampliar planta do imóvel" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(album).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ver todas (8)", exact: true }),
  ).toBeFocused();
});
test("ampliação direta tem navegação, zoom, foco contido e devolve seleção", async ({
  page,
}, info) => {
  await images(page);
  await detail(page);
  const open = page.getByRole("button", {
    name: "Ampliar capa · foto 1",
    exact: true,
  });
  await open.click();
  const viewer = page.getByRole("dialog", { name: "Imagem em tela cheia" });
  await expect(viewer).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: "Ampliar imagem", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("fullscreen.png"),
    animations: "disabled",
  });
  await viewer
    .getByRole("button", { name: "Próxima imagem", exact: true })
    .click();
  await expect(
    viewer.locator(".yarl__slide_description").filter({ hasText: "Foto 2" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  expect(
    await viewer.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator(".gallery-current")).toContainText("2 de 8");
  await expect(
    page.getByRole("button", { name: "Ampliar foto 2", exact: true }),
  ).toBeFocused();
});
test("imagem única quebrada e ausência de mídia mantêm detalhe utilizável", async ({
  page,
}) => {
  await page.route("https://ik.imagekit.io/test/broken.jpg", (r) => r.abort());
  await page.goto("/imovel/3/espaco-e-tranquilidade-no-cabral");
  await expect(page.locator(".gallery-broken").first()).toContainText(
    "Imagem indisponível",
  );
  await expect(
    page.getByRole("button", { name: "Próxima imagem", exact: true }),
  ).toHaveCount(0);
  await page.goto("/imovel/1/apartamento-com-varanda-no-batel");
  await expect(page.getByText("Nenhuma fotografia disponível.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Ver todas/ })).toHaveCount(0);
});
test("arrastar troca a imagem sem abrir a ampliação", async ({
  page,
}, info) => {
  await images(page);
  await detail(page);
  const viewport = page.locator(".property-carousel-viewport");
  await viewport.scrollIntoViewIfNeeded();
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Carrossel não disponível");
  const start = { x: box.x + box.width * 0.8, y: box.y + box.height * 0.5 },
    end = { x: box.x + box.width * 0.15, y: box.y + box.height * 0.5 };
  if (info.project.use.isMobile) {
    const touch = await page.context().newCDPSession(page);
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [start],
    });
    for (let step = 1; step <= 20; step++)
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: start.x + ((end.x - start.x) * step) / 20, y: start.y },
        ],
      });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await touch.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 20 });
    await page.mouse.up();
  }
  await expect(page.locator(".gallery-current")).toContainText("2 de 8");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
