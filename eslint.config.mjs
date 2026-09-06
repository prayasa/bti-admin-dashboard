import {
  defineConfig,
  globalIgnores,
} from "eslint/config";

import nextVitals from
  "eslint-config-next/core-web-vitals";

import nextTs from
  "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  /*
   * Komponen-komponen berikut sengaja melakukan inisialisasi
   * state ketika effect terhubung dengan sistem eksternal:
   *
   * - pengambilan data Supabase;
   * - langganan Supabase Realtime;
   * - sinkronisasi tema browser;
   * - timer token QR dinamis.
   *
   * Pengecualian dibatasi pada file yang telah diaudit agar
   * aturan tetap aktif pada file lain.
   */
  {
    files: [
      "app/admin/page.tsx",
      "app/admin/pemetaan/page.tsx",
      "app/admin/penugasan/page.tsx",
      "app/admin/presensi/page.tsx",
      "app/admin/teknisi/page.tsx",
      "components/admin/theme-toggle.tsx",
      "components/qr/dynamic-qr-card.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },

  // Override default ignores dari eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;