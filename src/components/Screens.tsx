"use client";
import { useEffect, useMemo, useState } from "react";
import { applyEventChoice, store, useGame } from "@/lib/state";
import type { ScoreRow } from "@/lib/state";
import { sfx } from "@/lib/audio";

// ─── shared bits ───────────────────────────────────────────────────────────

export function ScoreTable({ scores, highlight }: { scores: ScoreRow[]; highlight?: number }) {
  return (
    <div className="w-full">
      <div className="mb-2 font-display text-sm font-black uppercase tracking-[0.2em] text-[#f5b942]">Champions of the Realm</div>
      {scores.length === 0 ? (
        <div className="rounded-lg bg-black/30 px-3 py-4 text-center text-xs font-bold text-[#c8b890]">No legends yet — your name could be first.</div>
      ) : (
        <div className="space-y-1">
          {scores.map((r, i) => (
            <div key={r.id} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold ${r.score === highlight ? "bg-[#f5b94222] text-[#f5e8c8] ring-1 ring-[#f5b942]" : "bg-black/25 text-[#c8b890]"}`}>
              <span className={`w-6 font-display text-sm font-black ${i === 0 ? "text-[#f5b942]" : i === 1 ? "text-[#c8d2dc]" : i === 2 ? "text-[#c89058]" : "opacity-60"}`}>{i + 1}</span>
              <span className="flex-1 truncate text-[#f0e2c4]">{r.name}</span>
              <span className="text-[10px] opacity-70">D{r.day} · S{r.stage}</span>
              <span className="font-display text-sm font-black text-[#f5b942]">{r.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Embers({ n = 16 }: { n?: number }) {
  const embers = useMemo(() =>
    Array.from({ length: n }, (_, i) => ({
      left: `${(i * 61) % 100}%`,
      size: 2 + ((i * 7) % 4),
      dur: 6 + ((i * 13) % 9),
      delay: -((i * 17) % 12),
      o: 0.25 + ((i * 11) % 50) / 100,
    })), [n]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {embers.map((e, i) => (
        <span key={i} className="absolute bottom-[-10px] rounded-full bg-[#f5b942]"
          style={{ left: e.left, width: e.size, height: e.size, opacity: e.o, filter: "blur(0.5px)", animation: `emberRise ${e.dur}s linear ${e.delay}s infinite` }} />
      ))}
    </div>
  );
}

function CastleSilhouette() {
  return (
    <svg className="absolute bottom-0 left-0 w-full opacity-90" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice">
      <path d="M0 300 V210 h60 v-40 h24 v40 h50 V150 h18 l14-34 14 34 h18 v60 h70 v-90 h30 v-30 l20-40 20 40 v30 h30 v90 h90 v-50 h24 v-30 h16 v30 h24 v50 h80 V120 h26 v-36 l22-44 22 44 v36 h26 v180 h90 v-70 h20 v-24 h14 v24 h20 v70 h70 v-40 h24 v40 h60 v-60 h18 l12-28 12 28 h18 v60 h82 V300 Z" fill="#0b0f1a" />
      <g fill="#f5b942" opacity="0.85">
        <rect x="166" y="176" width="7" height="10" /><rect x="352" y="130" width="6" height="9" />
        <rect x="560" y="150" width="7" height="10" /><rect x="668" y="96" width="6" height="9" />
        <rect x="846" y="180" width="7" height="10" /><rect x="1002" y="210" width="6" height="9" />
      </g>
      <path d="M0 300 V250 q150-30 300-16 t300-10 t300-14 t300-8 V300 Z" fill="#060910" />
    </svg>
  );
}

// ─── Title ─────────────────────────────────────────────────────────────────

export function TitleScreen({ hasSave, saveName, scores, onNew, onContinue }: {
  hasSave: boolean; saveName: string; scores: ScoreRow[];
  onNew: (name: string) => void; onContinue: () => void;
}) {
  const [name, setName] = useState("Aeloria");
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0a0e18]">
      <div className="absolute inset-0" style={{ background: "radial-gradient(1100px 600px at 70% 18%, #1c2a44 0%, #10182a 45%, #0a0e18 100%)" }} />
      <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(700px 400px at 18% 82%, #3a1c22 0%, transparent 70%)" }} />
      <CastleSilhouette />
      <Embers />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-4 lg:flex-row lg:justify-center lg:gap-16">
        <div className="relative z-10 w-[min(94vw,560px)] text-center lg:text-left">
          <div className="font-display text-[11px] font-bold uppercase tracking-[0.5em] text-[#8adceb]">A Living Kingdom JRPG</div>
          <h1 className="font-display mt-2 text-5xl font-black leading-[0.95] tracking-wide text-[#f5ecd8] sm:text-7xl" style={{ textShadow: "0 4px 0 #3a1420, 0 10px 30px rgba(245,185,66,0.25)" }}>
            ETERNAL<br /><span className="text-[#f5b942]">DOMINION</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-relaxed text-[#c8b890] lg:mx-0">
            The war left the keep in ashes. Walk your Great Hall, raise the walls, summon the heroes of old —
            and watch a ruined village become a civilization, stone by living stone.
          </p>
          <div className="panel-wood mx-auto mt-5 w-full max-w-md p-4 lg:mx-0">
            <label className="text-[10px] font-black uppercase tracking-[0.25em] text-[#c8b890]">Governor's Name</label>
            <input
              value={name} maxLength={14}
              onChange={(e) => setName(e.target.value)}
              className="font-display mt-1 w-full rounded-lg border-2 border-[#f5b94244] bg-black/40 px-3 py-2 text-lg font-black text-[#f5ecd8] outline-none focus:border-[#f5b942]"
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button className="btn-royal flex-1 py-3 text-base font-black tracking-wider" onClick={() => { sfx.unlock(); sfx.quest(); onNew(name.trim() || "Governor"); }}>
                NEW REIGN
              </button>
              {hasSave && (
                <button className="flex-1 rounded-xl border-2 border-[#8adceb66] bg-[#0e2a33] py-3 font-display text-base font-black tracking-wider text-[#bfeaf5] hover:brightness-125" onClick={() => { sfx.unlock(); sfx.click(); onContinue(); }}>
                  CONTINUE · {saveName}
                </button>
              )}
            </div>
          </div>
          <div className="mx-auto mt-4 grid max-w-md grid-cols-1 gap-1.5 text-left text-[11px] font-bold text-[#c8b890] sm:grid-cols-2 lg:mx-0">
            <div className="rounded-lg bg-black/30 px-3 py-2"><b className="text-[#f5b942]">WASD / Arrows</b> or touch joystick — walk the hall</div>
            <div className="rounded-lg bg-black/30 px-3 py-2"><b className="text-[#f5b942]">E / Tap</b> — gather, talk, open stations</div>
            <div className="rounded-lg bg-black/30 px-3 py-2"><b className="text-[#f5b942]">Gate</b> — turn-based campaign battles</div>
            <div className="rounded-lg bg-black/30 px-3 py-2"><b className="text-[#f5b942]">Esc</b> — pause · progress auto-saves</div>
          </div>
        </div>
        <div className="panel-wood relative z-10 w-[min(94vw,360px)] p-4">
          <ScoreTable scores={scores} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-2 z-10 text-center text-[10px] font-bold tracking-wider text-[#5a5448]">
        The hall breathes while you play — day turns to night, rain drums the glass, heroes live their lives.
      </div>
    </div>
  );
}

// ─── Pause ─────────────────────────────────────────────────────────────────

export function PauseScreen({ onResume, onRestart, onTitle }: { onResume: () => void; onRestart: () => void; onTitle: () => void }) {
  const s = store.state;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="panel-wood w-[min(92vw,400px)] p-6 text-center animate-[slamIn_.3s_cubic-bezier(.2,1.3,.4,1)]">
        <div className="font-display text-3xl font-black tracking-wide text-[#f5b942]">PAUSED</div>
        <div className="mt-1 text-xs font-bold text-[#c8b890]">Day {s.day} · Castle Lv {s.castleLv} · The kingdom waits.</div>
        <div className="mt-5 flex flex-col gap-2">
          <button className="btn-royal py-3 font-display text-base font-black tracking-wider" onClick={onResume}>RESUME</button>
          <button className="rounded-xl border-2 border-[#f5b94244] py-2.5 font-display text-sm font-black tracking-wider text-[#f0e2c4] hover:bg-[#f5b94215]" onClick={onRestart}>
            ABDICATE & RESTART RUN
          </button>
          <button className="rounded-xl border-2 border-[#5a4a3866] py-2.5 font-display text-sm font-black tracking-wider text-[#c8b890] hover:bg-[#f5b94210]" onClick={onTitle}>
            RETURN TO TITLE
          </button>
        </div>
        <div className="mt-4 rounded-lg bg-black/30 p-3 text-left text-[11px] font-bold leading-relaxed text-[#c8b890]">
          <b className="text-[#f5b942]">WASD/Arrows</b> move · <b className="text-[#f5b942]">E</b> interact · <b className="text-[#f5b942]">Esc</b> pause<br />
          Touch: left joystick to walk, tap the hall or the E button.
        </div>
      </div>
    </div>
  );
}

// ─── Game over ─────────────────────────────────────────────────────────────

export function GameOverScreen({ score, day, stage, scores, onRetry, onTitle }: {
  score: number; day: number; stage: number; scores: ScoreRow[];
  onRetry: () => void; onTitle: () => void;
}) {
  const isBest = scores.length > 0 && scores[0].score === score;
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-[#0a0608]">
      <div className="absolute inset-0" style={{ background: "radial-gradient(900px 500px at 50% 20%, #2a0e14 0%, #12080c 55%, #0a0608 100%)" }} />
      <Embers n={10} />
      <div className="relative z-10 mx-auto flex min-h-full w-[min(94vw,760px)] flex-col items-center justify-center gap-5 py-8 lg:flex-row lg:items-center lg:gap-10">
        <div className="w-full max-w-sm text-center">
          <div className="font-display text-xs font-bold uppercase tracking-[0.4em] text-[#d0483a]">The banners fall</div>
          <div className="font-display mt-1 text-5xl font-black text-[#f5ecd8]" style={{ textShadow: "0 4px 0 #2a0a10" }}>DOMINION<br />LOST</div>
          {isBest && <div className="mt-2 inline-block rounded-lg bg-[#f5b94222] px-3 py-1 text-xs font-black text-[#f5b942] ring-1 ring-[#f5b942]">NEW HIGH SCORE</div>}
          <div className="panel-wood mt-4 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#c8b890]">Final Prosperity</div>
            <div className="font-display text-5xl font-black text-[#f5b942]">{score.toLocaleString()}</div>
            <div className="mt-1 text-xs font-bold text-[#c8b890]">Reached Day {day} · Campaign Stage {stage}</div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <button className="btn-royal py-3 font-display text-base font-black tracking-wider" onClick={onRetry}>RISE AGAIN — INSTANT RESTART</button>
            <button className="rounded-xl border-2 border-[#5a4a3866] py-2.5 font-display text-sm font-black tracking-wider text-[#c8b890] hover:bg-[#f5b94210]" onClick={onTitle}>TITLE SCREEN</button>
          </div>
        </div>
        <div className="panel-wood w-full max-w-sm p-4">
          <ScoreTable scores={scores} highlight={score} />
        </div>
      </div>
    </div>
  );
}

// ─── Event modal (council decrees) ─────────────────────────────────────────

export function EventModal() {
  useGame();
  const s = store.state;
  const ev = s.pendingEvent;
  if (!ev) return null;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="panel-wood w-[min(92vw,440px)] p-5 animate-[slamIn_.35s_cubic-bezier(.2,1.4,.4,1)]">
        <div className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-[#8adceb]">Council of the Realm · Day {s.day}</div>
        <div className="font-display mt-1 text-2xl font-black text-[#f5b942]">{ev.title}</div>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#e8dcc0]">{ev.text}</p>
        <div className="mt-4 flex flex-col gap-2">
          {ev.choices.map((c, i) => (
            <button key={i} className="group rounded-xl border-2 border-[#f5b94244] bg-black/30 px-4 py-3 text-left transition-all hover:border-[#f5b942] hover:bg-[#f5b94215]" onClick={() => applyEventChoice(i)}>
              <div className="text-sm font-black text-[#f0e2c4] group-hover:text-[#f5e8c8]">{c.label}</div>
              <div className="text-[11px] font-bold text-[#8adcd0]">{c.note}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Banner + toasts ───────────────────────────────────────────────────────

export function Banner() {
  useGame();
  const b = store.state.banner;
  const [visible, setVisible] = useState(false);
  const [cur, setCur] = useState(b);
  useEffect(() => {
    if (b) {
      setCur(b);
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 2400);
      return () => clearTimeout(t);
    }
  }, [b?.ts]);
  if (!cur || !visible) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[22%] z-40 flex justify-center">
      <div className="text-center animate-[bannerIn_2.4s_ease forwards]">
        <div className="font-display text-4xl font-black tracking-wide text-[#f5b942] sm:text-5xl" style={{ textShadow: "0 3px 0 #3a1420, 0 0 40px rgba(245,185,66,0.5)" }}>
          {cur.text}
        </div>
        <div className="mt-1 text-sm font-black tracking-wide text-[#f0e2c4]" style={{ textShadow: "0 2px 4px rgba(0,0,0,.8)" }}>{cur.sub}</div>
      </div>
    </div>
  );
}

export function Toasts() {
  useGame();
  const toasts = store.getToasts();
  return (
    <div className="pointer-events-none absolute bottom-16 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col items-center gap-1.5">
      {toasts.map((t) => (
        <div key={t.id} className={`rounded-lg border px-4 py-2 text-center text-xs font-black shadow-lg animate-[toastIn_.25s_cubic-bezier(.2,1.4,.4,1)] ${
          t.kind === "bad" ? "border-[#d0483a] bg-[#2a0e10ee] text-[#f0b0a0]"
          : t.kind === "good" ? "border-[#7ae08a88] bg-[#0e2a14ee] text-[#b8e8a0]"
          : t.kind === "quest" ? "border-[#f5b942] bg-[#2a1c08ee] text-[#f5e8c8]"
          : "border-[#f5b94255] bg-[#1a120cee] text-[#e8dcc0]"}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
