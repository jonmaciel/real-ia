export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
export const MAX_AUDIO_BODY_BYTES = MAX_AUDIO_BYTES + 128 * 1024;
export const MAX_AUDIO_METADATA_BYTES = 64 * 1024;
export const AUDIO_TIMEOUT_MS = 95_000;
export const MAX_RECORDING_MS = 60_000;
export const AUDIO_ACCEPT = ".webm,.mp4,.m4a,.mp3,.wav,audio/webm,audio/mp4,audio/mpeg,audio/wav,audio/x-m4a";
const types = new Set(["audio/webm", "video/webm", "audio/mp4", "video/mp4", "audio/x-m4a", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"]);
export function audioFileError(file: Pick<File, "size" | "name" | "type">) {
  if (!file.size) return { status: 422, code: "invalid_audio" };
  if (file.size > MAX_AUDIO_BYTES) return { status: 413, code: "audio_too_large" };
  if (!types.has(file.type.split(";")[0].toLowerCase()) && !/\.(webm|mp4|m4a|mp3|wav)$/i.test(file.name)) return { status: 415, code: "unsupported_audio_type" };
  return null;
}
export function audioErrorMessage(code: string): string | undefined {
  return ({
    audio_too_large: "O áudio deve ter até 4 MiB. Grave uma mensagem mais curta ou escolha outro arquivo.",
    unsupported_audio_type: "Use áudio em WebM, MP4/M4A, MP3 ou WAV.",
    invalid_audio: "Não foi possível ler esse áudio. Grave novamente, anexe outro arquivo ou digite sua mensagem.",
    audio_not_understood: "Não foi possível entender a fala. Grave novamente ou digite sua mensagem.",
    audio_transcript_too_long: "A transcrição excede 2.000 caracteres. Grave uma mensagem mais curta; nenhum trecho foi descartado.",
  } as Record<string, string>)[code];
}
