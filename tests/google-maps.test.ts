import { test } from "node:test";
import assert from "node:assert/strict";
import { createGoogleMap } from "../src/lib/neighborhood-map-google";
import { abortable } from "../src/lib/neighborhood-map";
test("Google opcional exige configuração e Nearby usa campos mínimos, tipos, distância e atribuição", async () => {
  const previousKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const previousId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  let query: Record<string, unknown> | undefined;
  let calls = 0;
  const element = () => ({ className: "", dataset: {}, textContent: "", append() {}, setAttribute() {}, classList: { toggle() {} }, replaceChildren() {} });
  class MapStub { setCenter() {} setZoom() {} fitBounds() {} }
  class BoundsStub { extend() {} }
  class LineStub { setMap() {} }
  class MarkerStub { dataset = {}; title = ""; map = null; classList = { toggle() {} }; append() {} addListener() {} }
  const sdk = { maps: { event: { clearInstanceListeners() {}, trigger() {} }, importLibrary: async (name: string) => {
    if (name === "maps") return { Map: MapStub, Polyline: LineStub };
    if (name === "core") return { LatLngBounds: BoundsStub };
    if (name === "marker") return { AdvancedMarkerElement: MarkerStub };
    return { SearchNearbyRankPreference: { DISTANCE: "DISTANCE" }, Place: { searchNearby: async (request: Record<string, unknown>) => {
      calls++; query = request;
      return { places: [
        { id: "p1", displayName: "Padaria real do contrato", location: { lat: () => -25.431, lng: () => -49.27 }, primaryType: "bakery", googleMapsURI: "https://maps.google.com/?cid=1", attributions: [{ provider: "Fonte", providerURI: "https://example.com" }] },
        { id: "p2", displayName: "Sem coordenadas", primaryType: "bakery", googleMapsURI: "https://maps.google.com/?cid=2" },
        { id: "p3", location: { lat: () => 0, lng: () => 0 }, primaryType: "bakery", googleMapsURI: "https://maps.google.com/?cid=3" },
      ] };
    } } };
  } } };
  const options = { container: element() as unknown as HTMLElement, point: { lat: -25.43, lng: -49.27 }, signal: new AbortController().signal, onError() {} };
  try {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY; delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
    await assert.rejects(createGoogleMap(options), /google_maps_not_configured/);
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "contract-key"; process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID = "contract-map-id";
    Object.defineProperty(globalThis, "window", { configurable: true, value: { google: sdk } });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: element, createElementNS: element } });
    const map = await createGoogleMap(options);
    const places = await map.search("essentials", 500, new AbortController().signal);
    assert.equal(calls, 1); assert.equal(places.length, 1); assert.equal(places[0].category, "bakery");
    assert.ok(places[0].meters > 100 && places[0].meters < 120);
    assert.deepEqual(places[0].attributions, [{ name: "Fonte", url: "https://example.com/" }]);
    assert.deepEqual(query?.fields, ["id", "displayName", "location", "primaryType", "googleMapsURI", "attributions"]);
    assert.deepEqual(query?.locationRestriction, { center: options.point, radius: 500 });
    assert.equal(query?.maxResultCount, 20); assert.equal(query?.rankPreference, "DISTANCE");
    assert.ok((query?.includedPrimaryTypes as string[]).includes("bus_stop"));
    const cancelled = new AbortController(); cancelled.abort();
    await assert.rejects(map.search("bakery", 500, cancelled.signal)); assert.equal(calls, 1);
    map.setPlaces(places, () => {}); map.select(places[0]); map.reset(); map.resize(); map.destroy();
  } finally {
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY; else process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = previousKey;
    if (previousId === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID; else process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID = previousId;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window");
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});
test("cancelar espera de Places descarta resultado tardio sem repetir chamada", async () => {
  const controller = new AbortController();
  let complete!: (value: string) => void;
  const pending = abortable(new Promise<string>(resolve => { complete = resolve; }), controller.signal);
  controller.abort(); await assert.rejects(pending, { name: "AbortError" }); complete("late");
});

test("loader Google carrega uma vez, em pt-BR e canal estável, somente quando chamado", async () => {
  const { loadGoogleMaps } = await import("../src/lib/google-maps-loader");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const fakeWindow: { google?: object; moradaGoogleMapsReady?: () => void } = {};
  const sdk = { maps: { importLibrary() {} } };
  const scripts: { src: string; async: boolean }[] = [];
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => ({ remove() {} }), head: { append(script: { src: string; async: boolean }) {
      scripts.push(script); queueMicrotask(() => { fakeWindow.google = sdk; fakeWindow.moradaGoogleMapsReady?.(); });
    } } } });
    assert.equal(scripts.length, 0);
    const values = await Promise.all([loadGoogleMaps("contract-key"), loadGoogleMaps("contract-key")]);
    assert.equal(scripts.length, 1); assert.equal(values[0], values[1]);
    const query = new URL(scripts[0].src).searchParams;
    assert.equal(query.get("v"), "quarterly"); assert.equal(query.get("language"), "pt-BR"); assert.equal(query.get("region"), "BR");
    assert.equal(query.get("loading"), "async"); assert.equal(scripts[0].async, true);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window");
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});
