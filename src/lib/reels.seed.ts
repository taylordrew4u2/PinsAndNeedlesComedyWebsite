import type { Reel } from "./types";

/**
 * Reels from https://www.instagram.com/pinsandneedlescomedy/reels/, newest
 * first. The homepage shows these only until Instagram is connected in the
 * admin; after that, synced reels replace them and new posts show up on
 * their own.
 */
const SHORTCODES = [
  "DdUOnlgRvMf",
  "Dc_5HLbNavH",
  "Db03V_wsaSA",
  "DbgS97sACsF",
  "DQZp3CQAHBo",
  "DOrKuG2kWcx",
];

export const seedReels: Reel[] = SHORTCODES.map((code, index) => ({
  id: `seed-${code}`,
  instagramUrl: `https://www.instagram.com/reel/${code}/`,
  videoUrl: "",
  posterUrl: "",
  caption: "",
  alt: "Pins & Needles Comedy Instagram reel",
  order: index,
  published: true,
  igTimestamp: "",
  igMediaId: "",
}));
