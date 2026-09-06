"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register(
          "/staff-sw.js",
          {
            scope: "/staff/",
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
