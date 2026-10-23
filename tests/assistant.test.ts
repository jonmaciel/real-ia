import { test } from "node:test";
import assert from "node:assert/strict";
import { assistantIdSchema, assistantInputSchema, assistantResponseSchema, recommendationSchema } from "../src/lib/assistant-contracts";
import { applyAssistantResponse, assistantPayload, emptyAssistantState } from "../src/lib/assistant-state";
import { assistantFilterLabels } from "../src/lib/assistant-presentation";
import { assistantResponse, recommendation } from "./assistant-fixtures";
test("assistant sends only question/history/selection/opaque token with strict limits",()=>{
 assert.ok(assistantInputSchema.safeParse({question:"Quero alugar",selected_listing_id:null,search_token:null}).success);
 for(const value of [{question:"x",model:"x"},{question:"x",context:{}},{question:"x",selected_listing_id:0},{question:"x",selected_listing_id:"1/../../admin"},{question:"x",search_token:""},{question:"x",history:[{role:"developer",content:"x"}]}]) assert.equal(assistantInputSchema.safeParse(value).success,false);
 for(const id of ["bad","0","1.2","9223372036854775808"]) assert.equal(assistantIdSchema.safeParse(id).success,false);
 assert.equal(assistantIdSchema.parse("9223372036854775807"),"9223372036854775807");
});
test("server search mode clears selection even while old property page stays open",()=>{
 const state=emptyAssistantState("2"); state.token="opaque-before";
 const next=applyAssistantResponse(state,"Não gostei",assistantResponse({action:"recommendations",recommendations:[recommendation(3)],search_token:"opaque-after",context_changed:true}));
 assert.equal(next.selectedId,null); assert.equal(next.token,"opaque-after");
 assert.equal(assistantPayload(next,"mais barato").selected_listing_id,null);
 const selected={...next,selectedId:"3",mode:"property" as const};
 assert.equal(assistantPayload(selected,"Taxas?").search_token,"opaque-after");
 assert.equal(assistantPayload(selected,"Taxas?").history.length,2);
 assert.deepEqual(Object.keys(assistantPayload(selected,"Taxas?")).sort(),["history","question","search_token","selected_listing_id"]);
});
test("history is bounded without changing older answers; reset has no implicit selection",()=>{
 let state=emptyAssistantState();
 for(let i=0;i<8;i++) state=applyAssistantResponse(state,`Mensagem ${i}`,assistantResponse({answer:` Resposta ${i} `}));
 const body=assistantPayload(state,"nova"); assert.equal(body.history.length,6); assert.equal(body.history.at(-1)?.content," Resposta 7 ");
 assert.equal(emptyAssistantState().selectedId,null); assert.equal(emptyAssistantState().token,null);
});
test("cards preserve decimal strings, pricing periods, optional data and provenance",()=>{
 const row=recommendationSchema.parse({...recommendation(2),price:null,cover_url:null,address:{street:"Rua pública"},pricing:{gross_amount:"1687.50",discount_amount:"337.50",charges:[{label:"IPTU",amount:"120.00",period:"yearly"},{label:"Condomínio",amount:null,period:"monthly"}]},private_payload:"hidden"});
 assert.equal(recommendationSchema.safeParse({...recommendation(2),availability:"unavailable"}).success,false);
 assert.equal(recommendationSchema.parse({...recommendation(2),price:"0.00"}).price,"0.00");
 assert.equal(row.price,null);assert.equal(row.cover_url,null);assert.equal(row.pricing?.gross_amount,"1687.50");assert.equal(row.pricing?.charges?.[0].period,"yearly"); assert.equal("private_payload" in row,false);
 const labels=assistantFilterLabels({max_price:3000,bedrooms:2,price_basis:"total_monthly",currency:"BRL",preferred_amenities:["pet_friendly"]});
 assert.ok(labels.includes("Mínimo de 2 quartos")); assert.ok(labels.includes("Preferência: Aceita pets")); assert.ok(labels.some(x=>x.includes("total mensal informado")));
});
test("response rejects mismatched mode/selection, too many recommendations and unsupported roles",()=>{
 assert.ok(assistantResponseSchema.safeParse({data:assistantResponse()}).success);
 assert.equal(assistantResponseSchema.safeParse({data:assistantResponse({selected_listing_id:2})}).success,false);
 assert.equal(assistantResponseSchema.safeParse({data:assistantResponse({recommendations:Array(4).fill(recommendation(2))})}).success,false);
 assert.equal(assistantResponseSchema.safeParse({data:assistantResponse({mode:"property",action:"recommendations",selected_listing_id:2})}).success,false);
});
