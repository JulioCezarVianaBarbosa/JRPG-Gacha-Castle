// ─── Eternal Dominion: core types & static data ────────────────────────────

export type Rarity = "common" | "rare" | "epic" | "legendary";
export type ResKey = "gold" | "wood" | "stone" | "food" | "crystal";

export interface Resources {
  gold: number;
  wood: number;
  stone: number;
  food: number;
  crystal: number;
}

export type PartialRes = Partial<Resources>;

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#93a9bd",
  rare: "#4f9fe0",
  epic: "#b06ae0",
  legendary: "#f5b942",
};
export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export type WeaponKind =
  | "sword" | "bow" | "staff" | "spear" | "dagger" | "axe" | "book" | "lance";

export type SkillKind = "dmg" | "aoe" | "heal";

export interface Palette {
  hair: string;
  skin: string;
  outfit: string;
  accent: string;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  rarity: Rarity;
  hp: number;
  atk: number;
  spd: number;
  skill: { name: string; kind: SkillKind; mult: number; cd: number };
  palette: Palette;
  weapon: WeaponKind;
  quote: string;
}

export interface Item {
  id: number;
  name: string;
  atk: number;
  rarity: Rarity;
}

export interface ExpeditionState {
  kind: string;
  endsAt: number;
}

export interface HeroInst {
  uid: number;
  defId: string;
  level: number;
  stars: number;
  exp: number;
  deployed: boolean;
  equip: Item | null;
  expedition: ExpeditionState | null;
}

export type BuildingId = "farm" | "market" | "barracks" | "smithy" | "library";

export interface BuildingDef {
  id: BuildingId;
  name: string;
  desc: string;
  produces: ResKey | "forge" | null;
  rate: number; // per second at level 1 baseline
  base: Partial<Resources>;
  unlockCastle: number;
}

export interface ResearchState {
  agri: number;
  war: number;
  trade: number;
}

export interface MailMsg {
  id: number;
  from: string;
  title: string;
  body: string;
  gift: Partial<Resources>;
  claimed: boolean;
  day: number;
}

export interface QuestDef {
  id: string;
  text: string;
  type: "collect" | "build" | "construct" | "summon" | "stage" | "expedition" | "mail";
  kind?: ResKey;
  target: number;
  reward: Partial<Resources>;
}

export interface EventChoice {
  label: string;
  res?: Partial<Resources>;
  buff?: { stat: "prod" | "atk" | "gold"; mult: number; days: number };
  note: string;
}

export interface GameEvent {
  id: string;
  title: string;
  text: string;
  choices: EventChoice[];
}

export interface Buffs {
  prod: number;
  atk: number;
  gold: number;
  prodUntil: number;
  atkUntil: number;
  goldUntil: number;
}

export interface GameState {
  v: number;
  name: string;
  createdAt: number;
  res: Resources;
  castleLv: number;
  buildings: Record<BuildingId, { lv: number; acc: number; forgeT: number; pendingForge: Item | null }>;
  research: ResearchState;
  heroes: HeroInst[];
  nextUid: number;
  inventory: Item[];
  nextItemId: number;
  campaignStage: number; // highest unlocked stage
  day: number;
  weather: "clear" | "rain" | "snow";
  questIdx: number;
  questProg: number;
  pity: number;
  buffs: Buffs;
  mail: MailMsg[];
  nextMailId: number;
  stats: { battlesWon: number; summons: number; slain: number; collected: number; forged: number };
  muted: boolean;
  log: string[];
  pendingEvent: GameEvent | null;
  banner: { text: string; sub: string; ts: number } | null;
}

// ─── Heroes ────────────────────────────────────────────────────────────────

export const HERO_DEFS: HeroDef[] = [
  { id: "aldric", name: "Aldric", title: "the Steadfast", rarity: "common", hp: 135, atk: 27, spd: 8, weapon: "sword", skill: { name: "Shield Bash", kind: "dmg", mult: 1.7, cd: 2 }, palette: { hair: "#7a5230", skin: "#f0c8a0", outfit: "#6e7b8a", accent: "#c8d2dc" }, quote: "The wall holds because we hold." },
  { id: "wren", name: "Wren", title: "the Swift", rarity: "common", hp: 100, atk: 31, spd: 12, weapon: "bow", skill: { name: "Piercing Shot", kind: "dmg", mult: 1.8, cd: 2 }, palette: { hair: "#3d5a3a", skin: "#e8b890", outfit: "#4a6741", accent: "#a8c090" }, quote: "I never miss twice." },
  { id: "mira", name: "Mira", title: "the Kind", rarity: "rare", hp: 105, atk: 24, spd: 9, weapon: "book", skill: { name: "Healing Light", kind: "heal", mult: 1.7, cd: 3 }, palette: { hair: "#e8d090", skin: "#f5d5b5", outfit: "#e8e0d0", accent: "#f5b942" }, quote: "Wounds mend. So do kingdoms." },
  { id: "selene", name: "Selene", title: "of the Moon", rarity: "rare", hp: 95, atk: 36, spd: 11, weapon: "staff", skill: { name: "Moon Bolt", kind: "dmg", mult: 2.0, cd: 2 }, palette: { hair: "#c0c8e8", skin: "#f0d0b8", outfit: "#3a5a7a", accent: "#8ab8e8" }, quote: "The moon remembers every oath." },
  { id: "dorn", name: "Dorn", title: "the Red", rarity: "rare", hp: 150, atk: 33, spd: 7, weapon: "axe", skill: { name: "Crimson Cleave", kind: "aoe", mult: 1.05, cd: 3 }, palette: { hair: "#8a3020", skin: "#d8a880", outfit: "#7a3a2a", accent: "#d05030" }, quote: "Swing first. Feast after." },
  { id: "kael", name: "Kael", title: "the Whisper", rarity: "rare", hp: 92, atk: 38, spd: 14, weapon: "dagger", skill: { name: "Shadowstrike", kind: "dmg", mult: 2.3, cd: 3 }, palette: { hair: "#2a2e3a", skin: "#e0b898", outfit: "#3a3f52", accent: "#8a93b8" }, quote: "You heard nothing. Good." },
  { id: "seraphine", name: "Seraphine", title: "the Dawn", rarity: "epic", hp: 160, atk: 38, spd: 9, weapon: "lance", skill: { name: "Dawn Blessing", kind: "heal", mult: 1.9, cd: 3 }, palette: { hair: "#f0e0a0", skin: "#f5d8b8", outfit: "#d8b040", accent: "#fff0c0" }, quote: "Dawn favors the brave." },
  { id: "lyra", name: "Lyra", title: "the Tempest", rarity: "epic", hp: 100, atk: 44, spd: 12, weapon: "book", skill: { name: "Storm Chorus", kind: "aoe", mult: 1.35, cd: 3 }, palette: { hair: "#c04848", skin: "#f0c8a8", outfit: "#6a2838", accent: "#f08060" }, quote: "Sing, and the sky answers." },
  { id: "vex", name: "Vex", title: "the Hollow", rarity: "epic", hp: 140, atk: 46, spd: 10, weapon: "sword", skill: { name: "Umbral Rend", kind: "dmg", mult: 2.4, cd: 3 }, palette: { hair: "#3a2a4a", skin: "#d8c0b0", outfit: "#2a2238", accent: "#8a5ab0" }, quote: "I borrowed this darkness. Briefly." },
  { id: "ryn", name: "Ryn", title: "Dragonsbane", rarity: "legendary", hp: 175, atk: 52, spd: 11, weapon: "spear", skill: { name: "Skyfall Lance", kind: "aoe", mult: 1.55, cd: 3 }, palette: { hair: "#f5b942", skin: "#e8b890", outfit: "#a03030", accent: "#f5d878" }, quote: "The sky owed me a favor." },
  { id: "aria", name: "Aria", title: "the Saint", rarity: "legendary", hp: 150, atk: 44, spd: 10, weapon: "staff", skill: { name: "Sanctuary", kind: "heal", mult: 2.3, cd: 4 }, palette: { hair: "#f5f0e8", skin: "#f5dcc0", outfit: "#f0e8d8", accent: "#f5b942" }, quote: "Even ruin can be a cradle." },
  { id: "orion", name: "Orion", title: "the Unbound", rarity: "legendary", hp: 115, atk: 58, spd: 13, weapon: "book", skill: { name: "Time Fracture", kind: "dmg", mult: 2.9, cd: 4 }, palette: { hair: "#8ab8e8", skin: "#e8c8a8", outfit: "#2a4a6a", accent: "#a0d8f0" }, quote: "I have seen this battle. We win." },
];

export const AFFINITIES: { a: string; b: string; name: string; bonus: number }[] = [
  { a: "aldric", b: "wren", name: "Old Companions", bonus: 0.08 },
  { a: "selene", b: "lyra", name: "Arcane Sisters", bonus: 0.1 },
  { a: "vex", b: "seraphine", name: "Rivals of Dawn", bonus: 0.07 },
  { a: "dorn", b: "ryn", name: "Dragon Hunters", bonus: 0.1 },
  { a: "mira", b: "aria", name: "Circle of Mercy", bonus: 0.12 },
  { a: "kael", b: "orion", name: "Stolen Hours", bonus: 0.09 },
];

// ─── Buildings ─────────────────────────────────────────────────────────────

export const BUILDING_DEFS: BuildingDef[] = [
  { id: "farm", name: "Royal Farm", desc: "Feeds the realm. Produces food over time.", produces: "food", rate: 0.7, base: { gold: 60, wood: 40 }, unlockCastle: 1 },
  { id: "market", name: "Trade Market", desc: "Merchants pay tribute. Produces gold.", produces: "gold", rate: 1.1, base: { gold: 80, wood: 50 }, unlockCastle: 1 },
  { id: "barracks", name: "Barracks", desc: "Unlocks expeditions. +1 expedition slot per 2 levels.", produces: null, rate: 0, base: { gold: 100, stone: 60 }, unlockCastle: 2 },
  { id: "smithy", name: "Forge Works", desc: "The smith forges equipment over time.", produces: "forge", rate: 0, base: { gold: 120, stone: 80, wood: 40 }, unlockCastle: 2 },
  { id: "library", name: "Athenaeum", desc: "Unlocks research: Agriculture, War, Commerce.", produces: null, rate: 0, base: { gold: 140, wood: 90 }, unlockCastle: 3 },
];

export const CASTLE_BASE: Partial<Resources> = { gold: 200, wood: 120, stone: 90 };

// ─── Quests ────────────────────────────────────────────────────────────────

export const QUESTS: QuestDef[] = [
  { id: "q1", text: "Gather 3 wood piles glowing in the hall", type: "collect", kind: "wood", target: 3, reward: { gold: 80, crystal: 20 } },
  { id: "q2", text: "Gather 3 stone piles in the hall", type: "collect", kind: "stone", target: 3, reward: { gold: 100, crystal: 20 } },
  { id: "q3", text: "Claim the welcome letter at the mail post", type: "mail", target: 1, reward: { crystal: 30 } },
  { id: "q4", text: "Build the Royal Farm (construction board)", type: "construct", target: 1, reward: { crystal: 40, food: 60 } },
  { id: "q5", text: "Summon a hero at the Summoning Circle", type: "summon", target: 1, reward: { crystal: 60 } },
  { id: "q6", text: "Win Campaign Stage 1 (through the gate)", type: "stage", target: 1, reward: { crystal: 80, gold: 150 } },
  { id: "q7", text: "Upgrade the Castle to level 2", type: "build", target: 2, reward: { crystal: 100 } },
  { id: "q8", text: "Send a hero on an expedition (war table)", type: "expedition", target: 1, reward: { crystal: 60 } },
  { id: "q9", text: "Win Campaign Stage 3", type: "stage", target: 3, reward: { crystal: 120, wood: 60 } },
  { id: "q10", text: "Upgrade the Castle to level 3", type: "build", target: 3, reward: { crystal: 150, stone: 60 } },
];

export function questAt(idx: number): QuestDef {
  if (idx < QUESTS.length) return QUESTS[idx];
  const n = idx - QUESTS.length + 1;
  const cycle = n % 3;
  if (cycle === 1) return { id: `g${n}`, text: `Win Campaign Stage ${3 + n}`, type: "stage", target: 3 + n, reward: { crystal: 40 + n * 8, gold: 80 + n * 20 } };
  if (cycle === 2) return { id: `g${n}`, text: `Summon ${1 + Math.floor(n / 3)} more heroes`, type: "summon", target: 1 + Math.floor(n / 3), reward: { crystal: 60 + n * 6 } };
  return { id: `g${n}`, text: `Gather ${4 + Math.floor(n / 2)} resources in the hall`, type: "collect", kind: (["wood", "stone", "food"] as ResKey[])[n % 3], target: 4 + Math.floor(n / 2), reward: { crystal: 50 + n * 6, gold: 100 } };
}

// ─── Events / council decrees ──────────────────────────────────────────────

export const EVENTS: GameEvent[] = [
  { id: "caravan", title: "Traveling Caravan", text: "A caravan offers surplus timber in exchange for gold. The merchants await your word, Governor.", choices: [ { label: "Trade 60 gold", res: { gold: -60, wood: 90 }, note: "+90 Wood" }, { label: "Wave them on", note: "The caravan departs at dawn." } ] },
  { id: "dragon", title: "Dragon Overflight", text: "A crimson dragon circles the keep. The garrison trembles — but your heroes seem... inspired.", choices: [ { label: "Let them watch", buff: { stat: "atk", mult: 1.12, days: 2 }, note: "Heroes +12% ATK for 2 days" }, { label: "Sound the horns", res: { crystal: 15 }, note: "+15 Crystals for vigilance" } ] },
  { id: "festival", title: "Harvest Festival", text: "The villagers ask for a festival to lift spirits after the war. Granaries or gaiety?", choices: [ { label: "Hold the festival", buff: { stat: "prod", mult: 1.2, days: 2 }, note: "Production +20% for 2 days" }, { label: "Store the surplus", res: { food: 120, gold: 60 }, note: "+120 Food, +60 Gold" } ] },
  { id: "plea", title: "A Village in Need", text: "Elders from a burned village beg for food. Charity is costly — but loyalty is priceless.", choices: [ { label: "Send 80 food", res: { food: -80, crystal: 25 }, note: "+25 Crystals of gratitude" }, { label: "Refuse", note: "The elders leave in silence." } ] },
  { id: "merchant", title: "The Rare Merchant", text: "A hooded merchant unveils a masterwork blade. 'For the Governor alone — 200 gold.'", choices: [ { label: "Buy it (200g)", res: { gold: -200 }, note: "A fine weapon joins your forge stores" }, { label: "Decline", note: "He vanishes into the crowd." } ] },
  { id: "bandits", title: "Bandit Ultimatum", text: "Bandits demand tribute at the crossroads. Your captains await orders.", choices: [ { label: "Send hunters", res: { food: -40, crystal: 60 }, note: "+60 Crystals of bounty (−40 rations)" }, { label: "Pay 100 gold", res: { gold: -100 }, note: "The roads stay quiet. For now." } ] },
  { id: "rains", title: "The Long Rains", text: "Storm clouds gather over the valley. The stewards ask how to prepare.", choices: [ { label: "Open the sluices", buff: { stat: "prod", mult: 1.25, days: 2 }, note: "Production +25% for 2 days" }, { label: "Reinforce stores", res: { wood: 70, stone: 50 }, note: "+70 Wood, +50 Stone" } ] },
  { id: "envoy", title: "Royal Envoy", text: "An envoy of the old crown arrives bearing gifts — and expectations.", choices: [ { label: "Accept crystals", res: { crystal: 50 }, note: "+50 Crystals" }, { label: "Ask for gold", res: { gold: 160 }, note: "+160 Gold" } ] },
];

// ─── Expeditions ───────────────────────────────────────────────────────────

export interface ExpeditionDef {
  id: string;
  name: string;
  desc: string;
  dur: number; // seconds
  loot: Partial<Resources>;
  bonus?: string;
}

export const EXPEDITIONS: ExpeditionDef[] = [
  { id: "mine", name: "Mining Run", desc: "Dig stone and timber from the old quarries.", dur: 90, loot: { stone: 45, wood: 30 } },
  { id: "ruins", name: "Scout the Ruins", desc: "Raid the sunken ruins for relics.", dur: 150, loot: { crystal: 35, gold: 60 }, bonus: "May find equipment" },
  { id: "caravan2", name: "Escort Caravan", desc: "Guard merchants along the king's road.", dur: 120, loot: { gold: 130 } },
  { id: "hunt", name: "Monster Hunt", desc: "Cull beasts in the western woods.", dur: 100, loot: { food: 90, gold: 40 } },
  { id: "trade", name: "River Trade", desc: "Negotiate crystal shipments downriver.", dur: 240, loot: { crystal: 70, gold: 90 } },
];

// ─── Enemies & campaign ────────────────────────────────────────────────────

export type EnemyDrawKind = "blob" | "beast" | "humanoid" | "skeleton" | "imp" | "golem" | "dragon" | "lich";

export interface EnemyDef {
  id: string;
  name: string;
  kind: EnemyDrawKind;
  c1: string;
  c2: string;
  boss?: boolean;
}

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  slime: { id: "slime", name: "Gloom Slime", kind: "blob", c1: "#4fae6a", c2: "#2a7a48" },
  spore: { id: "spore", name: "Sporeling", kind: "blob", c1: "#b07ae0", c2: "#7a4aa8" },
  wolf: { id: "wolf", name: "Dire Wolf", kind: "beast", c1: "#7a8494", c2: "#4a5262" },
  boar: { id: "boar", name: "Tusk Boar", kind: "beast", c1: "#a06a4a", c2: "#6a4030" },
  bandit: { id: "bandit", name: "Road Bandit", kind: "humanoid", c1: "#8a5a3a", c2: "#5a3a28" },
  brigand: { id: "brigand", name: "Brigand Chief", kind: "humanoid", c1: "#a04040", c2: "#6a2828" },
  skeleton: { id: "skeleton", name: "Restless Bones", kind: "skeleton", c1: "#d8d0c0", c2: "#a09880" },
  wraith: { id: "wraith", name: "Hollow Wraith", kind: "imp", c1: "#6a8ac0", c2: "#3a5a90" },
  imp: { id: "imp", name: "Cinder Imp", kind: "imp", c1: "#e06a3a", c2: "#a03a20" },
  golem: { id: "golem", name: "Rune Golem", kind: "golem", c1: "#8a93a0", c2: "#5a6270" },
  ogre: { id: "ogre", name: "Crag Ogre", kind: "golem", c1: "#7aa05a", c2: "#4a7038" },
  dragon: { id: "dragon", name: "Ashwing Dragon", kind: "dragon", c1: "#c04848", c2: "#7a2828", boss: true },
  lich: { id: "lich", name: "Lich of Sorrows", kind: "lich", c1: "#8ab8c8", c2: "#4a7888", boss: true },
  titan: { id: "titan", name: "Warlock Titan", kind: "golem", c1: "#b06ae0", c2: "#6a3a90", boss: true },
};

export interface StageEnemy {
  def: EnemyDef;
  hp: number;
  atk: number;
}

export interface StageDef {
  n: number;
  biome: string;
  enemies: StageEnemy[];
  gold: number;
  crystal: number;
  exp: number;
  boss: boolean;
}

const BIOMES = ["Emerald Forest", "Amber Plains", "Echo Caves", "Sunken Ruins", "Storm Peak"];
const BIOME_POOLS: string[][] = [
  ["slime", "spore", "wolf"],
  ["boar", "bandit", "slime"],
  ["skeleton", "imp", "spore"],
  ["wraith", "skeleton", "brigand"],
  ["imp", "golem", "ogre"],
];
const BOSSES = ["dragon", "lich", "titan"];

export function makeStage(n: number): StageDef {
  const biomeIdx = Math.floor((n - 1) / 5) % BIOMES.length;
  const boss = n % 5 === 0;
  const pool = BIOME_POOLS[biomeIdx];
  const enemies: StageEnemy[] = [];
  const mk = (id: string, hpMult: number, atkMult: number): StageEnemy => {
    const d = ENEMY_DEFS[id];
    const jitter = () => 0.92 + Math.random() * 0.16;
    return {
      def: d,
      hp: Math.round(75 * Math.pow(1.19, n - 1) * hpMult * jitter()),
      atk: Math.round(15 * Math.pow(1.15, n - 1) * atkMult * jitter()),
    };
  };
  if (boss) {
    enemies.push(mk(BOSSES[biomeIdx % BOSSES.length], 3.4, 1.5));
  } else {
    const count = 1 + ((n - 1) % 3);
    for (let i = 0; i < count; i++) enemies.push(mk(pool[Math.floor(Math.random() * pool.length)], 1, 1));
  }
  return {
    n,
    biome: boss ? `${BIOMES[biomeIdx]} · Lair` : BIOMES[biomeIdx],
    enemies,
    gold: Math.round(55 * Math.pow(1.17, n - 1) * (boss ? 2.6 : 1)),
    crystal: Math.round((14 + n * 2.5) * (boss ? 3 : 1)),
    exp: Math.round(22 + n * 5),
    boss,
  };
}

// ─── Items ─────────────────────────────────────────────────────────────────

const WEAPON_NAMES: Record<WeaponKind, string[]> = {
  sword: ["Iron Blade", "Knight Saber", "Runed Falchion"],
  bow: ["Yew Bow", "Windpiercer", "Elven Longbow"],
  staff: ["Oak Staff", "Crystal Rod", "Arcane Scepter"],
  spear: ["Ash Spear", "Boar Tusk Pike", "Sky Piercer"],
  dagger: ["Bronze Dirk", "Night Fang", "Whisper Edge"],
  axe: ["Woodcutter", "Bearded Axe", "Doom Cleaver"],
  book: ["Field Notes", "Grimoire", "Codex of Ages"],
  lance: ["War Lance", "Gilded Lance", "Dawn Piercer"],
};
const PREFIX: Record<Rarity, string> = { common: "", rare: "Fine ", epic: "Mythic ", legendary: "Eternal " };

export function rollItem(id: number, castleLv: number, bias = 0): Item {
  const r = Math.random() + bias;
  const rarity: Rarity = r > 0.97 ? "legendary" : r > 0.85 ? "epic" : r > 0.55 ? "rare" : "common";
  const mult = { common: 1, rare: 1.5, epic: 2.2, legendary: 3.2 }[rarity];
  const kinds = Object.keys(WEAPON_NAMES) as WeaponKind[];
  const k = kinds[Math.floor(Math.random() * kinds.length)];
  const names = WEAPON_NAMES[k];
  const name = PREFIX[rarity] + names[Math.min(names.length - 1, Math.floor(Math.random() * names.length))];
  return { id, name, rarity, atk: Math.round((3 + castleLv * 2.2) * mult * (0.85 + Math.random() * 0.3)) };
}

// ─── Gacha ─────────────────────────────────────────────────────────────────

export const SUMMON_COST = 100;

export function rollRarity(pity: number): Rarity {
  const r = Math.random();
  if (pity >= 9) return Math.random() < 0.25 ? "legendary" : "epic";
  if (r < 0.03) return "legendary";
  if (r < 0.15) return "epic";
  if (r < 0.45) return "rare";
  return "common";
}

export function heroDef(id: string): HeroDef {
  return HERO_DEFS.find((h) => h.id === id)!;
}
