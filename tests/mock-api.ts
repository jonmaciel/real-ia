// Contrato isolado. Nunca importado pela aplicação de produção.
import { createServer } from "node:http";
import { categories, listings } from "../src/lib/fixtures";
const sessions = new Set<string>();
let counter = 0;
const adminTokens = new Set<string>();
const reviewRows = [101, 102, 103, 104, 201, 202, 203, 204].map((id) => ({
  id,
  category_id: 1,
  title: `Imóvel coletado ${id}`,
  city: "Curitiba",
  neighborhood: "Centro",
  region: "PR",
  country: "BR",
  listing_type: "sale",
  status: "draft",
  price: null,
  currency: "BRL",
  price_type: "fixed",
  availability: "unknown",
  description: null,
  structured_attributes: { reported_area_sqm: 82.5 },
  real_estate: null,
  publication_review: {} as Record<string, unknown>,
  sources: [
    {
      id: id * 10 + 1,
      source_id: 9,
      source_name: "Apolar teste",
      original_url: "https://example.com/original",
      lifecycle: "unverified",
      price: null,
      currency: "BRL",
      price_type: "fixed",
      availability: "unknown",
      last_observed_at: "2026-10-20T12:00:00Z",
      extraction_metadata: { reported_area_sqm: 82.5 },
      fingerprint: "v1",
    },
    {
      id: id * 10 + 2,
      source_id: 10,
      source_name: "Outra origem",
      original_url: "javascript:alert(1)",
      lifecycle: "active",
      price: null,
      currency: "BRL",
      price_type: "fixed",
      availability: "unknown",
      fingerprint: "other-v1",
      extraction_metadata: {},
    },
  ],
}));
const publishedRows = () => reviewRows.filter((p) => p.status === "published");
createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname
    .replace(/^\/contract-[0-9a-f-]+/, "")
    .replace("/api/v1/listings-platform", "");
  const send = (status: number, data?: unknown) => {
    res.statusCode = status;
    res.end(data === undefined ? "" : JSON.stringify(data));
  };
  let text = "";
  for await (const chunk of req) text += chunk;
  const b = text ? JSON.parse(text) : {};
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (path === "/categories") return send(200, { data: categories });
  if (path === "/search") {
    const city = url.searchParams.get("city");
    if (city?.startsWith("Erro"))
      return send(Number(city.slice(4)), { error: { code: "test_error" } });
    const allowed = [
      "category",
      "city",
      "neighborhood",
      "region",
      "country",
      "listing_type",
      "availability",
      "currency",
      "min_price",
      "max_price",
      "q",
      "sort",
      "page",
      "per_page",
    ];
    if (
      [...url.searchParams.keys()].some((k) => !allowed.includes(k)) ||
      url.searchParams.get("category") !== "real-estate"
    )
      return send(400, { error: { code: "invalid_request" } });
    const page = Number(url.searchParams.get("page") ?? 1);
    const per = Number(url.searchParams.get("per_page") ?? 20);
    const data = [...listings, ...publishedRows()].filter(
      (p) =>
        (!city || p.city === city) &&
        (!url.searchParams.get("listing_type") ||
          p.listing_type === url.searchParams.get("listing_type")) &&
        (!url.searchParams.get("neighborhood") ||
          p.neighborhood === url.searchParams.get("neighborhood")) &&
        (!url.searchParams.get("q") ||
          p.title.includes(url.searchParams.get("q")!)),
    );
    const sort = url.searchParams.get("sort");
    if (sort === "price_asc")
      data.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price_desc")
      data.sort((a, b) => Number(b.price) - Number(a.price));
    return send(200, {
      data: data.slice((page - 1) * per, page * per),
      meta: { page, per_page: per, has_more: data.length > page * per },
    });
  }
  const match = path.match(/^\/listings\/(\d+)(?:\/(sources|media))?$/);
  if (match) {
    const p = [...listings, ...publishedRows()].find(
      (p) => String(p.id) === match[1],
    );
    if (!p) return send(404, { error: { code: "not_found" } });
    return send(200, {
      data:
        match[2] === "media"
          ? []
          : match[2] === "sources"
            ? [
                {
                  id: 1,
                  original_url: "https://example.com/one",
                  price: "3500.00",
                  currency: "BRL",
                  last_observed_at: "2026-10-20",
                  source: { id: 1, name: "Fonte de teste A" },
                },
                {
                  id: 2,
                  original_url: "https://example.com/two",
                  price: "3700.00",
                  currency: "BRL",
                  source: { id: 2, name: "Fonte de teste B" },
                },
              ]
            : p,
    });
  }
  if (
    [
      "/auth/register",
      "/auth/verify",
      "/auth/password/forgot",
      "/auth/password/reset",
    ].includes(path)
  ) {
    if (b.token === "invalido")
      return send(422, { error: { code: "invalid_token" } });
    if (path === "/auth/register")
      return send(201, {
        data: { id: 1, name: b.name, email: b.email, role: "member" },
      });
    if (path === "/auth/password/reset") sessions.clear();
    return send(path.endsWith("forgot") ? 202 : 204);
  }
  if (path === "/auth/login") {
    if (b.email === "naoverificado@example.com")
      return send(403, { error: { code: "email_unverified" } });
    if (b.password !== "uma-senha-muito-segura")
      return send(401, { error: { code: "invalid_credentials" } });
    const token = `opaque-session-${++counter}`;
    sessions.add(token);
    if (b.email === "admin@example.com") adminTokens.add(token);
    return send(200, { data: { token, expires_in: 604800 } });
  }
  if (!token || !sessions.has(token))
    return send(401, { error: { code: "unauthorized" } });
  if (path.startsWith("/admin/listings")) {
    if (!adminTokens.has(token))
      return send(403, { error: { code: "forbidden" } });
    const m = path.match(/^\/admin\/listings\/(\d+)(?:\/(approve))?$/);
    if (m) {
      const row = reviewRows.find((p) => String(p.id) === m[1]);
      if (!row) return send(404, { error: { code: "not_found" } });
      if (m[2]) {
        if (req.method !== "POST") return send(405);
        if (
          typeof b.source_listing_id !== "string" ||
          typeof b.fingerprint !== "string"
        )
          return send(400, { error: { code: "invalid_request" } });
        const source = row.sources.find(
          (s) => String(s.id) === b.source_listing_id,
        );
        if (!source) return send(404, { error: { code: "not_found" } });
        if ((row.id === 102 || row.id === 202) && source.fingerprint === "v1") {
          source.fingerprint = "v2";
          row.title = `Imóvel atualizado ${row.id}`;
          return send(409, { error: { code: "review_outdated" } });
        }
        if (source.fingerprint !== b.fingerprint)
          return send(409, { error: { code: "review_outdated" } });
        if (row.id === 103 || row.id === 203) {
          row.status = "expired";
          source.lifecycle = "expired";
          return send(422, { error: { code: "listing_not_approvable" } });
        }
        row.status = "published";
        row.publication_review = {
          approved_by_id: 1,
          approved_at: "2026-10-20T12:00:00Z",
          source_listing_id: source.id,
          fingerprint: source.fingerprint,
        };
        const { sources, real_estate, ...published } = row;
        void sources;
        void real_estate;
        return send(200, { data: published });
      }
      return send(200, { data: row });
    }
    if (url.searchParams.get("city") === "Erro500")
      return send(500, { error: { code: "unavailable" } });
    const allowed = ["status", "city", "source_id", "page", "per_page"];
    if ([...url.searchParams.keys()].some((k) => !allowed.includes(k)))
      return send(400, { error: { code: "invalid_request" } });
    const page = Number(url.searchParams.get("page") ?? 1),
      per = Number(url.searchParams.get("per_page") ?? 20);
    const rows = reviewRows.filter(
      (p) =>
        p.status === (url.searchParams.get("status") ?? "draft") &&
        (!url.searchParams.get("city") ||
          p.city === url.searchParams.get("city")) &&
        (!url.searchParams.get("source_id") ||
          p.sources.some(
            (s) => String(s.source_id) === url.searchParams.get("source_id"),
          )),
    );
    return send(200, {
      data: rows.slice((page - 1) * per, page * per),
      meta: { page, per_page: per, has_more: rows.length > page * per },
    });
  }
  if (path === "/auth/logout") {
    sessions.delete(token);
    return send(204);
  }
  if (path === "/auth/rotate") {
    sessions.delete(token);
    const next = `opaque-session-${++counter}`;
    sessions.add(next);
    if (adminTokens.has(token)) adminTokens.add(next);
    return send(200, { data: { token: next, expires_in: 604800 } });
  }
  if (path === "/users/me") {
    if (req.method === "DELETE") {
      sessions.delete(token);
      return send(204);
    }
    return send(200, {
      data: {
        id: 1,
        name: b.name ?? "Ana",
        email: "ana@example.com",
        role: adminTokens.has(token) ? "admin" : "member",
        verified_at: "2026-10-20",
      },
    });
  }
  return send(404, { error: { code: "not_found" } });
}).listen(4010, "127.0.0.1");
