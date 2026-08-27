export const displayFonts = [
  {
    value: "editorial",
    label: "Editorial",
    description: "A refined serif with a calm, considered voice.",
    className: "profile-font-editorial",
  },
  {
    value: "modern",
    label: "Modern",
    description: "A clean sans-serif built for clarity.",
    className: "profile-font-modern",
  },
  {
    value: "terminal",
    label: "Terminal",
    description: "A developer-focused monospace.",
    className: "profile-font-terminal",
  },
  {
    value: "display",
    label: "Display",
    description: "A stronger, more graphic headline style.",
    className: "profile-font-display",
  },
  {
    value: "signature",
    label: "Signature",
    description: "An expressive handwritten-style accent.",
    className: "profile-font-signature",
  },
] as const;

export const backgroundStyles = [
  { value: "none", label: "None", description: "The original warm-black canvas." },
  { value: "aurora", label: "Aurora", description: "Faint blue and violet light forms." },
  { value: "signal", label: "Signal", description: "Sparse directional accent lines." },
  { value: "blueprint", label: "Blueprint", description: "A quiet technical grid." },
  { value: "ember", label: "Ember", description: "A restrained warm glow." },
] as const;

export type DisplayFont = (typeof displayFonts)[number]["value"];
export type BackgroundStyle = (typeof backgroundStyles)[number]["value"];

export const defaultDisplayFont: DisplayFont = "editorial";
export const defaultBackgroundStyle: BackgroundStyle = "none";

export function getDisplayFontClass(value: string | null | undefined) {
  return (
    displayFonts.find((option) => option.value === value)?.className ??
    displayFonts[0].className
  );
}

export function normalizeDisplayFont(
  value: string | null | undefined,
): DisplayFont {
  return displayFonts.some((option) => option.value === value)
    ? (value as DisplayFont)
    : defaultDisplayFont;
}

export function normalizeBackgroundStyle(
  value: string | null | undefined,
): BackgroundStyle {
  return backgroundStyles.some((option) => option.value === value)
    ? (value as BackgroundStyle)
    : defaultBackgroundStyle;
}
