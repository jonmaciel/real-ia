import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFilters, serialize } from "../src/lib/filters";
import { money, period, safeUrl, features } from "../src/lib/presentation";
import { listingSchema, searchSchema } from "../src/lib/contracts";
import { authSchemas } from "../src/lib/auth-contracts";
import { listings } from "../src/lib/fixtures";
test("apenas filtros permitidos; categoria forçada pelo adaptador", () => {
  const f = parseFilters({
    city: "São Paulo",
    bedrooms: "3",
    category: "vehicles",
    q: "varanda",
    page: "3",
  });
  const q = serialize(f, "real-estate");
  assert.equal(q.get("category"), "real-estate");
  assert.equal(q.has("bedrooms"), false);
  assert.equal(q.get("city"), "São Paulo");
  assert.equal(q.get("page"), "3");
});
test("rejeita filtros inválidos e repetidos", () => {
  for (const f of [
    { page: "1001" },
    { per_page: "101" },
    { q: "a".repeat(201) },
    { sort: "popular" },
    { city: ["A", "B"] },
    { min_price: "30", max_price: "20" },
    { min_price: "-1" },
  ])
    assert.throws(() => parseFilters(f));
});
test("preserva correspondência exata e valores monetários", () => {
  assert.equal(parseFilters({ city: "São Paulo" }).city, "São Paulo");
  assert.equal(
    money("1234567890123456.70", "BRL"),
    "R$ 1.234.567.890.123.456,70",
  );
  assert.equal(money(null), "Preço sob consulta");
  assert.equal(period("fixed"), "");
  assert.equal(period("monthly"), "/mês");
  assert.equal(money("10.00", "USD"), "USD 10,00");
});
test("URLs externas exigem HTTPS sem credenciais", () => {
  for (const u of [
    "javascript:alert(1)",
    "data:text/html,x",
    "http://example.com",
    "https://user:pass@example.com",
    "//example.com",
  ])
    assert.equal(safeUrl(u), null);
  assert.equal(safeUrl("https://example.com"), "https://example.com/");
});
test("campos opcionais ausentes e ausência de atributos não inventam conteúdo", () => {
  const p = listingSchema.parse({
    id: 1,
    category_id: 1,
    title: "Casa",
    listing_type: "rental",
  });
  assert.deepEqual(features(p), []);
  assert.equal(p.latitude, undefined);
  assert.equal(p.price, undefined);
  assert.deepEqual(features(listings[0]), ["3 quartos", "Varanda"]);
});
test("paginação exige has_more e não total", () => {
  assert.equal(
    searchSchema.parse({
      data: listings,
      meta: { page: 1, per_page: 20, has_more: false },
    }).meta.has_more,
    false,
  );
  assert.throws(() =>
    searchSchema.parse({ data: [], meta: { page: 1, per_page: 20, total: 0 } }),
  );
});
test("senha valida bytes, confirmação e tamanho", () => {
  const valid = {
    name: "Ana",
    email: "ana@example.com",
    password: "uma-senha-muito-segura",
    password_confirmation: "uma-senha-muito-segura",
  };
  assert.equal(authSchemas.register.safeParse(valid).success, true);
  assert.equal(
    authSchemas.register.safeParse({ ...valid, password: "curta" }).success,
    false,
  );
  assert.equal(
    authSchemas.register.safeParse({
      ...valid,
      password: "á".repeat(37),
      password_confirmation: "á".repeat(37),
    }).success,
    false,
  );
  assert.equal(
    authSchemas.register.safeParse({
      ...valid,
      password_confirmation: "outra-senha-grande",
    }).success,
    false,
  );
});
test("perfil aceita somente nome", () => {
  assert.equal(authSchemas.profile.safeParse({ name: "Ana" }).success, true);
  assert.equal(
    authSchemas.profile.safeParse({ name: "Ana", email: "outra@example.com" })
      .success,
    false,
  );
});
test("recursos futuros permanecem desativados", async () => {
  const { flags } = await import("../src/lib/presentation");
  assert.ok(Object.values(flags).every((v) => v === false));
});
test("senha conta caracteres Unicode, não unidades UTF-16", () => {
  assert.equal(
    authSchemas.reset.safeParse({
      token: "abc",
      password: "😀".repeat(6),
      password_confirmation: "😀".repeat(6),
    }).success,
    false,
  );
});
