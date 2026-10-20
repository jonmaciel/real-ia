import { adminDetail } from "@/lib/admin-api";
import { AdminState } from "@/components/admin-state";
import { ListingReview } from "@/components/listing-review";
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let listing;
  try {
    listing = await adminDetail(id);
  } catch (e) {
    return (
      <AdminState
        error={e}
        href={`/admin/anuncios/${encodeURIComponent(id)}`}
      />
    );
  }
  return <ListingReview initialListing={listing} />;
}
