import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { listings } from "../src/lib/fixtures";
import { listingMetadata, listingShareData, siteOrigin } from "../src/lib/seo";
import { previewPhoto, previewPhotoUrl } from "../src/lib/share-photo";
import { brandShareImage, propertyShareImage } from "../src/lib/share-image";

test("metadados do imóvel usam URL canônica, prévia própria e fatos mesmo sem descrição", () => {
  const p = { ...listings[0], description: null };
  const data = listingShareData(p);
  assert.match(data.description, /R\$ 3\.500,00\/mês/);
  assert.match(data.description, /Batel/);
  const metadata = listingMetadata(p);
  assert.equal(metadata.alternates?.canonical, `${siteOrigin()}${data.path}`);
  assert.match(JSON.stringify(metadata.openGraph), /opengraph-image/);
  assert.match(JSON.stringify(metadata.twitter), /summary_large_image/);
  assert.ok(!data.description.includes("não informou"));
});
test("prévia não inventa preço, taxas ou disponibilidade e ignora contatos da descrição", () => {
  const p = { ...listings[0], price: null, description: "E-mail privado@exemplo.com. Taxa R$ 500. Disponível!" };
  assert.equal(listingShareData(p).price, "Consulte o valor");
  assert.doesNotMatch(listingShareData(p).description, /privado|500|Disponível/);
  assert.equal(listingShareData({ ...p, price: "100", price_type: "on_request" }).price, "Sob consulta");
  assert.equal(siteOrigin(""), "https://real-ia.vercel.app");
  assert.equal(siteOrigin("https://morada.example/path?q=x"), "https://morada.example");
  assert.throws(() => siteOrigin("https://usuario:senha@morada.example"));
});
test("prévia só baixa capas HTTPS de hosts autorizados, sem credenciais ou portas alternativas", () => {
  assert.equal(previewPhotoUrl("https://ik.imagekit.io/real/capa.jpg"), "https://ik.imagekit.io/real/capa.jpg");
  for (const url of ["http://ik.imagekit.io/a.jpg", "https://evil.example/a.jpg", "https://ik.imagekit.io.evil.example/a.jpg", "https://u:p@ik.imagekit.io/a.jpg", "https://ik.imagekit.io:444/a.jpg", "file:///etc/passwd", "https://127.0.0.1/a.jpg", "https://localhost/a.jpg"])
    assert.equal(previewPhotoUrl(url), null, url);
});
test("download limitado normaliza foto e usa fallback em erros ou conteúdo indevido", async () => {
  const png = await sharp({ create: { width: 30, height: 30, channels: 3, background: "#316e73" } }).png().toBuffer();
  let calls = 0;
  const fetcher: typeof fetch = async (_url, init) => { calls++; assert.equal(init?.redirect, "error"); return new Response(png, { headers: { "content-type": "image/png" } }); };
  const photo = await previewPhoto("https://ik.imagekit.io/real/capa.png", fetcher);
  assert.match(photo!, /^data:image\/jpeg;base64,/);
  const decoded = await sharp(Buffer.from(photo!.split(",")[1], "base64")).metadata();
  assert.equal(decoded.width, 720); assert.equal(decoded.height, 630);
  assert.equal(await previewPhoto("https://evil.example/a.png", fetcher), null); assert.equal(calls, 1);
  assert.equal(await previewPhoto("https://ik.imagekit.io/a", async () => new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } })), null);
  assert.equal(await previewPhoto("https://ik.imagekit.io/a", async () => new Response("x", { headers: { "content-type": "image/png", "content-length": "5000001" } })), null);
  assert.equal(await previewPhoto("https://ik.imagekit.io/a", async () => { throw new Error("timeout"); }), null);
  assert.equal(await previewPhoto("https://ik.imagekit.io/a", async () => new Response(new Uint8Array(5_000_001), { headers: { "content-type": "image/png" } })), null);
  assert.equal(await previewPhoto("https://ik.imagekit.io/a", async () => new Response("corrompida", { headers: { "content-type": "image/jpeg" } })), null);
});
test("imagens de marca, imóvel com foto e fallback renderizam PNG 1200×630", async () => {
  const cover = await sharp({ create: { width: 720, height: 630, channels: 3, background: "#316e73" } }).jpeg().toBuffer();
  const photo = `data:image/jpeg;base64,${cover.toString("base64")}`;
  const responses = [brandShareImage(), await propertyShareImage(listings[0], async () => photo), await propertyShareImage(listings[0], async () => null)];
  for (const response of responses) {
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.format, "png"); assert.equal(metadata.width, 1200); assert.equal(metadata.height, 630);
    assert.ok(buffer.length < 1_000_000);
  }
});
