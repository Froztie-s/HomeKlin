import { Suspense, type ReactNode } from "react";
import { AccountSummary } from "@/components/auth/account-summary";
import { Wordmark } from "@/components/brand/wordmark";
import { ClientMessages } from "@/i18n/client-messages";
import { BackOfficeTopBar, HomeWordmark, type HomeLink } from "./back-office-top-bar";
import { LanguageSwitch } from "./language-switch";
import type { BackOfficeNavKey } from "./navigation";
import { RoleBadge } from "./role-badge";
import { SideNavList } from "./side-nav-list";
import { SkipLink } from "./skip-link";

type SidebarShellProps = {
  nav: BackOfficeNavKey;
  /** Shown next to the wordmark: "Agensi" or "Admin" (in the forest tone, in the top bar below 1024 px). */
  roleLabel: string;
  children: ReactNode;
} & (
  | { tone?: "default" }
  | {
      /** The redesign's dark-green sidebar (the admin console, Phase 13; the agency console, D2; the owner dashboard, D3; markdown/design.md). */
      tone: "forest";
      /** The card under the wordmark, in place of the role badge: "Admin Dashboard" over "Operasional HomeKlin". */
      roleCard: RoleCard;
      /** Where the wordmark leads (the console's start page) and its accessible name. */
      home: HomeLink;
      /** A tool on the dark band, under the role card and at the top of the narrow-screen menu (admin's order search). */
      tool?: ReactNode;
    }
);

/**
 * The card under the wordmark. labelLang: the label's language, when it is not the page's. title may be
 * a node: the agency console streams its own agency's name in behind <Suspense> (D2).
 */
type RoleCard = { label: string; labelLang?: string; title: ReactNode };

// Agency and admin shell: desktop-first with a fixed sidebar; a top bar with a menu below 1024 px.
// The sidebar closes with the account (who is signed in, and signing out) and the language switch,
// under the sections, where staff look for settings rather than for work. The account part reads the
// session, so it streams in behind <Suspense> while the rest of the shell stays prerendered. The
// back-office menus' messages are sent to the browser only from here.
// The default tone is the light T3b sidebar (no console uses it since D3); the forest tone is the
// redesign's dark band, used by the agency, admin and owner consoles.
export function SidebarShell(props: SidebarShellProps) {
  const { nav, roleLabel, children } = props;
  const forest = props.tone === "forest";

  return (
    <ClientMessages namespaces={["BackOfficeNavigation", "BackOfficeShell", "SignOut"]}>
      <div className="flex flex-1 flex-col lg:pl-sidebar">
        <SkipLink />
        {props.tone === "forest" ? (
          <ForestSidebar nav={nav} roleCard={props.roleCard} home={props.home} tool={props.tool} />
        ) : (
          <LightSidebar nav={nav} roleLabel={roleLabel} />
        )}
        <BackOfficeTopBar
          nav={nav}
          roleLabel={roleLabel}
          tone={forest ? "forest" : "default"}
          home={props.tone === "forest" ? props.home : undefined}
          tool={props.tone === "forest" ? props.tool : undefined}
          account={
            <Suspense fallback={null}>
              <AccountSummary variant="sidebar" tone={forest ? "forest" : "default"} />
            </Suspense>
          }
        />
        <main id="konten" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          <div className="mx-auto flex w-full max-w-dashboard flex-col gap-6 px-safe py-6 lg:px-gutter-wide lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </ClientMessages>
  );
}

// The T3b sidebar, unchanged (the agency and owner consoles used it until D2 and D3).
function LightSidebar({ nav, roleLabel }: { nav: BackOfficeNavKey; roleLabel: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-(--z-sticky) hidden w-sidebar flex-col border-r border-border bg-panel lg:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <Wordmark />
        <RoleBadge label={roleLabel} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <SideNavList nav={nav} />
      </div>
      <div className="flex flex-col gap-4 border-t border-border px-5 py-4">
        <Suspense fallback={null}>
          <AccountSummary variant="sidebar" />
        </Suspense>
        {/* A block around the switch keeps it at its own width in this column. */}
        <div>
          <LanguageSwitch />
        </div>
      </div>
    </aside>
  );
}

// The redesign's sidebar (markdown/design.md, Layout, sidebar): 256 px of `band` with no edge, the lime
// wordmark tile, a role card on band-raised, the dark items, then the on-dark language switch and the
// signed-in user. on-dark-focus turns the focus ring lime (12.0:1 on band, 8.4:1 on band-raised).
// A tool (admin's order search) sits between the role card and the sections.
function ForestSidebar({ nav, roleCard, home, tool }: { nav: BackOfficeNavKey; roleCard: RoleCard; home: HomeLink; tool?: ReactNode }) {
  return (
    <aside className="on-dark-focus fixed inset-y-0 left-0 z-(--z-sticky) hidden w-sidebar flex-col bg-band text-on-band lg:flex">
      <div className="flex h-16 items-center px-3">
        <HomeWordmark home={home} />
      </div>
      <p className="mx-3 flex flex-col gap-0.5 rounded-md bg-band-raised px-4 py-3">
        <span lang={roleCard.labelLang} className="text-xs text-on-band-muted">
          {roleCard.label}
        </span>
        <span className="text-sm font-semibold text-on-band">{roleCard.title}</span>
      </p>
      {tool ? <div className="mx-3 mt-4">{tool}</div> : null}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <SideNavList nav={nav} tone="forest" />
      </div>
      <div className="flex flex-col gap-4 border-t border-band-raised px-5 py-4">
        {/* A block around the switch keeps it at its own width in this column. */}
        <div>
          <LanguageSwitch palette="forest" onDark />
        </div>
        <Suspense fallback={null}>
          <AccountSummary variant="sidebar" tone="forest" />
        </Suspense>
      </div>
    </aside>
  );
}
