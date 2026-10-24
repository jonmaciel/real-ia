import test from "node:test";
import assert from "node:assert/strict";
import { candidateSchema, photoBatches, MAX_IMAGE_BYTES, manualSchema } from "../src/lib/manual-contracts";
import { adminDetailSchema, parseAdminFilters, adminQuery } from "../src/lib/admin-contracts";
import { sourceSchema } from "../src/lib/contracts";
import { collectMediaPages } from "../src/lib/media-pages";
import { manualCandidate } from "./manual-fixtures";
test("cadastro preserva desconhecidos e exige objetos completos na substituição", () => {
  const data = manualCandidate(true);
  assert.equal(candidateSchema.parse(data).price, null);
  assert.equal(candidateSchema.parse(data).attributes.balcony, null);
  assert.equal(candidateSchema.safeParse({ ...data, status: "published" }).success, false);
  assert.equal(candidateSchema.partial().safeParse({ address: { street: "Rua" } }).success, false);
  assert.equal(candidateSchema.safeParse({ ...data, price: -1 }).success, false);
  assert.equal(candidateSchema.safeParse({ ...data, attributes: { ...data.attributes, bedrooms: 1.5 } }).success, false);
});
test("lotes não limitam a seleção e respeitam o limite do host sem descartar arquivos", () => {
  const files = Array.from({ length: 11 }, (_, id) => ({ id, size: MAX_IMAGE_BYTES }));
  const batches = photoBatches(files, 24 * 1024 * 1024);
  assert.deepEqual(batches.map(batch => batch.length), [4, 4, 3]);
  assert.deepEqual(batches.flat(), files);
  assert.deepEqual(photoBatches(files.map(file => ({ ...file, size: 2 * 1024 * 1024 })), 4 * 1024 * 1024 + 65536).map(batch => batch.length), [2, 2, 2, 2, 2, 1]);
  assert.throws(() => photoBatches(files, 4 * 1024 * 1024 + 65536), /request_too_large/);
});
test("admin aceita manual, rejeitado e modalidade desconhecida; fonte não inventa URL", () => {
  assert.match(adminQuery(parseAdminFilters({ status: "draft", creation_method: "manual_ai" })).toString(), /creation_method=manual_ai/);
  const detail = adminDetailSchema.parse({ id: 1, category_id: 1, title: "Imóvel", status: "rejected", listing_type: null, is_manual: true, sources: [{ id: 2, source_id: 3, source_name: "Manual", original_url: null, lifecycle: "unverified" }], missing_fields: ["price"] });
  assert.equal(detail.listing_type, ""); assert.equal(detail.sources[0].original_url, null);
  assert.equal(sourceSchema.parse({ id: 1, original_url: null, source: { id: 1, name: "Manual" } }).original_url, null);
  assert.equal(manualSchema.safeParse({ id: "not-a-uuid" }).success, false);
});
test("galeria pública percorre has_more, sem perder imagens ou entrar em loop", async () => {
  const calls: number[] = [];
  const result = await collectMediaPages(async page => { calls.push(page); return { data: [{ id: page, kind: "image", original_url: `https://ik.imagekit.io/${page}.jpg` }], meta: { page, has_more: page < 3 } }; });
  assert.deepEqual(calls, [1, 2, 3]); assert.equal(result.length, 3);
  await assert.rejects(collectMediaPages(async page => ({ data: [], meta: { page, has_more: true } })));
  await assert.rejects(collectMediaPages(async page => ({ data: [{ id: 1, kind: "image", original_url: "https://ik.imagekit.io/x.jpg" }], meta: { page, has_more: true } })));
});
