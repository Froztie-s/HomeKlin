import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import type { AppRole } from "@/lib/auth/roles";
import { firstNameOf, UserAvatar } from "./user-avatar";

type AccountSlotProps = {
  /** evergreen: the T3b app bars. forest: the redesign (the landing header). */
  palette?: "evergreen" | "forest";
  /**
   * Writes the first name beside the avatar from 1024 px, where the landing header has the room.
   * Narrower, the avatar stands alone (44 px, narrower than "Masuk", so a bar that fits "Masuk" fits it).
   */
  showName?: boolean;
};

// Where the chip leads: the account page for the roles that have one (it holds the name and the
// sign-out button), the dashboard for staff (their sidebar holds both).
const destinations = {
  customer: { href: "/account", label: "account" },
  cleaner: { href: "/cleaner/account", label: "account" },
  agency: { href: "/agency", label: "dashboard" },
  admin: { href: "/admin", label: "dashboard" },
} as const satisfies Record<AppRole, { href: string; label: "account" | "dashboard" }>;

const tones = {
  evergreen: {
    signIn: "text-brand-700 hover:bg-brand-50 hover:text-brand-800 active:bg-brand-100",
    chip: "text-ink hover:bg-surface-sunken active:bg-brand-50",
  },
  forest: {
    signIn: "text-ink hover:bg-sunken active:bg-lime-wash",
    chip: "text-ink hover:bg-sunken active:bg-lime-wash",
  },
};

// The account corner of the customer app bar and the landing header (T5): "Masuk" for a visitor, and
// for a signed-in user a chip with their initials (and first name where it fits) that opens their
// account. It reads the session, so it always sits inside <Suspense>: the bar around it stays in the
// prerendered shell and this part streams in.
export async function AccountSlot({ palette = "evergreen", showName = false }: AccountSlotProps) {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations("AccountChip")]);
  const tone = tones[palette];

  if (!user) {
    return (
      <Link
        href="/login"
        className={`inline-flex min-h-touch items-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors duration-150 ease-out-quart ${tone.signIn}`}
      >
        {t("signIn")}
      </Link>
    );
  }

  const { href, label } = destinations[user.role];
  const name = user.fullName.trim();
  const firstName = firstNameOf(name);
  return (
    <Link
      href={href}
      aria-label={name ? t(label, { name }) : t(`${label}NoName`)}
      className={`inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-full p-1 text-sm font-semibold transition-colors duration-150 ease-out-quart ${showName && firstName ? "lg:pr-3.5" : ""} ${tone.chip}`}
    >
      <UserAvatar name={name} size="sm" palette={palette} />
      {showName && firstName ? <span className="hidden max-w-32 truncate lg:inline">{firstName}</span> : null}
    </Link>
  );
}
