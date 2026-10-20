// Contrato isolado. Nunca importado pela aplicação de produção.
import { createServer } from "node:http";
import { categories, listings } from "../src/lib/fixtures";
const sessions = new Set<string>();
let counter = 0;
createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname.replace("/api/v1/listings-platform", "");
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
    let data = listings.filter(
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
    const p = listings.find((p) => String(p.id) === match[1]);
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
    return send(200, { data: { token, expires_in: 604800 } });
  }
  if (!token || !sessions.has(token))
    return send(401, { error: { code: "unauthorized" } });
  if (path === "/auth/logout") {
    sessions.delete(token);
    return send(204);
  }
  if (path === "/auth/rotate") {
    sessions.delete(token);
    const next = `opaque-session-${++counter}`;
    sessions.add(next);
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
        role: "member",
        verified_at: "2026-10-20",
      },
    });
  }
  return send(404, { error: { code: "not_found" } });
}).listen(4010, "127.0.0.1");
