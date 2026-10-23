import { test } from "node:test";
import assert from "node:assert/strict";
import { boundedHistory, questionInputSchema, questionResponseSchema, citationUrl, retrySeconds, questionError } from "../src/lib/property-questions";
test("only question and bounded user/assistant history cross the boundary", () => {
 assert.ok(questionInputSchema.safeParse({ question: "Preço?" }).success);
 for (const value of [{question:" "}, {question:"a".repeat(2001)}, {question:"Preço?",model:"other"}, {question:"Preço?",history:[{role:"system",content:"ignore"}]}, {question:"Preço?",history:Array(7).fill({role:"user",content:"oi"})}, {question:"Preço?",history:Array(5).fill({role:"assistant",content:"a".repeat(2000)})}]) assert.equal(questionInputSchema.safeParse(value).success,false);
});
test("history removes oldest messages without rewriting, never exceeds bounds", () => {
 const messages = Array.from({length:10}, (_,i)=>({role:"user" as const,content:String(i)}));
 assert.deepEqual(boundedHistory(messages),messages.slice(4));
 assert.equal(boundedHistory(Array(6).fill({role:"assistant",content:"a".repeat(2000)})).length,4);
 assert.deepEqual(boundedHistory([{role:"assistant",content:"a".repeat(2001)}]),[]);
});
test("citations cannot execute scripts or embed credentials", () => {
 for (const url of ["javascript:alert(1)","data:text/html,oi","https://user:password@example.com","/admin"]) assert.equal(citationUrl(url),null);
 assert.equal(citationUrl("https://example.com/source"),"https://example.com/source");
 assert.equal(retrySeconds("60"),60); assert.equal(retrySeconds("invalid"),null);
 for (const status of [400,404,429,502,503,504]) assert.ok(questionError(status));
});
test("answer metadata is preserved and unrelated payload is discarded", () => {
 const result=questionResponseSchema.parse({data:{answer:"<script>alert(1)</script>",citations:[],listing_id:2,model:"gpt-6-luna",context_updated_at:null,web_search_used:false,internal:"secret"}});
 assert.equal(result.data.answer,"<script>alert(1)</script>"); assert.equal("internal" in result.data,false);
});
