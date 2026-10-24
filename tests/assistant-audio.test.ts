import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { questionSignature } from "../src/lib/questions-signature";
import { AUDIO_TIMEOUT_MS, MAX_AUDIO_BYTES, MAX_RECORDING_MS, audioFileError } from "../src/lib/assistant-audio";
import { assistantAudioResponseSchema, assistantMetadataSchema } from "../src/lib/assistant-contracts";
import { assistantMetadata, emptyAssistantState } from "../src/lib/assistant-state";
import { assistantResponse } from "./assistant-fixtures";

test("HMAC usa bytes binários originais e o caminho de áudio; JSON mantém assinatura", () => {
  const raw = Buffer.from([45, 45, 98, 111, 117, 110, 100, 13, 10, 0, 255, 254, 128, 195, 169]);
  const path = "/api/v1/listings-platform/assistant/audio-messages";
  const expected = createHmac("sha256", "test-secret").update(["POST", path, "1792790400", "203.0.113.1", createHash("sha256").update(raw).digest("hex")].join("\n")).digest("hex");
  assert.equal(questionSignature("test-secret", path, "1792790400", "203.0.113.1", raw), expected);
  assert.notEqual(questionSignature("test-secret", path, "1792790400", "203.0.113.1", raw.toString("utf8")), expected);
  assert.notEqual(questionSignature("test-secret", "/assistant/messages", "1792790400", "203.0.113.1", raw), expected);
  assert.equal(questionSignature("test-secret", path, "1792790400", "203.0.113.1", "olá"), questionSignature("test-secret", path, "1792790400", "203.0.113.1", Buffer.from("olá")));
});
test("metadata de áudio preserva contexto e não contém question, modelo ou áudio em base64", () => {
  const metadata = assistantMetadata(emptyAssistantState("2"), { page: "listing" });
  assert.ok(assistantMetadataSchema.safeParse(metadata).success);
  assert.equal("question" in metadata, false);
  for (const field of ["question", "model", "audio", "url"]) assert.equal(assistantMetadataSchema.safeParse({ ...metadata, [field]: "x" }).success, false);
  assert.equal(assistantMetadataSchema.safeParse({ ...metadata, history: [{ role: "system", content: "x" }] }).success, false);
});
test("áudio exige transcrição válida e mantém os limites declarados", () => {
  const data = assistantResponse({ input_type: "audio", transcription: { text: "Quais taxas?", model: "test" } });
  assert.ok(assistantAudioResponseSchema.safeParse({ data }).success);
  for (const transcription of [undefined, { text: " ", model: "test" }, { text: "x".repeat(2001), model: "test" }]) assert.equal(assistantAudioResponseSchema.safeParse({ data: { ...data, transcription } }).success, false);
  assert.equal(audioFileError({ name: "audio.wav", type: "audio/wav", size: MAX_AUDIO_BYTES }), null);
  assert.equal(audioFileError({ name: "audio.wav", type: "audio/wav", size: MAX_AUDIO_BYTES + 1 })?.status, 413);
  assert.equal(audioFileError({ name: "audio.wav", type: "audio/wav", size: 0 })?.status, 422);
  assert.equal(audioFileError({ name: "audio.ogg", type: "audio/ogg", size: 5 })?.status, 415);
  assert.equal(AUDIO_TIMEOUT_MS, 95000); assert.equal(MAX_RECORDING_MS, 60000);
});
