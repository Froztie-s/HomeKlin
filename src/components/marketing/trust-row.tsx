import { ClipboardCheck, History, Lock, MapPinCheck, type LucideIcon } from "lucide-react";
import { withNoBreak } from "@/components/ui/no-break";
import { landingContainer } from "./landing-layout";

type Fact = { text: string; icon: LucideIcon };

// Only what markdown/SPEC.md backs (Landing page, Streaming): who can watch, the check-in at the
// address, the 7-day recordings, consent at booking. Never a number or a rating we do not have.
const copy = {
  title: "Di setiap pesanan",
  facts: [
    { text: "Siaran hanya untuk Anda dan tim pemantau HomeKlin", icon: Lock },
    { text: "Petugas check-in di alamat Anda sebelum bekerja", icon: MapPinCheck },
    { text: "Rekaman disimpan 7 hari, lalu dihapus", icon: History },
    { text: "Persetujuan siaran ditanyakan saat memesan", icon: ClipboardCheck },
  ] satisfies Fact[],
};

// The trust row under the hero (markdown/design.md, Layout): four plain facts between two hairlines.
// Four columns from 1024 px, two from 640 px, one on phones.
export function TrustRow() {
  return (
    <section aria-labelledby="fakta-title" className={landingContainer}>
      <h2 id="fakta-title" className="sr-only">
        {copy.title}
      </h2>
      <ul className="grid gap-x-8 gap-y-5 border-y border-border py-8 sm:grid-cols-2 lg:grid-cols-4 lg:py-10">
        {copy.facts.map((fact) => {
          const Icon = fact.icon;
          return (
            <li key={fact.text} className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-lime-wash text-on-lime-wash">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-ink">{withNoBreak(fact.text, "check-in")}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
