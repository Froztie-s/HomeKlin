import { House } from "lucide-react";
import { appName } from "@/lib/app-name";

type WordmarkProps = {
  /**
   * evergreen: the T3b mark used by the apps. forest: the redesign (markdown/design.md), a forest
   * tile on light pages, a lime tile on the dark footer (`onDark`).
   */
  palette?: "evergreen" | "forest";
  onDark?: boolean;
};

const tiles = {
  evergreen: "rounded-md bg-brand-600 text-on-brand",
  forest: "rounded-sm bg-primary text-on-primary",
  forestOnDark: "rounded-sm bg-lime text-on-lime",
};

// The HomeKlin mark: a house on a coloured tile, then the name in the display face.
export function Wordmark({ palette = "evergreen", onDark = false }: WordmarkProps) {
  const tile = palette === "forest" ? (onDark ? tiles.forestOnDark : tiles.forest) : tiles.evergreen;
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`flex size-8 items-center justify-center ${tile}`}>
        <House className="size-4.5" strokeWidth={2.5} />
      </span>
      <span className={`font-display text-xl font-bold tracking-display ${onDark ? "text-on-band" : "text-ink"}`}>
        {appName()}
      </span>
    </span>
  );
}
