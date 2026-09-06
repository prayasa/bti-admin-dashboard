"use client";

import { useEffect } from "react";

const STAFF_SERVICE_WORKER_PATH =
  "/staff-sw.js";

const STAFF_SERVICE_WORKER_SCOPE = "/staff";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const expectedScope = new URL(
          STAFF_SERVICE_WORKER_SCOPE,
          window.location.origin,
        ).href;

        const registrations =
          await navigator.serviceWorker.getRegistrations();

        for (const registration of registrations) {
          const workerScriptUrl =
            registration.active?.scriptURL ||
            registration.waiting?.scriptURL ||
            registration.installing?.scriptURL ||
            "";

          if (
            workerScriptUrl.endsWith(
              STAFF_SERVICE_WORKER_PATH,
            ) &&
            registration.scope !== expectedScope
          ) {
            await registration.unregister();
          }
        }

        await navigator.serviceWorker.register(
          STAFF_SERVICE_WORKER_PATH,
          {
            scope: STAFF_SERVICE_WORKER_SCOPE,
            updateViaCache: "none",
          },
        );
      } catch (error) {
        console.error(
          "Service worker BTI Staff gagal didaftarkan:",
          error,
        );
      }
    };

    void registerServiceWorker();
  }, []);

  return null;
}
