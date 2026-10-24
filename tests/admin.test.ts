import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAdminFilters,
  adminQuery,
  approvalSchema,
  adminDetailSchema,
} from "../src/lib/admin-contracts";
import { features, money, availability } from "../src/lib/presentation";
test("fila administrativa envia apenas filtros confirmados e preserva cidade", () => {
  const f = parseAdminFilters({
    city: "São José dos Pinhais",
    bedrooms: "3",
    source_id: "123",
    page: "2",
  });
  assert.deepEqual(
    [...adminQuery(f).keys()],
    ["status", "city", "source_id", "page", "per_page"],
  );
  assert.equal(f.status, "draft");
  assert.equal(f.city, "São José dos Pinhais");
  for (const bad of [
    { status: "invalid" },
    { page: "1001" },
    { per_page: "101" },
    { source_id: "-1" },
    { city: ["A", "B"] },
  ])
    assert.throws(() => parseAdminFilters(bad));
});
test("aprovação exige strings e id do anúncio de origem", () => {
  assert.equal(
    approvalSchema.safeParse({
      source_listing_id: "123",
      fingerprint: "version",
    }).success,
    true,
  );
  assert.equal(
    approvalSchema.safeParse({ source_listing_id: 123, fingerprint: "version" })
      .success,
    false,
  );
  assert.equal(
    approvalSchema.safeParse({ source_id: "123", fingerprint: "version" })
      .success,
    false,
  );
  assert.equal(
    approvalSchema.safeParse({ source_listing_id: "123", fingerprint: "" })
      .success,
    false,
  );
});
test("detalhe incompleto preserva null e área informada não é área útil", () => {
  const p = adminDetailSchema.parse({
    id: 8,
    category_id: 1,
    title: "Casa",
    listing_type: "sale",
    status: "draft",
    price: null,
    availability: "unknown",
    real_estate: null,
    structured_attributes: { reported_area_sqm: 82.5 },
    publication_review: {},
    sources: [
      {
        id: 123,
        source_id: 9,
        source_name: "Apolar",
        original_url: "https://example.com",
        lifecycle: "unverified",
        price: null,
        fingerprint: "v1",
      },
    ],
  });
  assert.equal(p.price, null);
  assert.equal(money(p.price), "Preço não informado");
  assert.equal(availability(p.availability), "Disponibilidade não confirmada");
  assert.deepEqual(features(p), ["Área informada: 82,5 m²"]);
  assert.equal(p.sources[0].id, 123);
  assert.equal(p.sources[0].source_id, 9);
});

test("prévias administrativas limitam a três fotos processadas, capa primeiro e URLs seguras", async () => {
  const { reviewPreviews } = await import("../src/lib/admin-previews");
  const photos = [0, 1, 2, 3].map(index => ({ id: index + 1, is_cover: index === 2, position: index, hosted_url: `https://ik.imagekit.io/test/${index}.jpg`, processing_status: "completed", attribution: "Origem" }));
  const previews = reviewPreviews([
    { ...photos[0], id: 10, hosted_url: "javascript:alert(1)", is_cover: true },
    { ...photos[0], id: 11, hosted_url: "https://untrusted.example/a.jpg", is_cover: true },
    { ...photos[0], id: 12, hosted_url: "https://user:pass@ik.imagekit.io/a.jpg", is_cover: true },
    { ...photos[0], id: 13, hosted_url: "http://ik.imagekit.io/a.jpg", is_cover: true },
    { ...photos[0], id: 14, processing_status: "pending", is_cover: true },
    ...photos,
  ]);
  assert.deepEqual(previews.map(photo => photo.id), ["3", "1", "2"]);
  assert.equal(previews[0].attribution, "Origem");
  assert.deepEqual(reviewPreviews(), []);
});
