/** Shared defaults keep existing saved sites compatible with the editorial homepage. */
export const homeDesignDefaults = {
  artwork: "/brand/pins-and-needles-flames.svg",
  eyebrow: "Original stand-up · New York City",
  headline: "Comedy about the things that",
  emphasis: "leave a mark.",
  description:
    "Honest stories. Questionable judgment. A room full of people who get it.",
  note: "You don’t need tattoos. Questionable judgment will do.",
};
export type HomeDesign = typeof homeDesignDefaults;

export const homeArtworkOptions = [
  {
    value: "/brand/pins-and-needles-flames.svg",
    label: "Pins & Needles — flames",
  },
  {
    value: "/brand/pins-and-needles-heart.svg",
    label: "Pins & Needles — heart",
  },
  { value: "/brand/bad-decisions-dice.svg", label: "Bad Decisions — dice" },
  {
    value: "/brand/bad-decisions-flash-sheet.svg",
    label: "Bad Decisions — flash sheet",
  },
  { value: "/brand/logo-white.svg", label: "Original white logo" },
];
