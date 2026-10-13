export type KinType = "glass" | "ember" | "tide" | "thorn";

export type Move = {
  name: string;
  type: KinType | "neutral";
  power: number;
};

export type Species = {
  id: string;
  name: string;
  type: KinType;
  blurb: string;
  catch: number;
  hp: number;
  atk: number;
  rare?: boolean;
  moves: [Move, Move];
};

export const BEATS: Record<KinType, KinType> = {
  glass: "ember",
  ember: "thorn",
  thorn: "tide",
  tide: "glass",
};

const strike = (name: string, power: number): Move => ({ name, type: "neutral", power });

export const SPECIES: Species[] = [
  {
    id: "mote",
    name: "Mote",
    type: "glass",
    blurb: "A shard that learned to see.",
    catch: 0.62,
    hp: 28,
    atk: 6,
    moves: [strike("Glance", 6), { name: "Pane", type: "glass", power: 10 }],
  },
  {
    id: "kiln",
    name: "Kiln",
    type: "ember",
    blurb: "The oven grew legs.",
    catch: 0.48,
    hp: 42,
    atk: 9,
    moves: [strike("Clack", 7), { name: "Vent", type: "ember", power: 11 }],
  },
  {
    id: "brine",
    name: "Brine",
    type: "tide",
    blurb: "Bottle-glass, still holding the sea.",
    catch: 0.52,
    hp: 32,
    atk: 7,
    moves: [strike("Bell", 6), { name: "Well", type: "tide", power: 10 }],
  },
  {
    id: "thornbuck",
    name: "Thornbuck",
    type: "thorn",
    blurb: "Willow, braided, and armed.",
    catch: 0.44,
    hp: 46,
    atk: 8,
    moves: [strike("Tine", 7), { name: "Bramble", type: "thorn", power: 11 }],
  },
  {
    id: "lantern",
    name: "Lantern",
    type: "glass",
    blurb: "The fox carries its own evening.",
    catch: 0.36,
    hp: 36,
    atk: 8,
    moves: [strike("Prowl", 7), { name: "Wick", type: "glass", power: 12 }],
  },
  {
    id: "cinderwing",
    name: "Cinderwing",
    type: "ember",
    blurb: "Coal that decided to fly.",
    catch: 0.34,
    hp: 34,
    atk: 11,
    moves: [strike("Soot", 7), { name: "Seam", type: "ember", power: 13 }],
  },
  {
    id: "kelp",
    name: "Kelp",
    type: "tide",
    blurb: "The lure is older than the dock.",
    catch: 0.3,
    hp: 48,
    atk: 10,
    moves: [strike("Coil", 8), { name: "Lure", type: "tide", power: 12 }],
  },
  {
    id: "vespers",
    name: "Vespers",
    type: "glass",
    blurb: "A bell that left the tower.",
    catch: 0.22,
    hp: 54,
    atk: 12,
    rare: true,
    moves: [strike("Toll", 8), { name: "Choir", type: "glass", power: 14 }],
  },
];

export const byId = (id: string) => SPECIES.find((s) => s.id === id) ?? SPECIES[0];

export function advantage(move: KinType | "neutral", defender: KinType) {
  if (move === "neutral") return 1;
  if (BEATS[move] === defender) return 1.5;
  if (BEATS[defender] === move) return 0.75;
  return 1;
}

export function rollSpecies(exclude: string[]) {
  const pool = SPECIES.filter((s) => !exclude.includes(s.id));
  const bag = pool.length ? pool : SPECIES;
  const weighted = bag.flatMap((s) => (s.rare ? [s] : [s, s, s]));
  return weighted[Math.floor(Math.random() * weighted.length)];
}
