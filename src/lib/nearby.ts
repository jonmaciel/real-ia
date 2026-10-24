import { z } from "zod";
import { distanceMeters, publicCoordinates, type Coordinates } from "./property-location";
export const nearbyCategories = {
  bakery: { label: "Padarias", singular: "Padaria", selector: '["shop"="bakery"]', googleTypes: ["bakery"], fallback: "Padaria sem nome informado" },
  pharmacy: { label: "Farmácias", singular: "Farmácia", selector: '["amenity"="pharmacy"]', googleTypes: ["pharmacy", "drugstore"], fallback: "Farmácia sem nome informado" },
  supermarket: { label: "Mercados", singular: "Mercado", selector: '["shop"~"^(supermarket|convenience)$"]', googleTypes: ["supermarket", "grocery_store"], fallback: "Mercado sem nome informado" },
  bus: { label: "Ônibus", singular: "Ponto de ônibus", selector: '["highway"="bus_stop"]', googleTypes: ["bus_stop", "bus_station"], fallback: "Ponto de ônibus sem nome informado" },
  shops: { label: "Lojas", singular: "Loja", selector: '["shop"]["shop"!="vacant"]', googleTypes: ["store"], fallback: "Loja sem nome informado" },
} as const;
export type NearbyCategory = keyof typeof nearbyCategories;
export type NearbySelection = NearbyCategory | "essentials";
export const essentials: NearbyCategory[] = ["bakery", "pharmacy", "supermarket", "bus"];
export function validateNearby(point: Coordinates, category: NearbySelection, radius: number) {
  if (!publicCoordinates({ latitude: point.lat, longitude: point.lng }) || (category !== "essentials" && !Object.hasOwn(nearbyCategories, category)) || ![500, 1000].includes(radius)) throw new Error("invalid_nearby_query");
}
export function nearbyQuery(point: Coordinates, category: NearbySelection, radius: number) {
  validateNearby(point, category, radius);
  const query = (key: NearbyCategory) => `nwr(around:${radius},${point.lat},${point.lng})${nearbyCategories[key].selector};`;
  return category === "essentials" ? `[out:json][timeout:15];(${essentials.map(query).join("")});out center 80;` : `[out:json][timeout:15];${query(category)}out center 60;`;
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
export type NearbyPlace = { id: string; name: string; category: NearbyCategory; point: Coordinates; meters: number; url: string; attributions?: { name: string; url?: string }[] };
export function limitNearby(places: NearbyPlace[], category: NearbySelection) {
  const sorted = places.toSorted((a, b) => a.meters - b.meters);
  return category === "essentials" ? essentials.flatMap(key => sorted.filter(place => place.category === key).slice(0, 3)).sort((a, b) => a.meters - b.meters) : sorted.slice(0, 12);
}
function osmCategory(tags: Record<string, string> = {}): NearbyCategory | null {
  if (tags.shop === "bakery") return "bakery";
  if (tags.amenity === "pharmacy") return "pharmacy";
  if (["supermarket", "convenience"].includes(tags.shop)) return "supermarket";
  if (tags.highway === "bus_stop") return "bus";
  return tags.shop && tags.shop !== "vacant" ? "shops" : null;
}
export function parseNearby(value: unknown, origin: Coordinates, category: NearbySelection, radius: number): NearbyPlace[] {
  validateNearby(origin, category, radius);
  const parsed = responseSchema.parse(value);
  if (parsed.remark) throw new Error("nearby_incomplete");
  return limitNearby(parsed.elements.flatMap((e): NearbyPlace[] => {
    const position = publicCoordinates({ latitude: e.lat ?? e.center?.lat, longitude: e.lon ?? e.center?.lon });
    const kind = category === "essentials" ? osmCategory(e.tags) : category;
    if (!position || !kind) return [];
    const meters = distanceMeters(origin, position);
    if (meters > radius) return [];
    return [{ id: `${e.type}/${e.id}`, name: e.tags?.name || nearbyCategories[kind].fallback, category: kind, point: position, meters, url: `https://www.openstreetmap.org/${e.type}/${e.id}` }];
  }), category);
}
