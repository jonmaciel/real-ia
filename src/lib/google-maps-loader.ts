let loading: Promise<typeof google> | null = null;
declare global { interface Window { google?: typeof google; moradaGoogleMapsReady?: () => void; gm_authFailure?: () => void } }
const authListeners = new Set<() => void>();
export function watchGoogleAuthorization(listener: () => void) { authListeners.add(listener); return () => { authListeners.delete(listener); }; }
export function loadGoogleMaps(key: string): Promise<typeof google> {
  if (typeof window.google?.maps?.importLibrary === "function") return Promise.resolve(window.google!);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => { clearTimeout(timer); loading = null; script.remove(); delete window.moradaGoogleMapsReady; reject(new Error("google_maps_unavailable")); };
    const timer = setTimeout(fail, 15000);
    window.gm_authFailure = () => { for (const listener of authListeners) listener(); fail(); };
    window.moradaGoogleMapsReady = () => { if (!window.google?.maps) { fail(); return; } clearTimeout(timer); delete window.moradaGoogleMapsReady; resolve(window.google); };
    const query = new URLSearchParams({ key, v: "quarterly", loading: "async", callback: "moradaGoogleMapsReady", language: "pt-BR", region: "BR" });
    script.src = `https://maps.googleapis.com/maps/api/js?${query}`; script.async = true; script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}
