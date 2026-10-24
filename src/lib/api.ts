import "server-only";
import { cache } from "react";
import { z } from "zod";
import {
  categorySchema,
  listingSchema,
  searchSchema,
  sourceSchema,
} from "./contracts";
import { serialize, type Filters } from "./filters";
import * as fixtures from "./fixtures";
import { assistantResultsSchema, assistantSearchParams, type AssistantSearch } from "./assistant-search";
import { collectMediaPages } from "./media-pages";
export const demo = process.env.DEMO_MODE === "true";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code = "unavailable",
    public retryAfter?: string,
  ) {
    super(code);
  }
}
export function baseUrl() {
  return (
    process.env.LISTINGS_API_BASE_URL ??
    "http://localhost:3000/api/v1/listings-platform"
  ).replace(/\/$/, "");
}
export async function request(path: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(10000),
      redirect: "error",
      ...(init.headers || init.method
        ? { cache: "no-store" as const }
        : { next: { revalidate: 60, tags: ["listings-public"] } }),
    });
  } catch {
    throw new ApiError(503);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.error?.code, response.headers.get("Retry-After") ?? undefined);
  }
  if (response.status === 204 || response.status === 202) return null;
  return response.json();
}
export const getCategories = cache(async () =>
  demo
    ? fixtures.categories
    : z
        .object({ data: z.array(categorySchema) })
        .parse(await request("/categories")).data,
);
export const realEstateCategory = cache(async () => {
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === "real-estate");
  if (!category) throw new ApiError(503, "category_unavailable");
  return category;
});
export async function search(filters: Filters) {
  const category = await realEstateCategory();
  if (demo) {
    let data = fixtures.listings.filter(
      (p) =>
        (!filters.city || p.city === filters.city) &&
        (!filters.neighborhood || p.neighborhood === filters.neighborhood) &&
        (!filters.listing_type || p.listing_type === filters.listing_type) &&
        (!filters.currency || p.currency === filters.currency) &&
        (!filters.region || p.region === filters.region) &&
        (!filters.country || p.country === filters.country) &&
        (!filters.availability || p.availability === filters.availability) &&
        (!filters.q ||
          p.title.toLowerCase().includes(filters.q.toLowerCase())) &&
        (!filters.min_price || Number(p.price) >= Number(filters.min_price)) &&
        (!filters.max_price || Number(p.price) <= Number(filters.max_price)),
    );
    if (filters.sort !== "recent")
      data = data.toSorted(
        (a, b) =>
          (Number(a.price) - Number(b.price)) *
          (filters.sort === "price_asc" ? 1 : -1),
      );
    const start = (filters.page - 1) * filters.per_page;
    return {
      data: data.slice(start, start + filters.per_page),
      meta: {
        page: filters.page,
        per_page: filters.per_page,
        has_more: data.length > start + filters.per_page,
      },
    };
  }
  const result = searchSchema.parse(
    await request(`/search?${serialize(filters, category.slug)}`),
  );
  if (result.data.some((p) => String(p.category_id) !== String(category.id)))
    throw new ApiError(502, "category_mismatch");
  return result;
}
export async function assistantSearch(query: AssistantSearch) {
  // Exact assistant semantics; never fall back to the conventional search or fixtures.
  return assistantResultsSchema.parse(await request(`/assistant/results?${assistantSearchParams(query, false)}`, { headers: { Accept: "application/json" } }));
}
export const getListing = cache(async (id: string) => {
  const category = await realEstateCategory();
  const p = demo
    ? fixtures.listings.find((x) => String(x.id) === id)
    : z
        .object({ data: listingSchema })
        .parse(await request(`/listings/${encodeURIComponent(id)}`)).data;
  if (!p || String(p.category_id) !== String(category.id))
    throw new ApiError(404);
  return p;
});
export async function getSources(id: string) {
  return demo
    ? [
        {
          id: 1,
          original_url: "https://example.com",
          price: fixtures.listings.find((p) => String(p.id) === id)?.price,
          currency: "BRL",
          source: { id: 1, name: "Fonte fictícia · demonstração" },
        },
      ]
    : z
        .object({ data: z.array(sourceSchema) })
        .parse(await request(`/listings/${encodeURIComponent(id)}/sources`))
        .data;
}
export async function getMedia(id: string) {
  return demo
    ? []
    : collectMediaPages(page => request(`/listings/${encodeURIComponent(id)}/media?page=${page}&per_page=200`));
}
export function errorMessage(e: unknown, context: "catalog" | "auth" = "catalog") {
  if (e instanceof ApiError && e.code === "email_unverified")
    return "Seu e-mail ainda não foi verificado. Confirme seu e-mail para entrar.";
  if (e instanceof ApiError && e.code === "invalid_credentials")
    return "E-mail ou senha inválidos. Confira os dados informados.";
  if (e instanceof ApiError)
    return (
      (
        {
          400: context === "auth"
            ? "Confira os dados informados e tente novamente."
            : "Os filtros enviados são inválidos.",
          401: "Sua sessão expirou. Entre novamente.",
          403: "Acesso não autorizado. Confira a verificação do e-mail.",
          404: "Este recurso não está disponível.",
          422: "Confira os dados ou o token informado.",
          429: "Muitas tentativas. Aguarde antes de tentar novamente.",
        } as Record<number, string>
      )[e.status] ??
      "Não foi possível consultar a plataforma. Tente novamente em instantes."
    );
  return "Não foi possível validar os dados da plataforma. Tente novamente em instantes.";
}
