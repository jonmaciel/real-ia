import { loadGoogleMaps, watchGoogleAuthorization } from "./google-maps-loader";
import { distanceMeters, publicCoordinates } from "./property-location";
import { essentials, limitNearby, nearbyCategories, validateNearby, type NearbyCategory, type NearbyPlace } from "./nearby";
import { abortable, markerContent, type MapOptions, type NeighborhoodMap } from "./neighborhood-map";
import { safeUrl } from "./presentation";
export async function createGoogleMap({ container, point, signal, onError }: MapOptions): Promise<NeighborhoodMap> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
  if (!key || !mapId) throw new Error("google_maps_not_configured");
  signal.throwIfAborted();
  const unsubscribe = watchGoogleAuthorization(onError);
  try {
    const sdk = await abortable(loadGoogleMaps(key), signal);
    const [{ Map, Polyline }, { AdvancedMarkerElement }, { LatLngBounds }] = await abortable(Promise.all([sdk.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>, sdk.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>, sdk.maps.importLibrary("core") as Promise<google.maps.CoreLibrary>]), signal);
    signal.throwIfAborted();
    const map = new Map(container, { center: point, zoom: 15, maxZoom: 18, mapId, gestureHandling: "cooperative", streetViewControl: false, mapTypeControl: false, fullscreenControl: true, clickableIcons: false });
    const home = new AdvancedMarkerElement({ position: point, map, title: "Ponto publicado do imóvel" }); home.append(markerContent());
    let markers: google.maps.marker.AdvancedMarkerElement[] = [];
    let line: google.maps.Polyline | null = null;
    function clear() { markers.forEach(marker => { sdk.maps.event.clearInstanceListeners(marker); marker.map = null; }); markers = []; line?.setMap(null); }
    return {
      setPlaces(places, onSelect) {
        clear(); const bounds = new LatLngBounds(point);
        places.forEach((place, index) => {
          const marker = new AdvancedMarkerElement({ map, position: place.point, title: place.name });
          marker.dataset.placeId = place.id;
          marker.append(markerContent(place, index)); marker.addListener("click", () => onSelect(place));
          markers.push(marker); bounds.extend(place.point);
        });
        if (places.length) map.fitBounds(bounds, 55);
      },
      select(place) {
        const bounds = new LatLngBounds(point); bounds.extend(place.point); line?.setMap(null);
        line = new Polyline({ map, path: [point, place.point], strokeOpacity: 0, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "14px" }] });
        map.fitBounds(bounds, 60);
        markers.forEach(marker => { marker.classList.toggle("is-selected", marker.dataset.placeId === place.id); marker.zIndex = marker.dataset.placeId === place.id ? 2000 : 0; });
      },
      reset() { map.setCenter(point); map.setZoom(15); }, resize() { sdk.maps.event.trigger(map, "resize"); },
      async search(category, radius, requestSignal) {
        validateNearby(point, category, radius);
        requestSignal.throwIfAborted();
        const { Place, SearchNearbyRankPreference } = await abortable(sdk.maps.importLibrary("places") as Promise<google.maps.PlacesLibrary>, requestSignal);
        const keys = category === "essentials" ? essentials : [category];
        const response = await abortable(Place.searchNearby({ fields: ["id", "displayName", "location", "primaryType", "googleMapsURI", "attributions"], locationRestriction: { center: point, radius }, includedPrimaryTypes: keys.flatMap(k => [...nearbyCategories[k].googleTypes]), maxResultCount: 20, rankPreference: SearchNearbyRankPreference.DISTANCE }), requestSignal);
        return limitNearby(response.places.flatMap((place): NearbyPlace[] => {
          const position = publicCoordinates({ latitude: place.location?.lat(), longitude: place.location?.lng() });
          const kind = keys.find(k => (nearbyCategories[k].googleTypes as readonly string[]).includes(place.primaryType ?? "")) as NearbyCategory | undefined;
          const url = safeUrl(place.googleMapsURI); if (!position || !kind || !url) return [];
          const meters = distanceMeters(point, position); if (meters > radius) return [];
          return [{ id: place.id, name: place.displayName || nearbyCategories[kind].fallback, category: kind, point: position, meters, url,
            attributions: place.attributions?.map(attribution => ({ name: attribution.provider ?? "Fonte de dados", ...(safeUrl(attribution.providerURI) ? { url: safeUrl(attribution.providerURI)! } : {}) })) }];
        }), category);
      },
      destroy() { unsubscribe(); clear(); home.map = null; sdk.maps.event.clearInstanceListeners(map); container.replaceChildren(); },
    };
  } catch (error) { unsubscribe(); throw error; }
}
