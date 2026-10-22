import { Wordmark } from "@/components/brand/wordmark";
import { LanguageSwitch } from "@/components/shell/language-switch";
import { SkipLink } from "@/components/shell/skip-link";
import { ClientMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";

// Sign-in and sign-up (T5): one task per screen, so no app navigation. The slim app bar of the
// customer app (wordmark, language switch) on the app's tokens. Every role signs in here, so the
// wordmark leads to the landing page rather than to one role's home. The forms are client components;
// they get the Auth messages from here, and nothing else.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientMessages namespaces={["Auth"]}>
      <SkipLink />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-top-bar max-w-content items-center justify-between gap-3 px-safe md:h-16 md:px-gutter-wide">
          <Link href="/" className="inline-flex min-h-touch items-center rounded-full">
            <Wordmark />
          </Link>
          <LanguageSwitch />
        </div>
      </header>
      <main id="konten" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
    </ClientMessages>
  );
}
