import { UserRound } from "lucide-react";

type UserAvatarProps = {
  /** The user's full name; the avatar shows its initials. */
  name: string;
  /** sm 36 px (inside a 44 px chip), md 40 px (back-office sidebar), lg 56 px (account page). */
  size?: "sm" | "md" | "lg";
  /** evergreen: the T3b apps. forest: the redesign (the landing page). */
  palette?: "evergreen" | "forest";
};

const sizes = {
  sm: "size-9 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
};

const palettes = {
  evergreen: "bg-brand-100 text-brand-800",
  forest: "bg-lime-wash text-on-lime-wash",
};

/** "Siti Nurhaliza" -> "SN", "Budi" -> "B", "" -> "". Whole characters, so a name may start with any letter. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = [...words[0]][0];
  const last = words.length > 1 ? [...words[words.length - 1]][0] : "";
  return `${first}${last}`.toLocaleUpperCase();
}

/** The first word of a name, for the account chip: "Siti Nurhaliza" -> "Siti". */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

// The signed-in user as a round tile with their initials (a person icon when there is no name).
// Decorative: the name is always written next to it or in the accessible name of its link.
export function UserAvatar({ name, size = "md", palette = "evergreen" }: UserAvatarProps) {
  const initials = initialsOf(name);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold ${sizes[size]} ${palettes[palette]}`}
    >
      {initials || <UserRound className="size-1/2" />}
    </span>
  );
}
