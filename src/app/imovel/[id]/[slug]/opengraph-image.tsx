import { getListing, ApiError } from "@/lib/api";
import { brandShareImage, propertyShareImage } from "@/lib/share-image";
export const alt = "Foto, preço e localização do imóvel na Morada";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 60;
export default async function Image({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d{0,18}$/.test(id)) return new Response("Imóvel indisponível", { status: 404 });
  try { return await propertyShareImage(await getListing(id)); }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) return new Response("Imóvel indisponível", { status: 404 });
    return brandShareImage();
  }
}
