import { MobileShell } from "@/components/shell/mobile-shell";

// The customer app (D5): the shell's forest tone draws the cream app bar and the lime-wash nav pill.
// The home and the orders follow the Customer-* and Phone-* mocks; the pages of pass 5b (live,
// replay, support) keep their components until then, now on the cream page. The language switch is in
// the app bar (app-header.tsx) on every page of the app and at every width; from 16 to 18 Nov 2026 it
// floated at the bottom-left and covered content (UX audit, item 3). The booking flow, without a bar,
// keeps the floating switch (../(booking)/layout.tsx).
export default function CustomerAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileShell nav="customer" tone="forest">
      {children}
    </MobileShell>
  );
}
