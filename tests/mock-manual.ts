// Private, deterministic contract simulation. Never imported by application code.
import { randomUUID, createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { candidateSchema, type Candidate, type ManualPhoto, type ManualSubmission } from "../src/lib/manual-contracts";
import { manualCandidate } from "./manual-fixtures";
type Row = ManualSubmission & { owner: string; key: string; digest: string; photos: (ManualPhoto & { hash: string })[]; version: number; attempts: number; uploadAttempts: number; listingId: number };
const rows = new Map<string, Row>();
let nextId = 90000;
let observation: Record<string, unknown>[] = [];
function missing(row: Row) {
  const c = candidateSchema.safeParse(row.extraction); if (!c.success) return [];
  const data = c.data;
  return [!data.listing_type && "listing_type", !data.property_type && "property_type", !data.city && "city", (!data.price || data.price_type === "on_request") && "price", (!data.neighborhood && !data.address.street) && "location", (!data.contact.phone && !data.contact.mobile && !data.contact.email) && "contact", !row.photos.some(photo => photo.hosted_url) && "photo"].filter((key): key is string => typeof key === "string");
}
function snapshot(row: Row) {
  return { id: row.id, prompt: row.prompt, transcription: row.transcription, status: row.status, images_count: row.photos.length, uploaded_images_count: row.photos.filter(photo => photo.hosted_url).length, analyzed_images_count: row.photos.filter(photo => photo.analyzed).length, cover_photo_id: row.cover_photo_id ?? row.photos[0]?.id ?? null, needs_more_processing: row.status === "processing", error_code: row.error_code, extraction: row.extraction, listing: row.listing, missing_fields: missing(row), limits: { images_per_upload: 4, image_max_bytes: 5242880, audio_max_bytes: 4194304, images_per_analysis: 8 } };
}
function listing(row: Row) {
  const data = row.extraction as Candidate;
  const pricing = { ...data.pricing, ...Object.fromEntries(["base_amount", "gross_amount", "discount_amount", "total_amount"].map(key => [key, data.pricing[key as keyof Candidate["pricing"]] === null ? null : String(data.pricing[key as keyof Candidate["pricing"]])])), charges: data.pricing.charges.map(charge => ({ ...charge, amount: charge.amount === null ? null : String(charge.amount) })) };
  return { id: row.listingId, title: data.title ?? "Imóvel cadastrado manualmente", category_id: 1, listing_type: data.listing_type, description: data.description, price: data.price === null ? null : String(data.price), currency: data.currency, price_type: data.price_type, pricing, availability: "unknown", city: data.city, neighborhood: data.neighborhood, region: data.region, country: data.country, address: data.address, structured_attributes: data.attributes, status: row.listing?.status ?? "draft", is_manual: true, creation_method: "manual_ai", updated_at: `2026-10-24T12:00:${String(row.version).padStart(2, "0")}Z`, publication_review: {}, real_estate: data.property_type ? { property_type: data.property_type } : null };
}
function source(row: Row) {
  const data = listing(row);
  return { id: row.listingId * 10, source_id: 999, source_name: "Cadastro manual Morada", original_url: null, lifecycle: "unverified", price: data.price, currency: data.currency, price_type: data.price_type, pricing: data.pricing, contact: (row.extraction as Candidate).contact, address: (row.extraction as Candidate).address, fingerprint: `manual-v${row.version}`, availability: "unknown", extraction_metadata: { method: "manual_ai" } };
}
function detail(row: Row) {
  return { ...listing(row), sources: [source(row)], missing_fields: missing(row), manual_intake: { public_id: row.id, status: row.status, prompt: row.prompt, transcript: row.transcription, extraction: row.extraction }, media: row.photos.slice(0, 200).map(photo => ({ ...photo, processing_status: photo.hosted_url ? "completed" : "pending" })), media_has_more: row.photos.length > 200 };
}
export function manualPublished() { return [...rows.values()].filter(row => row.listing?.status === "published").map(listing); }
export async function mockManual(path: string, url: URL, req: IncomingMessage, res: ServerResponse, bytes: Buffer, token: string | undefined, sessions: Set<string>, admins: Set<string>, unverified: Set<string>) {
  const send = (status: number, data?: unknown) => { res.statusCode = status; res.end(JSON.stringify(data)); return true; };
  const error = (status: number, code: string, fields?: string[]) => send(status, { error: { code, ...(fields ? { missing_fields: fields } : {}) }, provider_debug: "PRIVATE_PROVIDER_DETAIL" });
  if (path === "/__manual-reset") { rows.clear(); observation = []; return send(200, {}); }
  if (path === "/__manual-observation") return send(200, observation);
  if (path === "/__manual-seed" && token && sessions.has(token)) {
    const body = JSON.parse(bytes.toString()); const id = randomUUID(); const count = body.count ?? 205;
    const row: Row = { id, owner: token, key: randomUUID(), digest: "seed", prompt: "Entrada privada para conferência", transcription: null, status: "ready", images_count: count, uploaded_images_count: count, analyzed_images_count: count, needs_more_processing: false, error_code: null, extraction: manualCandidate(), listing: null, missing_fields: [], limits: { images_per_upload: 4, image_max_bytes: 5242880, audio_max_bytes: 4194304, images_per_analysis: 8 }, photos: Array.from({ length: count }, (_, i) => ({ id: i + 1, position: i, analyzed: true, hosted_url: `https://ik.imagekit.io/test/manual-${i}.jpg`, is_cover: i === 0, hash: String(i) })), version: 1, attempts: 0, uploadAttempts: 0, listingId: ++nextId };
    row.listing = { id: row.listingId, title: "Casa enviada pelo anunciante", creation_method: "manual_ai", status: "draft" }; rows.set(id, row); return send(200, { id, listingId: row.listingId });
  }
  if (path === "/admin/listings" && url.searchParams.get("creation_method") === "manual_ai") {
    if (!token || !sessions.has(token)) return error(401, "unauthorized"); if (!admins.has(token)) return error(403, "forbidden");
    const page = Number(url.searchParams.get("page") ?? 1), per = Number(url.searchParams.get("per_page") ?? 20);
    const data = [...rows.values()].filter(row => row.listing && row.listing.status === (url.searchParams.get("status") ?? "draft") && (!url.searchParams.get("city") || (row.extraction as Candidate).city === url.searchParams.get("city")));
    return send(200, { data: data.slice((page - 1) * per, page * per).map(listing), meta: { page, per_page: per, has_more: data.length > page * per } });
  }
  const adm = /^\/admin\/listings\/(9\d{4,})(?:\/(approve|reject|reopen))?$/.exec(path);
  if (adm) {
    if (!token || !sessions.has(token)) return error(401, "unauthorized"); if (!admins.has(token)) return error(403, "forbidden");
    const row = [...rows.values()].find(row => row.listingId === Number(adm[1])); if (!row) return error(404, "not_found");
    if (req.method === "GET") return send(200, { data: detail(row) });
    const body = JSON.parse(bytes.toString()); observation.push({ action: adm[2] ?? "patch", body });
    if (body.fingerprint !== `manual-v${row.version}`) return error(409, "review_outdated");
    if (req.method === "PATCH") {
      if (row.listing?.status !== "draft") return error(409, "listing_not_editable");
      const parsed = candidateSchema.safeParse({ ...row.extraction, ...body.fields }); if (!parsed.success) return error(422, "invalid_manual_fields");
      row.extraction = parsed.data; row.version++; return send(200, { data: listing(row) });
    }
    if (typeof body.source_listing_id !== "string" || body.source_listing_id !== String(row.listingId * 10)) return error(400, "invalid_request");
    if (adm[2] === "approve") { if (row.listing?.status !== "draft") return error(422, "listing_not_approvable"); if (missing(row).length) return error(422, "manual_listing_incomplete", missing(row)); row.listing!.status = "published"; }
    if (adm[2] === "reject") row.listing!.status = "rejected";
    if (adm[2] === "reopen") row.listing!.status = "draft";
    return send(200, { data: listing(row) });
  }
  const pub = /^\/listings\/(9\d{4,})(?:\/(sources|media))?$/.exec(path);
  if (pub) {
    const row = [...rows.values()].find(row => row.listingId === Number(pub[1]) && row.listing?.status === "published"); if (!row) return error(404, "not_found");
    if (pub[2] === "sources") return send(200, { data: [{ ...source(row), source: { id: 999, name: "Cadastro manual Morada" } }] });
    if (pub[2] === "media") { const page = Number(url.searchParams.get("page") ?? 1), per = Number(url.searchParams.get("per_page") ?? 200); observation.push({ action: "public-media", page }); return send(200, { data: row.photos.slice((page - 1) * per, page * per).map(photo => ({ id: photo.id, original_url: photo.hosted_url, is_cover: photo.is_cover, position: photo.position, kind: "image" })), meta: { page, per_page: per, has_more: row.photos.length > page * per } }); }
    const { status, is_manual, publication_review, ...data } = listing(row); void status; void is_manual; void publication_review; return send(200, { data });
  }
  if (!path.startsWith("/manual-listings")) return false;
  if (!token || !sessions.has(token)) return error(401, "unauthorized");
  if (unverified.has(token)) return error(403, "email_not_verified");
  let body: Record<string, unknown> = {};
  let form: FormData | null = null;
  if (req.headers["content-type"]?.startsWith("multipart/form-data")) { form = await new Request("http://localhost", { method: "POST", headers: { "Content-Type": req.headers["content-type"] }, body: new Uint8Array(bytes).buffer }).formData(); }
  else if (bytes.length) body = JSON.parse(bytes.toString());
  if (path === "/manual-listings") {
    const key = String(form?.get("request_key") ?? body.request_key); const prompt = String(form?.get("prompt") ?? body.prompt ?? ""); const audio = form?.get("audio");
    if (audio instanceof File && audio.size > 4194304) return error(413, "audio_too_large");
    const digest = createHash("sha256").update(prompt).update(audio instanceof File ? new Uint8Array(await audio.arrayBuffer()) : "").digest("hex");
    observation.push({ action: "create", request_key: key, fields: form ? [...form.keys()] : Object.keys(body), sha256: createHash("sha256").update(bytes).digest("hex"), contentType: req.headers["content-type"] });
    const existing = [...rows.values()].find(row => row.key === key && row.owner === token); if (existing) return existing.digest === digest ? send(201, { data: snapshot(existing) }) : error(409, "idempotency_conflict");
    const id = randomUUID(); const row: Row = { id, key, prompt, digest, owner: token, transcription: audio instanceof File ? "Casa com três quartos em Araucária para alugar." : null, status: "collecting", images_count: 0, uploaded_images_count: 0, analyzed_images_count: 0, needs_more_processing: false, extraction: {}, listing: null, missing_fields: [], limits: { images_per_upload: 4, image_max_bytes: 5242880, audio_max_bytes: 4194304, images_per_analysis: 8 }, photos: [], version: 1, attempts: 0, uploadAttempts: 0, listingId: ++nextId };
    rows.set(id, row); return send(201, { data: snapshot(row) });
  }
  const match = /^\/manual-listings\/([^/]+)(?:\/(photos|cover|process)(?:\/(\d+))?)?$/.exec(path);
  const row = match ? rows.get(match[1]) : undefined;
  if (!row || (row.owner !== token && !admins.has(token))) return error(404, "not_found");
  if (!match![2]) return send(200, { data: snapshot(row) });
  if (match![2] === "photos" && req.method === "GET") { const page = Number(url.searchParams.get("page") ?? 1), per = Number(url.searchParams.get("per_page") ?? 100); return send(200, { data: row.photos.slice((page - 1) * per, page * per).map(photo => ({ ...photo, is_cover: String(row.cover_photo_id ?? row.photos[0]?.id) === String(photo.id) })), meta: { page, per_page: per, has_more: row.photos.length > page * per, total_count: row.photos.length } }); }
  if (row.listing && row.listing.status !== "draft") return error(409, "listing_not_editable");
  if (match![2] === "cover") { if (row.status === "processing") return error(409, "submission_processing"); row.cover_photo_id = String(body.photo_id); row.version++; return send(200, { data: snapshot(row) }); }
  if (match![2] === "photos" && req.method === "DELETE") { if (row.status !== "collecting") return error(409, "submission_processing"); row.photos = row.photos.filter(photo => String(photo.id) !== match![3]); return send(200, { data: snapshot(row) }); }
  if (match![2] === "photos") {
    if (row.status === "processing") return error(409, "submission_processing");
    const images = form?.getAll("images[]") ?? []; if (!images.length || images.length > 4) return error(400, "invalid_request");
    observation.push({ action: "photos", count: images.length, sha256: createHash("sha256").update(bytes).digest("hex"), contentType: req.headers["content-type"] });
    row.uploadAttempts++;
    for (const image of images) {
      if (!(image instanceof File)) return error(400, "invalid_request"); if (image.size > 5242880) return error(413, "image_too_large"); if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) return error(415, "unsupported_image_type");
      const hash = createHash("sha256").update(new Uint8Array(await image.arrayBuffer())).digest("hex"); if (row.photos.some(photo => photo.hash === hash)) continue;
      row.photos.push({ id: row.photos.length + 1, hosted_url: `https://ik.imagekit.io/test/manual-${row.photos.length}.jpg`, analyzed: false, is_cover: false, position: row.photos.length, hash });
      if (row.prompt.includes("falha-upload") && row.uploadAttempts === 1) return error(502, "image_upload_failed");
    }
    row.status = "collecting"; return send(200, { data: snapshot(row) });
  }
  if (match![2] === "process") {
    observation.push({ action: "process", bytes: bytes.length }); row.attempts++;
    if (row.prompt.includes("quota") && row.attempts === 1) { res.setHeader("Retry-After", "2"); return error(429, "rate_limited"); }
    if (row.prompt.includes("busy") && row.attempts === 1) return error(409, "submission_busy");
    if (row.prompt.includes("timeout") && row.attempts === 1) return error(504, "ai_timeout");
    if (row.status === "ready") return send(200, { data: snapshot(row) });
    row.photos.filter(photo => !photo.analyzed).slice(0, 8).forEach(photo => { photo.analyzed = true; });
    row.extraction = manualCandidate(row.prompt.includes("sem detalhes")); row.status = row.photos.some(photo => !photo.analyzed) ? "processing" : "ready";
    if (row.status === "ready") row.listing = { id: row.listingId, title: "Casa enviada pelo anunciante", status: "draft", creation_method: "manual_ai" };
    return send(200, { data: snapshot(row) });
  }
  return error(404, "not_found");
}
