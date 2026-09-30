/**
 * The venue's drink menu, as the live screen shows it between sets. Copied
 * from Pixelated Records' printed menu; edit here when their list changes.
 */
export type Drink = { name: string; price?: string; detail?: string };
export type DrinkSection = { title: string; price?: string; drinks: Drink[] };

export const DRINK_MENU: DrinkSection[][] = [
  [
    {
      title: "Beers, Cider, Seltzer",
      drinks: [
        { name: "White Claw Black Cherry", price: "$4" },
        { name: "Modelo Especial", price: "$5" },
        { name: "Chelada", price: "$7", detail: "Glass of Ice, Lime & Salt" },
        { name: "Hudson North Big Apple Cider", price: "$6", detail: "Crisp" },
        { name: "KCBC Superhero Sidekicks", price: "$7", detail: "Hazy IPA" },
        { name: "Back Home Beer Sumac Gose", price: "$8", detail: "Tart Cherry" },
      ],
    },
    {
      title: "Non-Alcoholic",
      drinks: [
        { name: "Athletic Free Wave", price: "$6", detail: "Hazy IPA" },
        { name: "Athletic Fruited Fields", price: "$6", detail: "Radler" },
      ],
    },
  ],
  [
    {
      title: "Specialty Cocktails",
      price: "$13",
      drinks: [
        { name: "Gucci Lemonade", detail: "Gin · Vermouth · Lemon Juice · Simple Syrup · Bitters · Sparkling Water" },
        { name: "Whiskey Winehouse", detail: "Whiskey · Malbec · Lemon Juice · Simple Syrup · Cardamom" },
        { name: "Cherry Funk", detail: "Rum · Vermouth · Cherry Blossom Extract · Coconut Extract · Lemon Juice · Ginger Beer · Pineapple" },
      ],
    },
    {
      title: "Highballs",
      price: "$11",
      drinks: [
        { name: "Choice of Well Spirit + Mixer", detail: "Gin · Rum · Tequila · Vodka · Whiskey" },
        { name: "Mixers", detail: "Club Soda · Tonic · Lemon/Sour · Ginger Ale · Cranberry · Cola" },
      ],
    },
  ],
  [
    {
      title: "Red Wine",
      drinks: [
        { name: "Vigna Madre Kriya", price: "$8", detail: "Montepulciano · Italy" },
        { name: "Bernardus", price: "$9", detail: "Pinot Noir · Santa Lucia Highlands · ’23" },
        { name: "Gérard Bertrand Naturae", price: "$10", detail: "Cabernet Sauvignon · France · ’24" },
      ],
    },
    {
      title: "White Wine",
      drinks: [
        { name: "Oyster Bay", price: "$9", detail: "Sauvignon Blanc · New Zealand" },
        { name: "Cave de Lugny Mâcon-Villages", price: "$9", detail: "Chardonnay · France · ’23" },
        { name: "Viña Echeverría No Es Pituko", price: "$11", detail: "Orange · Chile" },
      ],
    },
    {
      title: "Rosé & Sparkling",
      drinks: [
        { name: "Josh Scott Bla Bla Bla", price: "$8", detail: "Rosé · New Zealand · ’22" },
        { name: "Maschio DOC Treviso Brut", price: "$10", detail: "Prosecco · Italy" },
      ],
    },
  ],
];

/** Stored flag for "the drink menu is on the live screen". Anything malformed reads as off. */
export function parseMenuFlag(raw: unknown): boolean {
  return Boolean(raw && typeof raw === "object" && (raw as { on?: unknown }).on === true);
}
