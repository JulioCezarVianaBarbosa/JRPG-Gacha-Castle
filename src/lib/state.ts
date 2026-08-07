import { useSyncExternalStore } from "react";
import {
  AFFINITIES, BUILDING_DEFS, CASTLE_BASE, EVENTS, HERO_DEFS,
  heroDef, questAt, rollItem, rollRarity, SUMMON_COST,
} from "./types";
import type {
  BuildingId, GameState, HeroInst, Item, MailMsg, PartialRes, Rarity, ResKey, Resources,
} from "./types";
import { sfx } from "./audio";

// ─── Store ─────────────────────────────────────────────────────────────────

type Listener = () => void;

class Store {
  state: GameState;
  version = 0;
  dirty = false;
  private listeners = new Set<Listener>();
  private toasts: { id: number; text: string; kind: string }[] = [];
  private toastId = 0;

  constructor() {
    this.state = freshState("Governor");
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  getVersion = () => this.version;

  mutate(fn: (s: GameState) => void) {
    fn(this.state);
    this.bump();
  }
  bump() {
    this.version++;
    this.dirty = true;
    this.listeners.forEach((l) => l());
  }

  toast(text: string, kind = "info") {
    this.toasts = [...this.toasts, { id: ++this.toastId, text, kind }];
    this.bump();
    const id = this.toastId;
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
      this.bump();
    }, 2600);
  }
  getToasts() { return this.toasts; }

  banner(text: string, sub: string) {
    this.state.banner = { text, sub, ts: Date.now() };
    this.bump();
  }
}

export const store = new Store();

export function useGame(): number {
  return useSyncExternalStore(store.subscribe, store.getVersion);
}

// ─── Fresh state ───────────────────────────────────────────────────────────

export function freshState(name: string): GameState {
  const buildings = {} as GameState["buildings"];
  for (const b of BUILDING_DEFS) buildings[b.id] = { lv: 0, acc: 0, forgeT: 0, pendingForge: null };
  const welcome: MailMsg = {
    id: 1, from: "The Old Steward", title: "Welcome back, Governor",
    body: "The war took much, but not everything. The people still look to the keep. Rebuild the hall, summon the heroes of old, and this realm will rise again. — Enclosed: the last of the royal crystal stock.",
    gift: { crystal: 300 }, claimed: false, day: 1,
  };
  return {
    v: 1, name, createdAt: Date.now(),
    res: { gold: 220, wood: 60, stone: 40, food: 80, crystal: 120 },
    castleLv: 1, buildings,
    research: { agri: 0, war: 0, trade: 0 },
    heroes: [
      { uid: 1, defId: "aldric", level: 1, stars: 0, exp: 0, deployed: true, equip: null, expedition: null },
      { uid: 2, defId: "wren", level: 2, stars: 0, exp: 0, deployed: true, equip: null, expedition: null },
    ],
    nextUid: 3, inventory: [], nextItemId: 1,
    campaignStage: 1, day: 1, weather: "clear",
    questIdx: 0, questProg: 0, pity: 0,
    buffs: { prod: 1, atk: 1, gold: 1, prodUntil: 0, atkUntil: 0, goldUntil: 0 },
    mail: [welcome], nextMailId: 2,
    stats: { battlesWon: 0, summons: 0, slain: 0, collected: 0, forged: 0 },
    muted: false, log: ["Day 1 — You return to the ruined keep."],
    pendingEvent: null, banner: null,
  };
}

// ─── Derived values ────────────────────────────────────────────────────────

export function affinityBonus(defId: string, heroes: HeroInst[]): number {
  let b = 0;
  const owned = new Set(heroes.map((h) => h.defId));
  for (const a of AFFINITIES) {
    if ((a.a === defId && owned.has(a.b)) || (a.b === defId && owned.has(a.a))) b += a.bonus;
  }
  return 1 + b;
}

export function heroStats(h: HeroInst, s: GameState) {
  const d = heroDef(h.defId);
  const rarMult = { common: 1, rare: 1.35, epic: 1.8, legendary: 2.4 }[d.rarity];
  const lvMult = 1 + 0.13 * (h.level - 1);
  const starMult = 1 + 0.09 * h.stars;
  const buffAtk = (s.day <= s.buffs.atkUntil ? s.buffs.atk : 1);
  const aff = affinityBonus(h.defId, s.heroes);
  const atk = Math.round(d.atk * rarMult * lvMult * starMult * (1 + s.research.war * 0.05) * buffAtk * aff) + (h.equip?.atk ?? 0);
  const hp = Math.round(d.hp * rarMult * lvMult * starMult * aff);
  return { atk, hp, spd: d.spd };
}

export function heroPower(h: HeroInst, s: GameState) {
  const st = heroStats(h, s);
  return Math.round(st.atk * 2 + st.hp / 2);
}

export function expNeed(lv: number) { return 40 + lv * 28; }

export function kingdomScore(s: GameState): number {
  const bLv = BUILDING_DEFS.reduce((a, b) => a + s.buildings[b.id].lv, 0);
  const hPow = s.heroes.reduce((a, h) => a + heroPower(h, s), 0);
  return Math.floor(
    s.res.gold / 40 + s.castleLv * 260 + bLv * 90 + hPow / 12 +
    (s.campaignStage - 1) * 130 + (s.day - 1) * 20 + s.stats.battlesWon * 35 + s.stats.slain * 6
  );
}

export function cityLevel(s: GameState): number {
  const bLv = BUILDING_DEFS.reduce((a, b) => a + s.buildings[b.id].lv, 0);
  return s.castleLv + Math.floor(bLv / 2);
}

export function productionMult(s: GameState) {
  return (1 + s.research.agri * 0.06) * (s.day <= s.buffs.prodUntil ? s.buffs.prod : 1);
}
export function goldMult(s: GameState) {
  return (1 + s.research.trade * 0.06) * (s.day <= s.buffs.goldUntil ? s.buffs.gold : 1);
}

export function expSlots(s: GameState) {
  return s.buildings.barracks.lv > 0 ? Math.min(3, 1 + Math.floor(s.buildings.barracks.lv / 2)) : 0;
}

export function questProgressLabel(s: GameState) {
  const q = questAt(s.questIdx);
  const reward = Object.entries(q.reward).map(([k, v]) => `+${v} ${k}`).join(", ");
  return { idx: s.questIdx, text: q.text, prog: s.questProg, target: q.target, reward };
}

// ─── Economy helpers ───────────────────────────────────────────────────────

export function costOf(base: PartialRes, lv: number): PartialRes {
  const out: PartialRes = {};
  for (const k of Object.keys(base) as ResKey[]) out[k] = Math.round((base[k] ?? 0) * Math.pow(1.65, lv));
  return out;
}

export function canAfford(s: GameState, cost: PartialRes) {
  return (Object.keys(cost) as ResKey[]).every((k) => s.res[k] >= (cost[k] ?? 0));
}

export function spend(s: GameState, cost: PartialRes) {
  for (const k of Object.keys(cost) as ResKey[]) s.res[k] -= cost[k] ?? 0;
}

export function addRes(s: GameState, gain: PartialRes) {
  for (const k of Object.keys(gain) as ResKey[]) {
    s.res[k] = Math.max(0, s.res[k] + Math.round(gain[k] ?? 0));
  }
}

export function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return (n / 1000).toFixed(1) + "k";
  return Math.floor(n).toString();
}

// ─── Quest hooks ───────────────────────────────────────────────────────────

export function questProgress(s: GameState, type: string, amount: number, kind?: ResKey) {
  const q = questAt(s.questIdx);
  if (q.type !== type) return;
  if (q.type === "collect" && q.kind && kind && q.kind !== kind) return;
  if (q.type === "build" && amount < q.target) return; // build passes castle lv
  if (q.type === "stage" && amount < q.target) return; // stage passes cleared stage n
  s.questProg = Math.min(q.target, type === "build" || type === "stage" ? amount : s.questProg + amount);
  if (s.questProg >= q.target) {
    addRes(s, q.reward);
    s.questIdx++;
    s.questProg = 0;
    const nq = questAt(s.questIdx);
    store.banner("Quest Complete", Object.entries(q.reward).map(([k, v]) => `+${v} ${k}`).join("  •  "));
    s.log = [`Day ${s.day} — Quest complete: ${q.text}`, ...s.log].slice(0, 30);
    sfx.quest();
    setTimeout(() => store.toast(`New quest: ${nq.text}`, "quest"), 1400);
  }
}

// ─── Actions ───────────────────────────────────────────────────────────────

export function upgradeBuilding(id: BuildingId | "castle") {
  const s = store.state;
  if (id === "castle") {
    const cost = costOf(CASTLE_BASE, s.castleLv);
    if (!canAfford(s, cost)) { sfx.error(); store.toast("Not enough resources", "bad"); return; }
    spend(s, cost);
    s.castleLv++;
    sfx.levelup();
    store.banner(`Castle Level ${s.castleLv}`, "The Great Hall grows more splendid");
    questProgress(s, "build", s.castleLv);
  } else {
    const def = BUILDING_DEFS.find((b) => b.id === id)!;
    const st = s.buildings[id];
    if (s.castleLv < def.unlockCastle) { sfx.error(); store.toast(`Requires Castle Lv ${def.unlockCastle}`, "bad"); return; }
    const cost = costOf(def.base, st.lv);
    if (!canAfford(s, cost)) { sfx.error(); store.toast("Not enough resources", "bad"); return; }
    spend(s, cost);
    st.lv++;
    if (id === "smithy" && st.lv === 1) st.forgeT = 20;
    sfx.build();
    store.toast(`${def.name} → Lv ${st.lv}`, "good");
    if (st.lv === 1) questProgress(s, "construct", 1);
  }
  store.bump();
}

export function doSummon(): { hero: HeroInst; isNew: boolean; rarity: Rarity } | null {
  const s = store.state;
  if (s.res.crystal < SUMMON_COST) { sfx.error(); store.toast("Not enough crystals", "bad"); return null; }
  s.res.crystal -= SUMMON_COST;
  const rarity = rollRarity(s.pity);
  s.pity = rarity === "epic" || rarity === "legendary" ? 0 : s.pity + 1;
  const pool = HERO_DEFS.filter((h) => h.rarity === rarity);
  const def = pool[Math.floor(Math.random() * pool.length)];
  const existing = s.heroes.find((h) => h.defId === def.id);
  s.stats.summons++;
  questProgress(s, "summon", 1);
  if (existing) {
    existing.stars = Math.min(5, existing.stars + 1);
    store.bump();
    return { hero: existing, isNew: false, rarity };
  }
  const inst: HeroInst = { uid: s.nextUid++, defId: def.id, level: 1, stars: 0, exp: 0, deployed: s.heroes.filter((h) => h.deployed).length < 3, equip: null, expedition: null };
  s.heroes.push(inst);
  store.bump();
  return { hero: inst, isNew: true, rarity };
}

export function levelUpHero(uid: number) {
  const s = store.state;
  const h = s.heroes.find((x) => x.uid === uid)!;
  const cost = { gold: 40 + h.level * 22, food: 15 + h.level * 6 };
  if (!canAfford(s, cost)) { sfx.error(); store.toast("Not enough gold & food", "bad"); return; }
  spend(s, cost);
  h.level = Math.min(60, h.level + 1);
  sfx.levelup();
  store.toast(`${heroDef(h.defId).name} reached Lv ${h.level}`, "good");
  store.bump();
}

export function starUpHero(uid: number) {
  const s = store.state;
  const h = s.heroes.find((x) => x.uid === uid)!;
  if (h.stars >= 5) { sfx.error(); return; }
  const cost = { crystal: 60 + h.stars * 60 };
  if (!canAfford(s, cost)) { sfx.error(); store.toast("Not enough crystals", "bad"); return; }
  spend(s, cost);
  h.stars++;
  sfx.levelup();
  store.toast(`${heroDef(h.defId).name} ★${h.stars} — awakened!`, "good");
  store.bump();
}

export function toggleDeploy(uid: number) {
  const s = store.state;
  const h = s.heroes.find((x) => x.uid === uid)!;
  if (h.expedition) { sfx.error(); store.toast("On expedition", "bad"); return; }
  if (!h.deployed && s.heroes.filter((x) => x.deployed).length >= 3) { sfx.error(); store.toast("Squad is full (3)", "bad"); return; }
  h.deployed = !h.deployed;
  sfx.click();
  store.bump();
}

export function equipItem(uid: number, itemId: number | null) {
  const s = store.state;
  const h = s.heroes.find((x) => x.uid === uid)!;
  if (h.equip) s.inventory.push(h.equip);
  h.equip = null;
  if (itemId != null) {
    const idx = s.inventory.findIndex((i) => i.id === itemId);
    if (idx >= 0) { h.equip = s.inventory[idx]; s.inventory.splice(idx, 1); }
  }
  sfx.coin();
  store.bump();
}

export function startExpedition(uid: number, kind: string, dur: number) {
  const s = store.state;
  const h = s.heroes.find((x) => x.uid === uid);
  if (!h || h.expedition || h.deployed) { sfx.error(); return; }
  h.expedition = { kind, endsAt: Date.now() + dur * 1000 };
  sfx.whoosh();
  store.toast(`${heroDef(h.defId).name} departed`, "info");
  questProgress(s, "expedition", 1);
  store.bump();
}

export function researchUp(track: "agri" | "war" | "trade") {
  const s = store.state;
  const lv = s.research[track];
  if (lv >= 5) { sfx.error(); return; }
  const cost = { gold: 120 * Math.pow(2, lv), wood: 60 * Math.pow(2, lv) };
  if (!canAfford(s, cost)) { sfx.error(); store.toast("Not enough resources", "bad"); return; }
  spend(s, cost);
  s.research[track]++;
  sfx.levelup();
  store.toast(`Research complete: ${track === "agri" ? "Agriculture" : track === "war" ? "Warfare" : "Commerce"} Lv ${s.research[track]}`, "good");
  store.bump();
}

export function claimMail(id: number) {
  const s = store.state;
  const m = s.mail.find((x) => x.id === id);
  if (!m || m.claimed) return;
  m.claimed = true;
  addRes(s, m.gift);
  sfx.mail();
  questProgress(s, "mail", 1);
  store.bump();
}

export function buyAtMarket(key: ResKey, goldCost: number, amount: number) {
  const s = store.state;
  const cost = Math.round(goldCost * goldMult(s));
  if (s.res.gold < cost) { sfx.error(); store.toast("Not enough gold", "bad"); return; }
  s.res.gold -= cost;
  s.res[key] += amount;
  sfx.coin();
  store.bump();
}

export function applyEventChoice(idx: number) {
  const s = store.state;
  const ev = s.pendingEvent;
  if (!ev) return;
  const c = ev.choices[idx];
  if (c.res) {
    // block unaffordable
    for (const k of Object.keys(c.res) as ResKey[]) {
      if ((c.res[k] ?? 0) < 0 && s.res[k] < -(c.res[k] ?? 0)) { sfx.error(); store.toast("Not enough resources", "bad"); return; }
    }
    addRes(s, c.res);
  }
  if (c.buff) {
    const until = s.day + c.buff.days;
    if (c.buff.stat === "prod") { s.buffs.prod = c.buff.mult; s.buffs.prodUntil = until; }
    if (c.buff.stat === "atk") { s.buffs.atk = c.buff.mult; s.buffs.atkUntil = until; }
    if (c.buff.stat === "gold") { s.buffs.gold = c.buff.mult; s.buffs.goldUntil = until; }
  }
  if (ev.id === "merchant" && idx === 0) {
    s.inventory.push(rollItem(s.nextItemId++, s.castleLv, 0.5));
    store.toast("A fine weapon added to your stores", "good");
  }
  s.log = [`Day ${s.day} — ${ev.title}: ${c.label}`, ...s.log].slice(0, 30);
  s.pendingEvent = null;
  sfx.quest();
  store.toast(c.note, "good");
  store.bump();
}

export function newDay(s: GameState) {
  s.day++;
  const r = Math.random();
  s.weather = r < 0.18 ? "rain" : r < 0.24 ? "snow" : "clear";
  // daily gift mail
  s.mail = [{
    id: s.nextMailId++, from: "The Steward", title: `Daily tribute — Day ${s.day}`,
    body: "The realm's daily tribute, as ordered.", gift: { crystal: 30, gold: 40 + s.castleLv * 15 }, claimed: false, day: s.day,
  }, ...s.mail].slice(0, 12);
  // random event
  if (s.day % 2 === 0 || Math.random() < 0.35) {
    s.pendingEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  }
  s.log = [`Day ${s.day} dawns over the kingdom (${s.weather}).`, ...s.log].slice(0, 30);
}

// ─── Persistence ───────────────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (!store.dirty) return;
    store.dirty = false;
    try {
      await fetch("/api/save", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: store.state }),
      });
    } catch { /* offline — keep playing */ }
  }, 1200);
}

export async function loadSave(): Promise<GameState | null> {
  try {
    const r = await fetch("/api/save");
    if (!r.ok) return null;
    const j = (await r.json()) as { data: GameState | null };
    if (!j.data) return null;
    return j.data;
  } catch {
    return null;
  }
}

export async function pushSave(data: GameState) {
  try {
    await fetch("/api/save", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
  } catch { /* ignore */ }
}

export async function clearSave() {
  try {
    await fetch("/api/save", { method: "DELETE" });
  } catch { /* ignore */ }
}

export interface ScoreRow { id: number; name: string; score: number; day: number; stage: number }

export async function fetchScores(): Promise<ScoreRow[]> {
  try {
    const r = await fetch("/api/highscores");
    if (!r.ok) return [];
    const j = (await r.json()) as { rows: ScoreRow[] };
    return j.rows;
  } catch { return []; }
}

export async function postScore(name: string, score: number, day: number, stage: number): Promise<ScoreRow[]> {
  try {
    const r = await fetch("/api/highscores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score, day, stage }),
    });
    const j = (await r.json()) as { rows: ScoreRow[] };
    return j.rows;
  } catch { return []; }
}
