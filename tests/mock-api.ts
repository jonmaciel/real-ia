// Contrato isolado. Nunca importado pela aplicação de produção.
import { assistantResponse, recommendation } from "./assistant-fixtures";
import { assistantInputSchema } from "../src/lib/assistant-contracts";
import { parseAssistantSearch } from "../src/lib/assistant-search";
import { assistantCatalog } from "./assistant-search-fixtures";
import { createServer } from "node:http";
import { categories, listings } from "../src/lib/fixtures";
const sessions = new Set<string>();
let counter = 0;
let assistantCounter = 0;
const assistantSessions = new Map<string, { seen: number[]; filters: Record<string, unknown> }>();
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
  media:
    id === 101
      ? [
          {
            id: 1,
            hosted_url: "https://ik.imagekit.io/test/gallery-one.jpg",
            is_cover: false,
            position: 0,
            processing_status: "completed",
          },
          {
            id: 2,
            hosted_url: "https://ik.imagekit.io/test/gallery-cover.jpg",
            is_cover: true,
            position: 1,
            processing_status: "completed",
          },
        ]
      : [],
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
  if (path === "/assistant/results") {
    try {
      const query = parseAssistantSearch(Object.fromEntries(url.searchParams));
      const f = query.filters;
      if (f.city === "Erro404" || f.city === "Erro503") return send(Number(f.city.slice(4)), { error: { code: "unavailable" } });
      const data = assistantCatalog.filter(row => {
        const attrs: Record<string, unknown> = row.real_estate ?? {};
        const amount = f.price_basis === "total_monthly" ? row.pricing?.total_amount : row.price;
        return !query.excludedIds.includes(String(row.id)) && (!f.city || row.city === f.city) && (!f.listing_type || row.listing_type === f.listing_type)
          && (!f.property_type || attrs.property_type === f.property_type) && (f.furnished == null || attrs.furnished === f.furnished)
          && (f.bedrooms == null || Number(attrs.bedrooms) >= f.bedrooms) && (f.parking_spaces == null || Number(attrs.parking_spaces) >= f.parking_spaces)
          && (f.min_price == null || amount != null && Number(amount) >= Number(f.min_price)) && (f.max_price == null || amount != null && Number(amount) <= Number(f.max_price));
      });
      const start = (query.page - 1) * query.perPage;
      return send(200, { data: data.slice(start, start + query.perPage), meta: { page: query.page, per_page: query.perPage, total_count: data.length, has_more: start + query.perPage < data.length, applied_filters: f } });
    } catch { return send(400, { error: { code: "invalid_request" } }); }
  }
  if (path === "/assistant/messages" && req.method === "POST") {
    const parsed = assistantInputSchema.safeParse(b);
    if (!parsed.success) return send(400, { error: { code: "invalid_request" } });
    const input = parsed.data;
    if (input.question.startsWith("Erro")) {
      const status = Number(input.question.slice(4));
      if (status === 429) res.setHeader("Retry-After", "2");
      return send(status, { error: { code: "test_error" } });
    }
    if (input.question === "Token expirado" || input.search_token === "expired") return send(400, { error: { code: "invalid_search_token" } });
    const previous = input.search_token ? assistantSessions.get(input.search_token) : undefined;
    const filters = { currency:"BRL", price_basis:"base", sort:"recommended", ...(input.context?.current_filters ?? previous?.filters ?? {}) } as Record<string,unknown>;
    const seen = [...(previous?.seen ?? [])];
    const nextToken = `contract-token-${++assistantCounter}`;
    const q = input.question.toLowerCase();
    if (q.includes("curitiba")) filters.city = "Curitiba";
    if (/arauc[áa]ria/.test(q)) filters.city = "Araucária";
    if (q.includes("casa")) filters.property_type = "house";
    if (q.includes("alugar")) filters.listing_type = "rental";
    if (q.includes("comprar")) filters.listing_type = "sale";
    if (/3\.?000/.test(q)) filters.max_price = 3000;
    if (q.includes("dois quartos")) filters.bedrooms = 2;
    if (q.includes("pets")) filters.amenities = ["pet_friendly"];
    if (q.includes("garagem")) filters.parking_spaces = 1;
    if (q.includes("barato")) filters.sort = "price_asc";
    const alternatives = /outro|outra|alternativa|mais barato|mais opções|garagem/.test(q);
    if (alternatives && input.selected_listing_id) {
      const selected = listings.find(row => String(row.id) === String(input.selected_listing_id));
      filters.city ??= selected?.city; filters.listing_type ??= selected?.listing_type;
    }
    let result;
    if (input.selected_listing_id && !alternatives) {
      result = assistantResponse({mode:"property",action:"answer",selected_listing_id:input.selected_listing_id,answer:"Preço base informado pela origem. Taxas anuais e mensais devem ser consideradas separadamente. <script>alert(1)</script>",citations:[{id:"source-1",title:"Fonte do imóvel",url:"https://example.com/original",kind:"listing"},{id:"bad",title:"Inválida",url:"javascript:alert(1)",kind:"web"}],applied_filters:filters,search_token:nextToken});
    } else {
      if(input.selected_listing_id) seen.push(Number(input.selected_listing_id));
      if(!filters.city || !filters.listing_type) result=assistantResponse({answer: !filters.city ? "Em qual cidade você procura?" : "Você quer comprar ou alugar?",applied_filters:filters,search_token:nextToken});
      else if(q.includes("sem resultados")) result=assistantResponse({action:"no_results",answer:"Não encontrei novas opções para estes critérios.",applied_filters:filters,search_token:nextToken});
      else {
        const pool=[2,3,4,5,6,1].filter(id=>!seen.includes(id));
        const ids=pool.slice(0,3); seen.push(...ids);
        result=assistantResponse({action:ids.length ? "recommendations" : "no_results",answer:ids.length ? "Veja as opções do catálogo." : "Não encontrei novas opções.",recommendations:ids.map(recommendation),applied_filters:filters,unverified_preferences:["Proximidade de escola"],search_token:nextToken,has_more:pool.length>3,context_changed:!!input.selected_listing_id});
      }
    }
    assistantSessions.set(nextToken,{seen,filters});
    return send(200,{data:result});
  }
  if (/^\/listings\/[^/]+\/questions$/.test(path) && req.method === "POST") {
    if (b.question?.startsWith("Erro")) {
      const status = Number(b.question.slice(4));
      if (status === 429) res.setHeader("Retry-After", "2");
      return send(status, { error: { code: "test_error" } });
    }
    if (Object.keys(b).some(k => !["question", "history"].includes(k))) return send(400, { error: { code: "invalid_request" } });
    return send(200, { data: { answer: "Preço base informado pela origem. Taxas anuais e mensais devem ser consideradas separadamente. <script>alert(1)</script>", citations: [{ id: "source-1", title: "Fonte do imóvel", url: "https://example.com/original", kind: "listing" }, { id: "bad", title: "Inválida", url: "javascript:alert(1)", kind: "web" }], listing_id: path.split("/")[2], model: "gpt-6-luna", context_updated_at: "2026-10-23T12:00:00Z", web_search_used: false } });
  }
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
          ? match[1] === "2"
            ? [
                ...Array.from({ length: 8 }, (_, index) => ({
                  id: index + 100,
                  kind: index === 7 ? "floor_plan" : "image",
                  original_url: `https://ik.imagekit.io/test/public-${index}.jpg`,
                  is_cover: index === 2,
                  position: index,
                  width: index === 4 ? 800 : 1400,
                  height: index === 4 ? 1200 : 900,
                  attribution: "Fonte autorizada · contrato de teste",
                })),
                {
                  id: 200,
                  kind: "video",
                  original_url: "https://example.com/video",
                  attribution: "Fonte do vídeo",
                },
                {
                  id: 201,
                  kind: "document",
                  original_url: "https://example.com/documento",
                },
                {
                  id: 202,
                  kind: "image",
                  original_url: "https://unapproved.example/image.jpg",
                },
                { id: 203, kind: "image", original_url: "javascript:alert(1)" },
              ]
            : match[1] === "3"
              ? [
                  {
                    id: 300,
                    kind: "image",
                    original_url: "https://ik.imagekit.io/test/broken.jpg",
                  },
                ]
              : []
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
            : match[1] === "4"
              ? { ...p, latitude: "-25.43", longitude: "-49.27", description: "Imóvel sintético de contrato.\nTelefone: (41) 99999-1234\nEndereço: Rua de Teste, 123 - Curitiba" }
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
    if (b.email === "invalidrequest@example.com")
      return send(400, { error: { code: "invalid_request" } });
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
