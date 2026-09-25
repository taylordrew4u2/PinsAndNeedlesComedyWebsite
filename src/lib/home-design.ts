/** Shared defaults keep existing saved sites compatible with the editorial homepage. */
export const homeDesignDefaults = {
  artwork: "/brand/pins-and-needles-flames.svg",
  eyebrow: "Original stand-up · New York City",
  headline: "Comedy about the things that",
  emphasis: "leave a mark.",
  description:
    "Honest stories. Questionable choices. A room full of people who get it.",
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
  { value: "/brand/flash-dice-logo.svg", label: "Flash — dice logo" },
  { value: "/brand/flash-martini.svg", label: "Flash — martini" },
  { value: "/brand/flash-heart-arrow.svg", label: "Flash — heart arrow" },
  { value: "/brand/flash-telephone.svg", label: "Flash — telephone" },
  { value: "/brand/flash-lighter.svg", label: "Flash — lighter" },
  {
    value: "/brand/flash-no-regrets-mouth.svg",
    label: "Flash — no regrets mouth",
  },
  { value: "/brand/flash-good-people.svg", label: "Flash — good people" },
  { value: "/brand/flash-spilled-drink.svg", label: "Flash — spilled drink" },
  { value: "/brand/flash-disco-ball.svg", label: "Flash — disco ball" },
  { value: "/brand/flash-signpost.svg", label: "Flash — signpost" },
  { value: "/brand/flash-trash-fire.svg", label: "Flash — trash fire" },
  { value: "/brand/flash-smoking-heart.svg", label: "Flash — smoking heart" },
  { value: "/brand/flash-pizza.svg", label: "Flash — pizza" },
  { value: "/brand/flash-handcuffs.svg", label: "Flash — handcuffs" },
  { value: "/brand/flash-smiley.svg", label: "Flash — smiley" },
  { value: "/brand/flash-lipstick.svg", label: "Flash — lipstick" },
  { value: "/brand/logo-white.svg", label: "Original white logo" },
];
