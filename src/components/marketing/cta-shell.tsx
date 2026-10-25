import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button-link";
import { landingContainer } from "./landing-layout";

// The closing call to action (markdown/design.md, Layout): a contained forest shell with one sentence
// and the same lime "Pesan sekarang" as the hero (one label per intent). No form: SPEC gives the
// landing one primary action, and booking itself starts in the app. A darker circle bleeds off the
// lower-left corner for depth; it is decoration only.
export function CtaShell() {
  const t = useTranslations("CtaShell");
  return (
    <section id="pesan" aria-labelledby="pesan-title" className={`${landingContainer} pb-16 md:pb-24 xl:pb-30`}>
      <div className="on-dark-focus relative isolate overflow-hidden rounded-xl bg-primary-container px-6 py-12 text-on-primary-container md:px-12 md:py-14 lg:px-14 lg:py-16">
        <span
          aria-hidden="true"
          className="absolute -bottom-48 -left-20 -z-10 size-96 rounded-full bg-primary md:-bottom-56 md:-left-16 md:size-[28rem]"
        />
        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h2
              id="pesan-title"
              className="max-w-2xl font-display text-headline-sm font-semibold md:text-headline-md xl:text-headline"
            >
              {t.rich("title", { accent: (chunks) => <em className="serif-accent text-lime">{chunks}</em> })}
            </h2>
            <p className="mt-4 text-body-lg text-on-band-muted">{t("body")}</p>
          </div>
          <div className="lg:col-span-4 lg:flex lg:justify-end">
            <ButtonLink href="/pesan" variant="accent" size="lg">
              {t("cta")}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
