import { z } from "zod";
import { id } from "./contracts";
import { audioErrorMessage } from "./assistant-audio";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const uuid = z.string().uuid();
export const propertyTypes = ["apartment", "house", "townhouse", "studio", "land", "commercial", "rural"] as const;
export const chargePeriods = ["monthly", "yearly", "one_off", "unknown"] as const;
const text = (max = 200) => z.string().max(max).nullable();
const amount = z.number().finite().min(0).max(1e12).nullable();
export const countKeys = ["bedrooms", "suites", "bathrooms", "parking_spaces", "floor", "total_floors", "construction_year"] as const;
export const amountKeys = ["usable_area_sqm", "built_area_sqm", "land_area_sqm", "total_area_sqm", "condominium_fee", "property_tax", "other_recurring_charges"] as const;
export const featureKeys = ["balcony", "barbecue", "swimming_pool", "garden", "elevator", "air_conditioning", "pet_friendly", "gym", "playground", "gated_community", "furnished"] as const;
export const candidateSchema = z.object({
  title: text(300), description: text(5000), listing_type: z.enum(["sale", "rental"]).nullable(),
  property_type: z.enum(propertyTypes).nullable(), price: amount, currency: text(3),
  price_type: z.enum(["fixed", "monthly", "yearly", "on_request"]).nullable(),
  city: text(), neighborhood: text(), region: text(), country: text(2),
  latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(),
  address: z.object({ street: text(), number: text(), complement: text(), postal_code: text() }).strict(),
  contact: z.object({ agency_name: text(254), creci: text(254), phone: text(254), mobile: text(254), email: text(254), website: text(2000), whatsapp_url: text(2000) }).strict(),
  attributes: z.object({
    ...Object.fromEntries(countKeys.map(key => [key, z.number().int().min(key === "floor" ? -20 : 0).max(10000).nullable()])),
    ...Object.fromEntries(amountKeys.map(key => [key, amount])),
    ...Object.fromEntries(featureKeys.map(key => [key, z.boolean().nullable()])),
  }).strict(),
  pricing: z.object({ base_amount: amount, gross_amount: amount, discount_amount: amount, total_amount: amount,
    discount_condition: text(), total_period: z.enum(chargePeriods).nullable(),
    charges: z.array(z.object({ code: z.string().max(50), label: z.string().max(100), amount, period: z.enum(chargePeriods) }).strict()).max(30),
  }).strict(),
  warnings: z.array(z.string().max(300)).max(20),
}).strict();
export type Candidate = z.infer<typeof candidateSchema>;
export const manualSchema = z.object({
  id: uuid, status: z.enum(["collecting", "processing", "ready"]), prompt: z.string(), transcription: z.string().nullish(),
  images_count: z.number().int().nonnegative(), uploaded_images_count: z.number().int().nonnegative(), analyzed_images_count: z.number().int().nonnegative(),
  cover_photo_id: id.nullish(), needs_more_processing: z.boolean(), error_code: z.string().nullish(),
  extraction: z.record(z.string(), z.unknown()),
  listing: z.object({ id, title: z.string(), status: z.string(), creation_method: z.string() }).passthrough().nullish(),
  missing_fields: z.array(z.string()),
  limits: z.object({ images_per_upload: z.number().int().positive().max(4), image_max_bytes: z.number().positive(), audio_max_bytes: z.number().positive(), images_per_analysis: z.number().int().positive().max(8) }),
}).superRefine((value, context) => {
  if ((value.status === "ready" || Object.keys(value.extraction).length > 0) && !candidateSchema.safeParse(value.extraction).success) context.addIssue({ code: "custom", path: ["extraction"], message: "Invalid structured extraction" });
  if (value.status === "ready" && !value.listing) context.addIssue({ code: "custom", path: ["listing"], message: "Ready intake requires a draft" });
});
export type ManualSubmission = z.infer<typeof manualSchema>;
export const manualResponse = z.object({ data: manualSchema });
export const manualPhotoSchema = z.object({ id, hosted_url: z.string().nullish(), position: z.number().int().nonnegative(), analyzed: z.boolean(), is_cover: z.boolean() });
export type ManualPhoto = z.infer<typeof manualPhotoSchema>;
export const manualPhotosResponse = z.object({ data: z.array(manualPhotoSchema), meta: z.object({ page: z.number().int().positive(), per_page: z.number().int().positive(), has_more: z.boolean(), total_count: z.number().int().nonnegative() }) });
export const missingLabels: Record<string, string> = { processing_complete: "Análise concluída", listing_type: "Comprar ou alugar", property_type: "Tipo de imóvel", city: "Cidade", price: "Preço positivo e periodicidade", location: "Bairro ou endereço", contact: "Telefone ou e-mail de contato", photo: "Ao menos uma foto enviada" };
export const fieldLabels: Record<string, string> = {
  title: "Título", description: "Descrição", listing_type: "Finalidade", property_type: "Tipo de imóvel", price: "Preço anunciado", currency: "Moeda", price_type: "Periodicidade", city: "Cidade", neighborhood: "Bairro", region: "UF", country: "País", latitude: "Latitude pública", longitude: "Longitude pública", street: "Rua", number: "Número", complement: "Complemento", postal_code: "CEP", agency_name: "Anunciante", creci: "CRECI", phone: "Telefone", mobile: "Celular", email: "E-mail de contato", website: "Site", whatsapp_url: "Link do WhatsApp", bedrooms: "Quartos", suites: "Suítes", bathrooms: "Banheiros", parking_spaces: "Vagas", floor: "Andar", total_floors: "Total de andares", construction_year: "Ano de construção", usable_area_sqm: "Área útil (m²)", built_area_sqm: "Área construída (m²)", land_area_sqm: "Área do terreno (m²)", total_area_sqm: "Área total (m²)", condominium_fee: "Condomínio (período não informado)", property_tax: "IPTU (período não informado)", other_recurring_charges: "Outras taxas (período não informado)", balcony: "Sacada", barbecue: "Churrasqueira", swimming_pool: "Piscina", garden: "Jardim", elevator: "Elevador", air_conditioning: "Ar-condicionado", pet_friendly: "Aceita animais", gym: "Academia", playground: "Playground", gated_community: "Condomínio fechado", furnished: "Mobiliado", base_amount: "Valor base", gross_amount: "Valor sem desconto", discount_amount: "Desconto condicionado", discount_condition: "Condição do desconto", total_amount: "Total informado", total_period: "Período do total", code: "Código", label: "Nome da taxa", amount: "Valor", period: "Período",
};
export const optionLabels: Record<string, string> = { sale: "Venda", rental: "Aluguel", apartment: "Apartamento", house: "Casa", townhouse: "Sobrado", studio: "Studio", land: "Terreno", commercial: "Comercial", rural: "Rural", fixed: "Preço fixo", monthly: "Mensal", yearly: "Anual", on_request: "Sob consulta", one_off: "Cobrança única", unknown: "Não informado" };
export function manualError(status: number, code?: string) {
  const messages: Record<string, string> = {
    email_not_verified: "Verifique seu e-mail antes de anunciar.", origin_forbidden: "Origem não autorizada.", idempotency_conflict: "Esta entrada foi modificada. Inicie um novo cadastro.", submission_busy: "Este cadastro já está sendo processado. Aguarde alguns segundos e consulte o progresso antes de continuar.", submission_processing: "A análise está em andamento. Consulte o progresso antes de alterar as fotos.", listing_not_editable: "Este anúncio não está em rascunho. Reabra-o na revisão antes de editar.", images_upload_incomplete: "Há fotos com envio pendente. Reenvie o mesmo lote ou remova as fotos pendentes antes de analisar.", manual_listing_incomplete: "Complete os campos destacados antes de aprovar.", invalid_manual_fields: "Confira os campos e as relações entre preço, descontos e periodicidade.", image_too_large: "Cada foto deve ter até 5 MiB.", request_too_large: "O envio excedeu o limite da hospedagem. Os anexos foram preservados; escolha arquivos menores ou tente em uma hospedagem compatível.", unsupported_image_type: "Use fotos JPEG, PNG ou WebP.", input_required: "Conte sobre o imóvel, anexe um áudio ou envie ao menos uma foto.", image_upload_failed: "Não foi possível concluir o envio. Consulte o progresso e reenvie o mesmo lote; fotos já salvas não serão duplicadas.", ai_timeout: "A análise excedeu o tempo disponível. Consulte o progresso antes de retomar.", ai_unavailable: "A análise está temporariamente indisponível. Seu cadastro foi preservado; consulte o progresso e retome depois.", imagekit_not_configured: "O armazenamento de fotos ainda não está configurado. Seu cadastro foi preservado.", ai_invalid_response: "Não foi possível concluir a análise. Seu cadastro foi preservado.", review_outdated: "Os dados mudaram. Atualize o detalhe e revise a nova versão.",
  };
  return messages[code ?? ""] ?? audioErrorMessage(code ?? "") ?? ({ 400: "Confira os dados enviados.", 401: "Sua sessão expirou. Entre novamente para retomar.", 403: "Você não tem permissão para esta operação.", 404: "Cadastro não encontrado ou sem acesso para esta conta.", 429: "Limite temporário atingido. Aguarde antes de retomar; nenhuma tentativa automática será feita.", 502: "Não foi possível concluir a operação. Consulte o progresso antes de tentar novamente.", 503: "Serviço indisponível. Seu cadastro foi preservado.", 504: "Tempo excedido. Consulte o progresso antes de retomar." } as Record<number, string>)[status] ?? "Não foi possível concluir. Consulte o progresso e tente novamente.";
}
/** Technical batches, never a selection limit. Reserve space for multipart framing. */
export function photoBatches<T extends { size: number }>(files: T[], bodyLimit: number, count = 4): T[][] {
  const batches: T[][] = []; let current: T[] = [], bytes = 0;
  for (const file of files) {
    if (file.size + 65536 > bodyLimit) throw new Error("request_too_large");
    if (current.length && (current.length >= count || bytes + file.size + 65536 > bodyLimit)) { batches.push(current); current = []; bytes = 0; }
    current.push(file); bytes += file.size;
  }
  if (current.length) batches.push(current);
  return batches;
}
