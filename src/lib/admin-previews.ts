import { z } from "zod";
import { adminMediaSchema } from "./admin-contracts";
import { safeUrl } from "./presentation";
export const adminPreviewSchema = z.object({ id: z.string(), url: z.string().refine(trustedPreview), attribution: z.string().nullish() });
export const adminPreviewsSchema = z.object({ data: z.array(adminPreviewSchema).max(3) });
export type AdminPreview = z.infer<typeof adminPreviewSchema>;
function trustedPreview(value: string) { const url = safeUrl(value); return !!url && new URL(url).hostname === "ik.imagekit.io"; }
export function reviewPreviews(media: z.infer<typeof adminMediaSchema>[] = []): AdminPreview[] {
  return media.filter(photo => photo.processing_status === "completed" && !!photo.hosted_url && trustedPreview(photo.hosted_url))
    .toSorted((a, b) => Number(!!b.is_cover) - Number(!!a.is_cover) || (a.position ?? 0) - (b.position ?? 0))
    .slice(0, 3).map(photo => ({ id: String(photo.id), url: photo.hosted_url!, attribution: photo.attribution }));
}
