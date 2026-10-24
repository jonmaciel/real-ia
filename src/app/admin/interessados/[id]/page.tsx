import { requireAdmin } from "@/lib/admin-api";
import { getListing, ApiError } from "@/lib/api";
import { leadRequest } from "@/lib/lead-api";
import { leadDetailSchema, leadUuid, assigneesSchema } from "@/lib/lead-contracts";
import { propertyHref } from "@/lib/presentation";
import { LeadAdminState } from "@/components/lead-admin-state";
import { LeadDetailView } from "@/components/lead-detail";
export const metadata = { title: "Acompanhamento de interessado", robots: { index: false, follow: false } };
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let initial; let people; let publicHref;
  try {
    const { token } = await requireAdmin();
    const parsed = leadUuid.safeParse(id); if (!parsed.success) throw new ApiError(404, "not_found");
    const uuid = parsed.data; const headers = { Authorization: `Bearer ${token}` };
    const result = await leadRequest(`/admin/leads/${uuid}`, leadDetailSchema, { headers });
    const assignees = await leadRequest("/admin/leads/assignees", assigneesSchema, { headers }).then(r => r.body.data).catch(error => { if ([401, 403].includes(error.status)) throw error; return null; });
    const current = result.body.data.listing_id == null ? null : await getListing(String(result.body.data.listing_id)).catch(() => null);
    initial = result.body; people = assignees; publicHref = current ? propertyHref(current) : null;
  } catch (error) { return <LeadAdminState error={error} href={`/admin/interessados/${encodeURIComponent(id)}`} />; }
  return <LeadDetailView initial={initial} initialAssignees={people} publicHref={publicHref} />;
}
