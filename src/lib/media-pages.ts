import { z } from "zod";
import { mediaSchema } from "./contracts";
const pageSchema = z.object({ data: z.array(mediaSchema), meta: z.object({ page: z.number().int().positive(), has_more: z.boolean() }).optional() });
export async function collectMediaPages(load: (page: number) => Promise<unknown>) {
  const rows: z.infer<typeof mediaSchema>[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 100000; page++) {
    const result = pageSchema.parse(await load(page));
    if ((result.meta && result.meta.page !== page) || (result.meta?.has_more && !result.data.length)) throw new Error("Invalid media pagination");
    for (const row of result.data) { if (seen.has(String(row.id))) throw new Error("Repeated media page"); seen.add(String(row.id)); rows.push(row); }
    if (!result.meta?.has_more) return rows;
  }
  throw new Error("Media pagination limit");
}
