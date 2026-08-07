"use client";
import { useState } from "react";
import { PanelShell } from "./Panels";
import {
  affinityBonus, doSummon, equipItem, expNeed, fmt, heroStats, levelUpHero, starUpHero, store, toggleDeploy, useGame,
} from "@/lib/state";
import { AFFINITIES, heroDef, questAt, RARITY_COLOR, RARITY_LABEL, SUMMON_COST } from "@/lib/types";
import type { HeroInst, Rarity } from "@/lib/types";
import { sfx } from "@/lib/audio";

function Stars({ n }: { n: number }) {
  return (
    <span className="tracking-tight text-[#f5b942]">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < n ? "" : "opacity-20"}>★</span>
      ))}
    </span>
  );
}

function Portrait({ h, size = 56 }: { h: HeroInst; size?: number }) {
  const d = heroDef(h.defId);
  return (
    <div
      className="relative flex items-center justify-center rounded-full border-[3px] font-display font-black"
      style={{
        width: size, height: size, borderColor: RARITY_COLOR[d.rarity],
        background: `radial-gradient(circle at 35% 30%, ${d.palette.accent}66, ${d.palette.outfit} 60%, #14100c)`,
        color: "#f5ecd8", fontSize: size * 0.42,
        boxShadow: `0 0 ${d.rarity === "legendary" ? 18 : 8}px ${RARITY_COLOR[d.rarity]}55`,
      }}
    >
      {d.name[0]}
    </div>
  );
}

// ─── Heroes panel ──────────────────────────────────────────────────────────

export function HeroesPanel({ onClose }: { onClose: () => void }) {
  useGame();
  const s = store.state;
  const ownedIds = new Set(s.heroes.map((h) => h.defId));
  const affin = AFFINITIES.filter((a) => ownedIds.has(a.a) && ownedIds.has(a.b));
  return (
    <PanelShell title="Heroes of the Realm" sub={`${s.heroes.length} sworn · squad ${s.heroes.filter((h) => h.deployed).length}/3`} onClose={onClose} wide>
      {affin.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {affin.map((a) => (
            <span key={a.name} className="rounded-md bg-[#2e6e6a33] px-2 py-1 text-[11px] font-black text-[#8adcd0]">
              {a.name}: {heroDef(a.a).name} & {heroDef(a.b).name} +{Math.round(a.bonus * 100)}% stats
            </span>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {s.heroes.map((h) => {
          const d = heroDef(h.defId);
          const st = heroStats(h, s);
          const lvCost = { gold: 40 + h.level * 22, food: 15 + h.level * 6 };
          const starCost = { crystal: 60 + h.stars * 60 };
          const aff = affinityBonus(h.defId, s.heroes);
          return (
            <div key={h.uid} className="rounded-xl border bg-black/25 p-3" style={{ borderColor: RARITY_COLOR[d.rarity] + "66" }}>
              <div className="flex gap-3">
                <Portrait h={h} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="truncate text-sm font-black" style={{ color: RARITY_COLOR[d.rarity] }}>
                      {d.name} <span className="text-[10px] font-bold uppercase tracking-wider">{RARITY_LABEL[d.rarity]}</span>
                    </div>
                    <Stars n={h.stars} />
                  </div>
                  <div className="truncate text-[11px] font-bold text-[#c8b890]">{d.title} · {d.skill.name}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-[#f0e2c4]">
                    <span>Lv {h.level}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/50">
                      <div className="h-full bg-[#8adceb]" style={{ width: `${Math.min(100, (h.exp / expNeed(h.level)) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] font-bold text-[#c8b890]">
                    ATK <span className="text-[#ff9a6a]">{st.atk}</span> · HP <span className="text-[#7ae08a]">{st.hp}</span>
                    {aff > 1 && <span className="text-[#8adcd0]"> · Bond +{Math.round((aff - 1) * 100)}%</span>}
                  </div>
                </div>
              </div>
              {/* equipment */}
              <div className="mt-2 flex items-center gap-2">
                <select
                  className="h-8 min-w-0 flex-1 rounded-lg border border-[#f5b94244] bg-[#1a120c] px-2 text-[11px] font-bold text-[#f0e2c4] outline-none"
                  value={h.equip?.id ?? ""}
                  onChange={(e) => equipItem(h.uid, e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— no weapon —</option>
                  {s.inventory.map((it) => (
                    <option key={it.id} value={it.id}>{it.name} (+{it.atk})</option>
                  ))}
                </select>
                <button className={`h-8 rounded-lg border px-2.5 text-[11px] font-black ${h.deployed ? "border-[#7ae08a88] bg-[#2a4a2a] text-[#b8e8a0]" : "border-[#f5b94244] text-[#c8b890] hover:bg-[#f5b94215]"}`} onClick={() => toggleDeploy(h.uid)}>
                  {h.deployed ? "Squad ✓" : "Deploy"}
                </button>
              </div>
              {h.expedition && <div className="mt-1.5 text-[11px] font-bold text-[#8adceb]">Away on expedition…</div>}
              <div className="mt-2 flex gap-2">
                <button className="btn-royal h-9 flex-1 text-[11px] font-black" onClick={() => levelUpHero(h.uid)}>
                  Level Up · {fmt(lvCost.gold)}g {fmt(lvCost.food)}f
                </button>
                <button className="btn-royal h-9 flex-1 text-[11px] font-black" disabled={h.stars >= 5} onClick={() => starUpHero(h.uid)}>
                  {h.stars >= 5 ? "Max ★" : `Awaken ★ · ${starCost.crystal}◆`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}

// ─── Summon ────────────────────────────────────────────────────────────────

interface Reveal { hero: HeroInst; isNew: boolean; rarity: Rarity }

export function SummonPanel({ onClose }: { onClose: () => void }) {
  useGame();
  const s = store.state;
  const [reveals, setReveals] = useState<Reveal[]>([]);
  const [idx, setIdx] = useState(0);

  const pull = (n: 1 | 3) => {
    const cost = SUMMON_COST * n;
    if (s.res.crystal < cost) { sfx.error(); store.toast("Not enough crystals", "bad"); return; }
    const out: Reveal[] = [];
    for (let i = 0; i < n; i++) {
      const r = doSummon();
      if (r) out.push(r);
    }
    if (out.length) {
      setReveals(out);
      setIdx(0);
      sfx.summon(out[0].rarity === "legendary" ? 3 : out[0].rarity === "epic" ? 2 : out[0].rarity === "rare" ? 1 : 0);
    }
  };

  // reveal overlay
  if (reveals.length > 0) {
    const r = reveals[idx];
    const d = heroDef(r.hero.defId);
    const col = RARITY_COLOR[r.rarity];
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-4" onClick={() => advance()}>
        <div className={`pointer-events-none absolute inset-y-0 w-40 -skew-x-12 opacity-40 animate-[beamSweep_1.1s_ease-in-out_infinite]`} style={{ background: `linear-gradient(90deg, transparent, ${col}, transparent)` }} />
        <div className="relative w-[min(92vw,400px)] text-center animate-[slamIn_.5s_cubic-bezier(.2,1.5,.4,1)]">
          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border-4"
            style={{ borderColor: col, background: `radial-gradient(circle at 38% 32%, ${d.palette.accent}88, ${d.palette.outfit} 62%, #0c0806)`, boxShadow: `0 0 60px ${col}88` }}>
            <span className="font-display text-7xl font-black text-[#f5ecd8]">{d.name[0]}</span>
          </div>
          <div className="mt-4 text-xs font-black uppercase tracking-[0.35em]" style={{ color: col }}>
            {RARITY_LABEL[r.rarity]} {r.isNew ? "· NEW HERO" : "· DUPLICATE ★"}
          </div>
          <div className="font-display mt-1 text-4xl font-black text-[#f5ecd8] drop-shadow-[0_3px_0_rgba(0,0,0,.7)]">{d.name}</div>
          <div className="text-sm font-bold text-[#c8b890]">{d.title}</div>
          <div className="mx-auto mt-3 max-w-xs rounded-xl border border-[#f5b94233] bg-black/40 px-4 py-2 text-sm font-bold italic text-[#e8dcc0]">
            “{d.quote}”
          </div>
          {!r.isNew && <div className="mt-2 text-sm font-black text-[#f5b942]">★ rises to {r.hero.stars}</div>}
          <div className="mt-5 flex justify-center gap-3">
            {reveals.length > 1 && idx < reveals.length - 1 && (
              <button className="btn-royal px-5 py-2 text-sm font-black" onClick={(e) => { e.stopPropagation(); advance(); }}>NEXT</button>
            )}
            <button className="btn-royal px-5 py-2 text-sm font-black" onClick={(e) => { e.stopPropagation(); setReveals([]); }}>
              {idx < reveals.length - 1 ? "SKIP" : "DONE"}
            </button>
          </div>
        </div>
      </div>
    );
    function advance() {
      if (idx < reveals.length - 1) {
        const ni = idx + 1;
        setIdx(ni);
        sfx.summon(reveals[ni].rarity === "legendary" ? 3 : reveals[ni].rarity === "epic" ? 2 : reveals[ni].rarity === "rare" ? 1 : 0);
      } else setReveals([]);
    }
  }

  return (
    <PanelShell title="Summoning Circle" sub="Call heroes across the veil" onClose={onClose}>
      <div className="rounded-xl border border-[#8adceb44] bg-gradient-to-b from-[#0e2a33] to-[#0a141a] p-5 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-[#8adceb]">Royal Crystals</div>
        <div className="font-display text-4xl font-black text-[#f5ecd8]">{fmt(s.res.crystal)} <span className="text-xl text-[#8adceb]">◆</span></div>
        <div className="mt-1 text-[11px] font-bold text-[#c8b890]">
          Blessing of the Circle: Epic-or-better guaranteed within {Math.max(0, 10 - s.pity)} summons
        </div>
        <div className="mt-4 flex justify-center gap-3">
          <button className="btn-royal px-6 py-3 text-sm font-black" disabled={s.res.crystal < SUMMON_COST} onClick={() => pull(1)}>
            Summon ×1 · {SUMMON_COST}◆
          </button>
          <button className="btn-royal px-6 py-3 text-sm font-black" disabled={s.res.crystal < SUMMON_COST * 3} onClick={() => pull(3)}>
            Summon ×3 · {SUMMON_COST * 3}◆
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] font-black">
        {(["common", "rare", "epic", "legendary"] as Rarity[]).map((rr2) => (
          <div key={rr2} className="rounded-lg bg-black/25 py-2" style={{ color: RARITY_COLOR[rr2] }}>
            {RARITY_LABEL[rr2]}
            <div className="text-[#c8b890]">{{ common: "55%", rare: "30%", epic: "12%", legendary: "3%" }[rr2]}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg bg-black/25 p-3 text-[11px] leading-snug text-[#c8b890]">
        Duplicates awaken the hero (+★, +9% stats each, max ★5). New heroes wander your Great Hall — watch for them by the hearth.
        Current decree: {questAt(s.questIdx).text}
      </div>
    </PanelShell>
  );
}
