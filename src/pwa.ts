import { registerSW } from 'virtual:pwa-register';

let isRefreshing = false;

/**
 * Proactively sets up Service Worker auto-update:
 * 1. Claims client and immediately reloads window when a new Service Worker activates.
 * 2. Checks for updates on tab visibility change (whenever user returns to the tab).
 * 3. Periodically checks for updates every 5 minutes.
 */
export function setupPWAAutoUpdate(): void {
  // Listen for the controllerchange event.
  // When a new SW is installed, activated (skipWaiting), and claims clients,
  // this event fires on all open tabs.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!isRefreshing) {
        isRefreshing = true;
        console.info('[PWA] New service worker claimed control. Reloading to apply latest changes...');
        window.location.reload();
      }
    });
  }

  // Register with virtual:pwa-register
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.info('[PWA] New version detected via onNeedRefresh. Activating...');
      updateSW(true);
    },
    onOfflineReady() {
      console.info('[PWA] App is ready for offline use.');
    },
    onRegisteredSW(swUrl, registration) {
      console.info('[PWA] Service Worker registered:', swUrl);
      if (registration) {
        // Immediate check for updates on startup
        registration.update().catch(() => {});

        // Check for updates when user brings the tab back to focus
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });

        // Periodic check every 5 minutes
        setInterval(() => {
          registration.update().catch(() => {});
        }, 5 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('[PWA] Service Worker registration failed:', error);
    },
  });
}

/**
 * Force unregisters all service workers, clears all CacheStorage caches,
 * and hard-reloads the page to guarantee the user is on the latest build.
 */
export async function forceAppUpdateAndClearCache(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const cacheNames = await window.caches.keys();
      for (const name of cacheNames) {
        await window.caches.delete(name);
      }
    }
  } catch (err) {
    console.warn('[PWA] Failed to clean service workers/caches:', err);
  } finally {
    window.location.reload();
  }
}
