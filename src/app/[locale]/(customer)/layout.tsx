import { forestFontVariables } from "@/app/fonts-forest";

// Customer pages: mobile-first. Since D5 they opt in to the redesign as the back offices and the
// cleaner app did: `theme-forest` gives the shared token names their redesign values and the wrapper
// loads the redesign's fonts (src/app/fonts-forest.ts). Below it, two route groups pick the chrome
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md, "Opting
// specific route segments into sharing a layout"):
// - (app): the customer app (home, orders, live, recordings, help) with its navigation, the top bar
//   from 768 px and the bottom bar on phones (./(app)/layout.tsx).
// - (booking): the three booking steps (/services, /pesan, /orders/pay), focused: one minimal header
//   with "Kembali" and no navigation (./(booking)/layout.tsx).
// The app has the ID | EN switch in its top bar (UX audit item 3, 2026-11-18: floating, it covered
// content); the booking flow, which has no bar, keeps the floating switch at the bottom-left.
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`theme-forest ${forestFontVariables} flex flex-1 flex-col bg-canvas font-sans text-ink`}>{children}</div>
  );
}
