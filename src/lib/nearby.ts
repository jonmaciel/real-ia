import { z } from "zod";
import { distanceMeters, publicCoordinates, type Coordinates } from "./property-location";
export const nearbyCategories = {
  bakery: { label: "Padarias", selector: '["shop"="bakery"]', fallback: "Padaria sem nome informado" },
  shops: { label: "Lojas", selector: '["shop"]["shop"!="vacant"]', fallback: "Loja sem nome informado" },
  bus: { label: "Pontos de ônibus", selector: '["highway"="bus_stop"]', fallback: "Ponto de ônibus sem nome informado" },
  supermarket: { label: "Supermercados", selector: '["shop"="supermarket"]', fallback: "Supermercado sem nome informado" },
  pharmacy: { label: "Farmácias", selector: '["amenity"="pharmacy"]', fallback: "Farmácia sem nome informado" },
} as const;
export type NearbyCategory = keyof typeof nearbyCategories;
export function nearbyQuery(point: Coordinates, category: NearbyCategory, radius: number) {
  if (!publicCoordinates({ latitude: point.lat, longitude: point.lng }) || !Object.hasOwn(nearbyCategories, category) || ![500, 1000].includes(radius)) throw new Error("invalid_nearby_query");
  return `[out:json][timeout:15];nwr(around:${radius},${point.lat},${point.lng})${nearbyCategories[category].selector};out center 60;`;
}
const coordinate = z.object({ lat: z.number(), lon: z.number() });
const responseSchema = z.object({
  remark: z.string().optional(),
  elements: z.array(z.object({
    type: z.enum(["node", "way", "relation"]), id: z.number().int().positive(),
    lat: z.number().optional(), lon: z.number().optional(), center: coordinate.optional(),
    tags: z.record(z.string(), z.string()).optional(),
  })).max(100),
});
export type NearbyPlace = { id: string; name: string; point: Coordinates; meters: number; url: string };
export function parseNearby(value: unknown, origin: Coordinates, category: NearbyCategory, radius: number): NearbyPlace[] {
  const parsed = responseSchema.parse(value);
  if (parsed.remark) throw new Error("nearby_incomplete");
  return parsed.elements.flatMap((e) => {
    const position = publicCoordinates({ latitude: e.lat ?? e.center?.lat, longitude: e.lon ?? e.center?.lon });
    if (!position) return [];
    const meters = distanceMeters(origin, position);
    if (meters > radius) return [];
    return [{ id: `${e.type}/${e.id}`, name: e.tags?.name || nearbyCategories[category].fallback, point: position, meters, url: `https://www.openstreetmap.org/${e.type}/${e.id}` }];
  }).sort((a, b) => a.meters - b.meters).slice(0, 12);
}
