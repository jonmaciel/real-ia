import type { Listing } from "./contracts";
export type Coordinates = { lat: number; lng: number };
function coordinate(value: unknown, limit: number) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^-?\d+(\.\d+)?$/.test(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}
export function publicCoordinates(p: Pick<Listing, "latitude" | "longitude">): Coordinates | null {
  const lat = coordinate(p.latitude, 90), lng = coordinate(p.longitude, 180);
  return lat === null || lng === null ? null : { lat, lng };
}
/** Only explicitly labelled, already public description fields. No inference or reverse geocoding. */
export function publishedContact(description?: string | null) {
  const text = description ?? "";
  const address = text.match(/(?:^|\n)\s*endere[çc]o\s*:\s*([^\n]{5,180})(?:\n|$)/i)?.[1]?.trim();
  const phone = text.match(/\b(?:telefone|contato|whatsapp|fone|tel)\s*[:\-]?\s*((?:\+?55[\s.-]*)?\(?[1-9]\d\)?[\s.-]*\d{4,5}[\s.-]?\d{4})(?!\d)/i)?.[1];
  const digits = phone?.replace(/\D/g, "");
  const valid = digits && (digits.length === 10 || digits.length === 11 || ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")));
  return { address: address || null, phone: valid ? phone! : null, telephone: valid ? `tel:+${digits.length <= 11 ? "55" : ""}${digits}` : null };
}
export function distanceMeters(a: Coordinates, b: Coordinates) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters).toLocaleString("pt-BR")} m` : `${(meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}
export function mapsUrl(point: Coordinates) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point.lat},${point.lng}`)}`;
}
export function walkingRoute(origin: Coordinates, destination: Coordinates) {
  const query = new URLSearchParams({ api: "1", origin: `${origin.lat},${origin.lng}`, destination: `${destination.lat},${destination.lng}`, travelmode: "walking" });
  return `https://www.google.com/maps/dir/?${query}`;
}
