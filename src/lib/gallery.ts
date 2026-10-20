import type { z } from "zod";
import type { mediaSchema } from "./contracts";
import { safeUrl } from "./presentation";
export type GalleryPhoto = {
  id: string;
  src: string;
  kind: "image" | "floor_plan";
  attribution?: string | null;
  width?: number;
  height?: number;
  isCover: boolean;
};
export function prepareGallery(
  media: z.infer<typeof mediaSchema>[],
  hosts: string[],
) {
  const photos: GalleryPhoto[] = [];
  const attachments: {
    id: string;
    url: string;
    label: string;
    attribution?: string | null;
  }[] = [];
  const sorted = media.toSorted(
    (a, b) =>
      Number(!!b.is_cover) - Number(!!a.is_cover) ||
      (a.position ?? 0) - (b.position ?? 0),
  );
  for (const m of sorted) {
    const url = safeUrl(m.original_url);
    if (!url) continue;
    const image = m.kind === "image" || m.kind === "floor_plan";
    if (image && hosts.includes(new URL(url).hostname)) {
      photos.push({
        id: String(m.id),
        src: url,
        kind: m.kind as GalleryPhoto["kind"],
        attribution: m.attribution,
        isCover: !!m.is_cover,
        ...(m.width && m.width > 0 ? { width: m.width } : {}),
        ...(m.height && m.height > 0 ? { height: m.height } : {}),
      });
    } else
      attachments.push({
        id: String(m.id),
        url,
        label: {
          image: "Imagem",
          floor_plan: "Planta",
          video: "Vídeo",
          document: "Documento",
        }[m.kind],
        attribution: m.attribution,
      });
  }
  return { photos, attachments };
}
export function photoLabel(photo: GalleryPhoto, index: number) {
  return photo.kind === "floor_plan"
    ? "Planta do imóvel"
    : `${photo.isCover ? "Capa · " : ""}Foto ${index + 1}`;
}
