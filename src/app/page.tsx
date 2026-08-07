"use client";
import { useEffect, useState } from "react";
import GameCanvas from "@/components/GameCanvas";
import HUD from "@/components/HUD";
import BattleScreen from "@/components/BattleScreen";
import { HeroesPanel, SummonPanel } from "@/components/HeroesGacha";
import {
  BuildPanel, GatePanel, LibraryPanel, MailPanel, MapPanel, MarketPanel, SmithyPanel, ThronePanel,
} from "@/components/Panels";
import { Banner, EventModal, GameOverScreen, PauseScreen, TitleScreen, Toasts } from "@/components/Screens";
import {
  clearSave, fetchScores, freshState, kingdomScore, loadSave, postScore, pushSave, scheduleSave, store,
} from "@/lib/state";
import type { ScoreRow } from "@/lib/state";
import { sfx } from "@/lib/audio";

type Mode = "boot" | "title" | "game" | "battle" | "gameover";

export default function Page() {
  const [mode, setMode] = useState<Mode>("boot");
  const [runId, setRunId] = useState(0);
  const [panel, setPanel] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [battleStage, setBattleStage] = useState(1);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [hasSave, setHasSave] = useState(false);
  const [goInfo, setGoInfo] = useState<{ score: number; day: number; stage: number; scores: ScoreRow[] } | null>(null);

  useEffect(() => {
    (async () => {
      const [save, sc] = await Promise.all([loadSave(), fetchScores()]);
      store.state = save ?? freshState("Governor");
      setHasSave(!!save);
      sfx.setMuted(store.state.muted);
      setScores(sc);
      setMode("title");
    })();
  }, []);

  const startNew = async (name: string) => {
    store.state = freshState(name);
    setRunId((r) => r + 1);
    setPanel(null);
    setPaused(false);
    setMode("game");
    store.toast(`Day 1 — Welcome, Governor ${name}. The hall is yours.`, "quest");
    void pushSave(store.state);
  };

  const continueGame = () => {
    setRunId((r) => r + 1);
    setPanel(null);
    setPaused(false);
    setMode("game");
    store.toast(`Day ${store.state.day} — Welcome back, Governor.`, "quest");
  };

  const onTogglePause = () => {
    if (panel) { setPanel(null); return; }
    setPaused((p) => !p);
    sfx.click();
  };

  const onBattle = (stage: number) => {
    setBattleStage(stage);
    setPanel(null);
    setPaused(false);
    setMode("battle");
  };

  const onBattleEnd = async (victory: boolean) => {
    if (victory) {
      setMode("game");
      scheduleSave();
      return;
    }
    const s = store.state;
    const score = kingdomScore(s);
    const rows = await postScore(s.name, score, s.day, s.campaignStage);
    setScores(rows);
    setGoInfo({ score, day: s.day, stage: s.campaignStage, scores: rows });
    setMode("gameover");
    // the run has ended — clear the persisted kingdom so the legend stands on its own
    await clearSave();
    setHasSave(false);
  };

  const restartRun = async () => {
    const name = store.state.name || "Governor";
    store.state = freshState(name);
    setRunId((r) => r + 1);
    setPanel(null);
    setPaused(false);
    setGoInfo(null);
    setMode("game");
    store.toast(`A new reign begins for ${name}.`, "quest");
    void pushSave(store.state);
  };

  const toTitle = async () => {
    if (mode === "game") await pushSave(store.state);
    const sc = await fetchScores();
    setScores(sc);
    setHasSave(true);
    setPanel(null);
    setPaused(false);
    setGoInfo(null);
    setMode("title");
  };

  const renderPanel = () => {
    const close = () => setPanel(null);
    switch (panel) {
      case "throne": return <ThronePanel onClose={close} />;
      case "build": return <BuildPanel onClose={close} />;
      case "gate": return <GatePanel onClose={close} onBattle={onBattle} />;
      case "market": return <MarketPanel onClose={close} />;
      case "mail": return <MailPanel onClose={close} />;
      case "library": return <LibraryPanel onClose={close} />;
      case "smithy": return <SmithyPanel onClose={close} />;
      case "map": return <MapPanel onClose={close} />;
      case "summon": return <SummonPanel onClose={close} />;
      case "heroes": return <HeroesPanel onClose={close} />;
      default: return null;
    }
  };

  if (mode === "boot") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e18]">
        <div className="text-center">
          <div className="font-display text-2xl font-black tracking-[0.3em] text-[#f5b942] animate-pulse">ETERNAL DOMINION</div>
          <div className="mt-2 text-xs font-bold text-[#c8b890]">Lighting the hearth…</div>
        </div>
      </div>
    );
  }

  if (mode === "title") {
    return <TitleScreen hasSave={hasSave} saveName={store.state.name} scores={scores} onNew={startNew} onContinue={continueGame} />;
  }

  if (mode === "gameover" && goInfo) {
    return (
      <GameOverScreen
        score={goInfo.score} day={goInfo.day} stage={goInfo.stage} scores={goInfo.scores}
        onRetry={() => void restartRun()} onTitle={() => void toTitle()}
      />
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0a0705]">
      <GameCanvas runId={runId} paused={paused || mode === "battle"} onOpenPanel={setPanel} onTogglePause={onTogglePause} />
      <HUD onPause={() => setPaused(true)} onOpenPanel={setPanel} />
      {mode === "battle" && <BattleScreen stageN={battleStage} onEnd={(v) => void onBattleEnd(v)} />}
      {renderPanel()}
      {mode === "game" && <EventModal />}
      {paused && mode === "game" && (
        <PauseScreen
          onResume={() => setPaused(false)}
          onRestart={() => void restartRun()}
          onTitle={() => void toTitle()}
        />
      )}
      <Banner />
      <Toasts />
    </div>
  );
}
