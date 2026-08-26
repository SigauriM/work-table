/**
 * Register the service worker only after session restore has finished.
 * autoUpdate reloads when a new shell is waiting; refresh stays in
 * localStorage (`worktable_refresh`), so restore must run again on the new
 * page — not mid-flight on the old one.
 *
 * Never clear the refresh token from a SW event. `/api` is NetworkOnly.
 *
 * If refresh rotation is restored on the backend, this path is the regression
 * test: install → new build → app updates without logout.
 */
let started = false;

export async function registerPwa() {
  if (started || !("serviceWorker" in navigator)) return;
  started = true;
  const { registerSW } = await import("virtual:pwa-register");
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      // Delayed register can miss the `waiting` event if the controlling SW
      // already found an update during restore. Catch up so autoUpdate reloads.
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    },
  });
}
