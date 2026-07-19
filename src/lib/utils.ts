// Minimal classnames joiner. The project doesn't depend on clsx/tailwind-merge,
// so this just filters out falsy values and joins the rest — enough for the
// string-only className usage in components like KineticText.
export function cn(...inputs: Array<string | number | false | null | undefined>): string {
  return inputs.filter(Boolean).join(' ');
}
