import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { z } from "zod";
import { request, ApiError, demo } from "./api";
import { profileSchema } from "./contracts";
import {
  adminSearchSchema,
  adminDetailSchema,
  adminQuery,
  type AdminFilters,
} from "./admin-contracts";
export const requireAdmin = cache(async () => {
  if (demo) throw new ApiError(403);
  const token = (await cookies()).get("morada_session")?.value;
  if (!token) throw new ApiError(401);
  const profile = z
    .object({ data: profileSchema })
    .parse(
      await request("/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ).data;
  if (profile.role !== "admin") throw new ApiError(403);
  return { token, profile };
});
export async function adminSearch(filters: AdminFilters) {
  const { token } = await requireAdmin();
  return adminSearchSchema.parse(
    await request(`/admin/listings?${adminQuery(filters)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}
export async function adminDetail(id: string) {
  const { token } = await requireAdmin();
  return z
    .object({ data: adminDetailSchema })
    .parse(
      await request(`/admin/listings/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ).data;
}
export { adminError } from "./admin-contracts";
