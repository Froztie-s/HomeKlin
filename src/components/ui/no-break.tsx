import type { ReactNode } from "react";

/**
 * Keeps one phrase of a sentence on a single line. Browsers may wrap after a hyphen, which splits
 * words such as "check-in" into "check-" and "in"; the rest of the sentence wraps normally.
 */
export function withNoBreak(text: string, phrase: string): ReactNode {
  const index = text.indexOf(phrase);
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <span className="whitespace-nowrap">{phrase}</span>
      {text.slice(index + phrase.length)}
    </>
  );
}
