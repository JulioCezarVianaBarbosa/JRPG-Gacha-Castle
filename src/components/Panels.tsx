"use client";
import { useEffect, useState } from "react";
import {
  addRes, buyAtMarket, canAfford, cityLevel, claimMail, costOf, expSlots, fmt, goldMult, heroPower, kingdomScore,
  questProgressLabel, researchUp, spend, startExpedition, store, upgradeBuilding, useGame,
} from "@/lib/state";
import {
  BUILDING_DEFS, CASTLE_BASE, EXPEDITIONS, heroDef, questAt, RARITY_COLOR, RARITY_LABEL, rollItem,
} from "@/lib/types";
import type { PartialRes, ResKey } from "@/lib/types";
import { sfx } from "@/lib/audio";

const RES_COLOR: Record<ResKey, string> = {
  gold: "#f5b942", wood: "#c89058", stone: "#b8b8c0", food: "#e8c860", crystal: "#8adceb",
};

function Cost({ cost }: { cost: PartialRes }) {
  const s = store.state;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
      {(Object.keys(cost) as ResKey[]).map((k) => (
        <span key={k} className="font-bold" style={{ color: s.res[k] >= (cost[k] ?? 0) ? RES_COLOR[k] : "#d0483a" }}>
          {fmt(cost[k] ?? 0)} {k}
        </span>
      ))}
    </span>
  );
}

export function PanelShell({ title, sub, onClose, children, wide }: {
  title: string; sub?: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-2 sm:p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`panel-wood relative flex max-h-[92vh] w-full flex-col animate-[slamIn_.32s_cubic-bezier(.2,1.3,.4,1)] ${wide ? "max-w-3xl" : "max-w-xl"}`}>
        <div className="flex items-center justify-between border-b-2 border-[#f5b94233] px-5 py-3">
          <div>
            <div className="font-display text-xl font-black tracking-wide text-[#f5b942]">{title}</div>
            {sub && <div className="text-xs font-bold text-[#c8b890]">{sub}</div>}
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#f5b94255] text-[#f0e2c4] hover:bg-[#f5b94222]" onClick={onClose} aria-label="close">
            <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Throne ────────────────────────────────────────────────────────────────

export function ThronePanel({ onClose }: { onClose: () => void }) {
  useGame();
  const s = store.state;
  const q = questProgressLabel(s);
  const castleCost = costOf(CASTLE_BASE, s.castleLv);
  const stats: [string, string | number][] = [
    ["Prosperity", kingdomScore(s).toLocaleString()],
    ["City Level", cityLevel(s)],
    ["Battles Won", s.stats.battlesWon],
    ["Heroes", s.heroes.length],
    ["Summons", s.stats.summons],
    ["Monsters Slain", s.stats.slain],
    ["Resources Gathered", s.stats.collected],
    ["Items Forged", s.stats.forged],
  ];
  return (
    <PanelShell title="The Throne" sub={`House of the ${s.name} · Castle Lv ${s.castleLv}`} onClose={onClose} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[#f5b94233] bg-black/25 p-4">
          <div className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#f5b942]">Current Decree</div>
          <div className="mt-2 text-sm font-bold text-[#f0e2c4]">{q.text}</div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/50">
            <div className="h-full rounded-full bg-gradient-to-r from-[#a03040] to-[#f5b942]" style={{ width: `${Math.min(100, (q.prog / q.target) * 100)}%` }} />
          </div>
          <div className="mt-1 text-xs font-bold text-[#c8b890]">{Math.min(q.prog, q.target)}/{q.target} · reward {q.reward}</div>
          <button className="btn-royal mt-4 w-full py-2.5 text-sm font-black" disabled={!canAfford(s, castleCost)} onClick={() => upgradeBuilding("castle")}>
            Upgrade Castle to Lv {s.castleLv + 1} — <Cost cost={castleCost} />
          </button>
          <div className="mt-2 text-[11px] leading-snug text-[#c8b890]">
            Each castle level transforms the Great Hall — stone walls, chandeliers, stained glass, a grander throne — and the city seen from your windows.
          </div>
        </div>
        <div>
          <div className="grid grid-cols-2 gap-2">
            {stats.map(([k, v]) => (
              <div key={k} className="rounded-lg border border-[#f5b94222] bg-black/25 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#c8b890]">{k}</div>
                <div className="font-display text-lg font-black text-[#f0e2c4]">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-[#f5b94222] bg-black/25 p-3">
            <div className="font-display text-xs font-bold uppercase tracking-[0.15em] text-[#f5b942]">Chronicle</div>
            <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto pr-1">
              {s.log.map((l, i) => (
                <div key={i} className="text-[11px] leading-snug text-[#c8b890]">• {l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

// ─── Construction ──────────────────────────────────────────────────────────

export function BuildPanel({ onClose }: { onClose: () => void }) {
  useGame();
  const s = store.state;
  const castleCost = costOf(CASTLE_BASE, s.castleLv);
  return (
    <PanelShell title="Construction Board" sub="Raise the kingdom from ruin" onClose={onClose} wide>
      <div className="mb-3 flex items-center justify-between rounded-xl border border-[#f5b94244] bg-gradient-to-r from-[#3a2418] to-[#241810] p-4">
        <div>
          <div className="font-display text-lg font-black text-[#f5b942]">The Castle · Lv {s.castleLv}</div>
          <div className="text-xs font-bold text-[#c8b890]">Unlocks buildings, hall splendor and expedition might</div>
        </div>
        <button className="btn-royal px-4 py-2 text-sm font-black" disabled={!canAfford(s, castleCost)} onClick={() => upgradeBuilding("castle")}>
          Upgrade — <Cost cost={castleCost} />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {BUILDING_DEFS.map((b) => {
          const st = s.buildings[b.id];
          const cost = costOf(b.base, st.lv);
          const locked = s.castleLv < b.unlockCastle;
          return (
            <div key={b.id} className={`rounded-xl border p-3.5 ${locked ? "border-[#5a4a3855] bg-black/20 opacity-60" : "border-[#f5b94233] bg-black/25"}`}>
              <div className="flex items-center justify-between">
                <div className="font-display text-base font-black text-[#f0e2c4]">{b.name}</div>
                <div className="rounded-md bg-[#f5b94222] px-2 py-0.5 text-xs font-black text-[#f5b942]">Lv {st.lv}</div>
              </div>
              <div className="mt-1 text-xs leading-snug text-[#c8b890]">{b.desc}</div>
              {locked ? (
                <div className="mt-2 text-xs font-bold text-[#d0483a]">Requires Castle Lv {b.unlockCastle}</div>
              ) : (
                <button className="btn-royal mt-2.5 w-full py-2 text-xs font-black" disabled={!canAfford(s, cost)} onClick={() => upgradeBuilding(b.id)}>
                  {st.lv === 0 ? "Build" : `Upgrade to Lv ${st.lv + 1}`} — <Cost cost={cost} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}

// ─── Gate / campaign ───────────────────────────────────────────────────────

export function GatePanel({ onClose, onBattle }: { onClose: () => void; onBattle: (stage: number) => void }) {
  useGame();
  const s = store.state;
  const squad = s.heroes.filter((h) => h.deployed && !h.expedition).slice(0, 3);
  const stages = Array.from({ length: Math.min(s.campaignStage, 12) }, (_, i) => s.campaignStage - i).filter((n) => n >= 1);
  return (
    <PanelShell title="The Castle Gate" sub="March forth — expand the dominion" onClose={onClose} wide>
      {squad.length === 0 && (
        <div className="mb-3 rounded-lg border border-[#d0483a66] bg-[#3a1418] px-3 py-2 text-xs font-bold text-[#f0c0b0]">
          No squad deployed! Open Heroes and deploy up to 3 heroes first.
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[#c8b890]">Squad:</span>
        {squad.map((h) => (
          <span key={h.uid} className="rounded-md bg-[#f5b94222] px-2 py-0.5 text-xs font-black" style={{ color: RARITY_COLOR[heroDef(h.defId).rarity] }}>
            {heroDef(h.defId).name} Lv{h.level}
          </span>
        ))}
      </div>
      <div className="space-y-2">
        {stages.map((n) => {
          const st = makeStagePreview(n);
          const isNext = n === s.campaignStage;
          return (
            <div key={n} className={`flex items-center justify-between rounded-xl border p-3 ${isNext ? "border-[#f5b942] bg-[#f5b94214]" : "border-[#f5b94222] bg-black/25"}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg font-display text-lg font-black ${isNext ? "bg-[#7a2438] text-[#f5e8c8]" : "bg-black/40 text-[#c8b890]"}`}>{n}</div>
                <div>
                  <div className="text-sm font-black text-[#f0e2c4]">{st.biome} {st.boss && <span className="ml-1 rounded bg-[#7a2438] px-1.5 py-0.5 text-[10px] font-black text-[#f5e8c8]">BOSS</span>}</div>
                  <div className="text-[11px] font-bold text-[#c8b890]">{st.foes} · ~{fmt(st.gold)} gold · ~{st.crystal} crystals</div>
                </div>
              </div>
              <button className="btn-royal px-4 py-2 text-xs font-black" disabled={squad.length === 0} onClick={() => { sfx.whoosh(); onBattle(n); }}>
                {isNext ? "MARCH" : "Replay"}
              </button>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}

function makeStagePreview(n: number) {
  const boss = n % 5 === 0;
  const biomes = ["Emerald Forest", "Amber Plains", "Echo Caves", "Sunken Ruins", "Storm Peak"];
  const biome = biomes[Math.floor((n - 1) / 5) % 5] + (boss ? " · Lair" : "");
  return { biome, boss, foes: boss ? "1 mighty foe" : `${1 + ((n - 1) % 3)} foes`, gold: Math.round(55 * Math.pow(1.17, n - 1) * (boss ? 2.6 : 1)), crystal: Math.round((14 + n * 2.5) * (boss ? 3 : 1)) };
}

// ─── Market ────────────────────────────────────────────────────────────────

export function MarketPanel({ onClose }: { onClose: () => void }) {
  useGame();
  const s = store.state;
  const rows: { key: ResKey; amount: number; gold: number }[] = [
    { key: "wood", amount: 100, gold: 60 },
    { key: "stone", amount: 80, gold: 70 },
    { key: "food", amount: 100, gold: 40 },
    { key: "crystal", amount: 25, gold: 150 },
  ];
  const gm = goldMult(s);
  return (
    <PanelShell title="Trade Market" sub={`Merchants of the realm · Gold ${fmt(s.res.gold)}`} onClose={onClose}>
      <div className="space-y-2">
        {rows.map((r) => {
          const cost = Math.round(r.gold * gm);
          return (
            <div key={r.key} className="flex items-center justify-between rounded-xl border border-[#f5b94222] bg-black/25 p-3">
              <div className="text-sm font-black text-[#f0e2c4]">
                +{r.amount} <span style={{ color: RES_COLOR[r.key] }}>{r.key}</span>
              </div>
              <button className="btn-royal px-4 py-2 text-xs font-black" disabled={s.res.gold < cost} onClick={() => buyAtMarket(r.key, r.gold, r.amount)}>
                Buy — <span className="font-bold" style={{ color: s.res.gold >= cost ? "#f5b942" : "#d0483a" }}>{cost}g</span>
              </button>
            </div>
          );
        })}
        <div className="rounded-lg bg-black/25 p-3 text-[11px] leading-snug text-[#c8b890]">
          The Market building raises passive gold income — trades here are always available. Commerce research also improves prices realm-wide.
        </div>
      </div>
    </PanelShell>
  );
}

// ─── Mail ──────────────────────────────────────────────────────────────────

export function MailPanel({ onClose }: { onClose: () => void }) {
  useGame();
  const s = store.state;
  return (
    <PanelShell title="Mail Post" sub="Letters and tributes" onClose={onClose}>
      {s.mail.length === 0 && <div className="py-8 text-center text-sm font-bold text-[#c8b890]">The post is empty.</div>}
      <div className="space-y-2">
        {s.mail.map((m) => (
          <div key={m.id} className={`rounded-xl border p-3.5 ${m.claimed ? "border-[#5a4a3844] bg-black/15 opacity-55" : "border-[#f5b94255] bg-[#f5b9420d]"}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-black text-[#f0e2c4]">{m.title}</div>
                <div className="text-[11px] font-bold text-[#c8b890]">{m.from} · Day {m.day}</div>
              </div>
              {!m.claimed && Object.keys(m.gift).length > 0 && (
                <button className="btn-royal px-3 py-1.5 text-xs font-black" onClick={() => claimMail(m.id)}>
                  Claim {Object.entries(m.gift).map(([k, v]) => `+${v} ${k}`).join(" ")}
                </button>
              )}
            </div>
            <div className="mt-1.5 text-xs leading-snug text-[#c8b890]">{m.body}</div>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

// ─── Library / research ────────────────────────────────────────────────────

export function LibraryPanel({ onClose }: { onClose: () => void }) {
  useGame();
  const s = store.state;
  const tracks: { id: "agri" | "war" | "trade"; name: string; desc: string; color: string }[] = [
    { id: "agri", name: "Agriculture", desc: "+6% production per level", color: "#7ae08a" },
    { id: "war", name: "Warfare", desc: "+5% hero ATK per level", color: "#ff8a5a" },
    { id: "trade", name: "Commerce", desc: "+6% gold income per level", color: "#f5b942" },
  ];
  const built = s.buildings.library.lv > 0;
  return (
    <PanelShell title="Athenaeum" sub={built ? `Research halls · Lv ${s.buildings.library.lv}` : "The shelves stand empty"} onClose={onClose}>
      {!built ? (
        <div className="py-8 text-center text-sm font-bold text-[#c8b890]">Build the Athenaeum from the Construction Board to unlock research.</div>
      ) : (
        <div className="space-y-3">
          {tracks.map((t) => {
            const lv = s.research[t.id];
            const max = lv >= 5;
            const cost = { gold: 120 * Math.pow(2, lv), wood: 60 * Math.pow(2, lv) };
            return (
              <div key={t.id} className="rounded-xl border border-[#f5b94222] bg-black/25 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="font-display text-base font-black" style={{ color: t.color }}>{t.name}</div>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-2.5 w-6 rounded-full" style={{ background: i < lv ? t.color : "rgba(255,255,255,0.08)" }} />
                    ))}
                  </div>
                </div>
                <div className="mt-0.5 text-xs font-bold text-[#c8b890]">{t.desc}</div>
                <button className="btn-royal mt-2 w-full py-2 text-xs font-black" disabled={max || !canAfford(s, cost)} onClick={() => researchUp(t.id)}>
                  {max ? "Mastered" : <>Research — <Cost cost={cost} /></>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}

// ─── Smithy ────────────────────────────────────────────────────────────────

export function SmithyPanel({ onClose }: { onClose: () => void }) {
  useGame();
  const s = store.state;
  const st = s.buildings.smithy;
  const interval = 70 / (1 + 0.25 * Math.max(0, st.lv - 1));
  const prog = st.lv > 0 ? Math.max(0, Math.min(1, 1 - st.forgeT / interval)) : 0;
  return (
    <PanelShell title="Forge Works" sub={st.lv > 0 ? `The hammers never rest · Lv ${st.lv}` : "Cold and silent"} onClose={onClose} wide>
      {st.lv === 0 ? (
        <div className="py-8 text-center text-sm font-bold text-[#c8b890]">Build the Forge Works from the Construction Board. The smith will craft equipment over time.</div>
      ) : (
        <>
          <div className="mb-3 rounded-xl border border-[#f5b94233] bg-black/25 p-3.5">
            <div className="flex items-center justify-between text-sm font-black text-[#f0e2c4]">
              <span>{st.pendingForge ? "Masterwork ready at the anvil!" : "Forging…"}</span>
              <span className="text-xs text-[#c8b890]">{st.pendingForge ? "Collect near the anvil (E)" : `${Math.round(prog * 100)}%`}</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/50">
              <div className="h-full rounded-full bg-gradient-to-r from-[#a03040] via-[#f5b942] to-[#ffe08a] transition-all" style={{ width: `${st.pendingForge ? 100 : prog * 100}%` }} />
            </div>
          </div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#c8b890]">Armory ({s.inventory.length}/14) — equip from the Heroes panel</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {s.inventory.length === 0 && <div className="col-span-full py-6 text-center text-xs font-bold text-[#c8b890]">No equipment in storage.</div>}
            {s.inventory.map((it) => (
              <div key={it.id} className="rounded-lg border bg-black/25 p-2.5" style={{ borderColor: RARITY_COLOR[it.rarity] + "77" }}>
                <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: RARITY_COLOR[it.rarity] }}>{RARITY_LABEL[it.rarity]}</div>
                <div className="text-xs font-black text-[#f0e2c4]">{it.name}</div>
                <div className="text-[11px] font-bold text-[#7ae08a]">+{it.atk} ATK</div>
              </div>
            ))}
          </div>
        </>
      )}
    </PanelShell>
  );
}

// ─── War table / expeditions ───────────────────────────────────────────────

export function MapPanel({ onClose }: { onClose: () => void }) {
  useGame();
  const s = store.state;
  const slots = expSlots(s);
  const used = s.heroes.filter((h) => h.expedition).length;
  const free = s.heroes.filter((h) => !h.deployed && !h.expedition);
  const [sel, setSel] = useState<number | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick((t) => t + 1), 500); return () => clearInterval(iv); }, []);

  const claim = (uid: number) => {
    const h = s.heroes.find((x) => x.uid === uid);
    if (!h?.expedition || h.expedition.endsAt > Date.now()) return;
    const def = EXPEDITIONS.find((e) => e.id === h.expedition!.kind)!;
    store.mutate((st) => {
      const hero = st.heroes.find((x) => x.uid === uid)!;
      addRes(st, def.loot);
      if (def.id === "ruins" && Math.random() < 0.35 && st.inventory.length < 14) {
        st.inventory.push(rollItem(st.nextItemId++, st.castleLv, 0.3));
        store.toast("The ruins yielded equipment!", "good");
      }
      hero.expedition = null;
      st.stats.battlesWon += 0;
    });
    sfx.coin();
    store.toast(`${heroDef(h.defId).name} returned with spoils`, "good");
  };

  return (
    <PanelShell title="War Table" sub={slots === 0 ? "Expeditions require the Barracks" : `Expedition slots ${used}/${slots}`} onClose={onClose} wide>
      {slots === 0 ? (
        <div className="py-8 text-center text-sm font-bold text-[#c8b890]">Build the Barracks from the Construction Board to send heroes on expeditions.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#c8b890]">Available heroes</div>
            {free.length === 0 && <div className="rounded-lg bg-black/25 p-3 text-xs font-bold text-[#c8b890]">No idle heroes — un-deploy someone or wait for expeditions to return.</div>}
            <div className="space-y-1.5">
              {free.map((h) => {
                const d = heroDef(h.defId);
                return (
                  <button key={h.uid} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-all ${sel === h.uid ? "border-[#f5b942] bg-[#f5b94218]" : "border-[#f5b94222] bg-black/25 hover:bg-black/40"}`} onClick={() => { setSel(h.uid); sfx.click(); }}>
                    <span className="text-sm font-black" style={{ color: RARITY_COLOR[d.rarity] }}>{d.name}</span>
                    <span className="text-[11px] font-bold text-[#c8b890]">Lv{h.level} · PWR {heroPower(h, s)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#c8b890]">Orders</div>
            <div className="space-y-1.5">
              {EXPEDITIONS.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border border-[#f5b94222] bg-black/25 px-3 py-2">
                  <div>
                    <div className="text-sm font-black text-[#f0e2c4]">{e.name} <span className="text-[10px] text-[#c8b890]">({Math.round(e.dur / 60 * 10) / 10}m)</span></div>
                    <div className="text-[11px] font-bold text-[#c8b890]">
                      {Object.entries(e.loot).map(([k, v]) => `+${v} ${k}`).join(" ")}{e.bonus ? ` · ${e.bonus}` : ""}
                    </div>
                  </div>
                  <button className="btn-royal px-3 py-1.5 text-[11px] font-black" disabled={sel == null || used >= slots} onClick={() => {
                    const def = EXPEDITIONS.find((x) => x.id === e.id)!;
                    if (sel != null) { startExpedition(sel, def.id, def.dur); setSel(null); }
                  }}>Send</button>
                </div>
              ))}
            </div>
            {s.heroes.filter((h) => h.expedition).length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[#c8b890]">In the field</div>
                {s.heroes.filter((h) => h.expedition).map((h) => {
                  const left = Math.max(0, h.expedition!.endsAt - Date.now());
                  const ready = left <= 0;
                  const def = EXPEDITIONS.find((e) => e.id === h.expedition!.kind)!;
                  return (
                    <div key={h.uid} className="mb-1.5 flex items-center justify-between rounded-lg border border-[#f5b94222] bg-black/25 px-3 py-2">
                      <div>
                        <div className="text-sm font-black text-[#f0e2c4]">{heroDef(h.defId).name} — {def.name}</div>
                        <div className="text-[11px] font-bold" style={{ color: ready ? "#7ae08a" : "#c8b890" }}>
                          {ready ? "Returned!" : `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")} remaining`}
                        </div>
                      </div>
                      <button className="btn-royal px-3 py-1.5 text-[11px] font-black" disabled={!ready} onClick={() => claim(h.uid)}>Collect</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </PanelShell>
  );
}

// helper referenced by quest tracker text
export function currentQuestText() {
  return questAt(store.state.questIdx).text;
}
void spend; void fmt;
