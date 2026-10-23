// Synthetic contract fixtures: imported by tests/mock-api only, never production.
import { listings } from "../src/lib/fixtures";
import type { AssistantResponse } from "../src/lib/assistant-contracts";
export function assistantResponse(overrides: Partial<AssistantResponse> = {}): AssistantResponse {
 return { mode:"search", action:"clarify", answer:"Em qual cidade você procura?", citations:[], recommendations:[], selected_listing_id:null, applied_filters:{currency:"BRL",price_basis:"base",sort:"recommended"}, unverified_preferences:[], search_token:"contract-token", has_more:false, context_changed:false, model:"gpt-6-luna", web_search_used:false, context_updated_at:"2026-10-23T12:00:00Z", ...overrides };
}
export function recommendation(id: number) {
 const row=listings.find(p=>Number(p.id)===id)!;
 return { ...row, listing_type:"rental" as const, price:"2100.00", price_type:"monthly", original_url:"https://example.com/original", cover_url:null, match_reasons:["Em Curitiba.","2 quartos; atende ao mínimo solicitado.","Preço base dentro do orçamento solicitado; taxas podem ser adicionais."],matched_preferences:["pet_friendly"],warnings:["Disponibilidade não confirmada no cadastro.","Custo mensal total não informado; o preço base pode não incluir todas as taxas."],pricing:{base_amount:"2100.00",gross_amount:"2500.00",discount_amount:"400.00",discount_condition:"Pagamento em dia",charges:[{label:"IPTU",amount:"120.00",period:"yearly"},{label:"Condomínio",amount:null,period:"monthly"}]}, real_estate:{bedrooms:2},structured_attributes:{pet_friendly:true} };
}
