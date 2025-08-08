import React, { useEffect, useMemo, useRef, useState } from "react";
import Activity from "@/components/Activity";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Instructions, LI, Paragraph, Title, UL } from "@/components/Text";

const CONFIG = {
  bombMinSec: 10,
  bombMaxSec: 50,
  tickMinMs: 2000,
  tickMaxMs: 5000,
  startCeiling: 30,
  maxCeiling: 100,
  currency: "AUD",
} as const;

type Status = "idle" | "running" | "won" | "lost";

type GameRecord = {
  id: number;
  outcome: "Win" | "Loss";
  winnings: number;
  stoppedAtSec?: number;
  bombAtSec: number;
};

const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const formatAUD = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: CONFIG.currency, maximumFractionDigits: 0 }).format(n);

const computeX = (elapsedMs: number, bombMs: number) => {
  const r = Math.min(1, Math.max(0, bombMs ? elapsedMs / bombMs : 0));
  const base = CONFIG.startCeiling;
  return Math.min(CONFIG.maxCeiling, Math.max(base, Math.floor(base + r * (CONFIG.maxCeiling - base))));
};

const ActivityA: React.FC = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [current, setCurrent] = useState<number | null>(null);
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [roundId, setRoundId] = useState(1);

  const runningRef = useRef(false);
  const startMsRef = useRef(0);
  const bombDelayMsRef = useRef(0);
  const bombTO = useRef<number | null>(null);
  const tickTO = useRef<number | null>(null);
  const currentRef = useRef<number | null>(null);
  const lastCurrRef = useRef<number | null>(null);
  const lastPrevRef = useRef<number | null>(null);
  const [showExplosion, setShowExplosion] = useState(false);
  const explosionTO = useRef<number | null>(null);

  useEffect(() => {
    if (current === null) return;
    lastPrevRef.current = lastCurrRef.current;
    lastCurrRef.current = current;
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const clearTimers = () => {
    if (bombTO.current !== null) window.clearTimeout(bombTO.current);
    if (tickTO.current !== null) window.clearTimeout(tickTO.current);
    if (explosionTO.current !== null) window.clearTimeout(explosionTO.current);
    bombTO.current = null;
    tickTO.current = null;
    explosionTO.current = null;
  };

  const begin = () => {
    if (runningRef.current) return;
    setStatus("running");
    runningRef.current = true;
    lastPrevRef.current = null;
    lastCurrRef.current = null;
    setShowExplosion(false);

    startMsRef.current = Date.now();
    bombDelayMsRef.current = randInt(CONFIG.bombMinSec * 1000, CONFIG.bombMaxSec * 1000);

    const initialX = computeX(0, bombDelayMsRef.current);
    const first = randInt(1, initialX);
    setCurrent(first);
    currentRef.current = first;
    lastPrevRef.current = null;
    lastCurrRef.current = first;

    bombTO.current = window.setTimeout(() => {
      if (!runningRef.current) return;
      endRound(false);
    }, bombDelayMsRef.current);

    scheduleNextTick();
  };

  const scheduleNextTick = () => {
    const delay = randInt(CONFIG.tickMinMs, CONFIG.tickMaxMs);
    tickTO.current = window.setTimeout(() => {
      if (!runningRef.current) return;
      const elapsed = Date.now() - startMsRef.current;
      const x = computeX(elapsed, bombDelayMsRef.current);
      const next = randInt(1, x);
      // previous tracking handled in effect
      setCurrent(next);
      scheduleNextTick();
    }, delay);
  };

  const stop = () => {
    if (!runningRef.current) return;
    const payout = (lastCurrRef.current ?? currentRef.current ?? current ?? 0);
    endRound(true, payout);
    // Direct import usage (no lazy import); guard for SSR
    if (typeof window !== "undefined") {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 } });
    }
  };

  const endRound = (won: boolean, payout: number = 0) => {
    runningRef.current = false;

    // Trigger and auto-clear explosion overlay on loss
    if (!won) {
      setShowExplosion(true);
      if (explosionTO.current !== null) window.clearTimeout(explosionTO.current);
      explosionTO.current = window.setTimeout(() => {
        setShowExplosion(false);
        explosionTO.current = null;
      }, 2000); // 2s to match glow fade
    }

    clearTimers();
    setStatus(won ? "won" : "lost");

    const elapsedSec = (Date.now() - startMsRef.current) / 1000;
    const rec: GameRecord = {
      id: roundId,
      outcome: won ? "Win" : "Loss",
      winnings: won ? payout : 0,
      stoppedAtSec: won ? elapsedSec : undefined,
      bombAtSec: bombDelayMsRef.current / 1000,
    };
    setRecords((r) => [rec, ...r]);
    setRoundId((n) => n + 1);
  };

  const resetSession = () => {
    clearTimers();
    runningRef.current = false;
    setStatus("idle");
    setCurrent(null);
    setRecords([]);
    setRoundId(1);
    setShowExplosion(false);
  };

  const { avg, successRate, maxWin } = useMemo(() => {
    const games = records.length;
    const total = records.reduce((s, r) => s + r.winnings, 0);
    const wins = records.filter((r) => r.outcome === "Win").length;
    const max = records.reduce((m, r) => Math.max(m, r.winnings), 0);
    return {
      avg: games ? Math.round(total / games) : 0,
      successRate: games ? Math.round((wins / games) * 100) : 0,
      maxWin: max,
    };
  }, [records]);

  const particles = useMemo(() => {
    if (!showExplosion) return [] as Array<{ id: number; angle: number; distance: number; size: number }>;
    const count = 28;
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      angle: (360 / count) * i + randInt(-12, 12),
      distance: randInt(90, 180),
      size: randInt(6, 14),
    }));
  }, [showExplosion, roundId]);

  const isRunning = status === "running";

  return (
    <Activity>
      <div className="mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <Title level={1}>
            Beat the Bomb
          </Title>
        </div>

        <Paragraph>
          This game was inspired by the old Australian radio game show "Beat the Bomb", which aired in the 1980s on stations like 2UW and 3UZ, this game
          challenges players to stop the clock before a hidden "bomb" sound effect goes off; banking the last safe amount they saw, or losing it all if they wait too long.
        </Paragraph>

        <Instructions>
          How to Play
          <UL>
            <LI>Press Begin to start the round.</LI>
            <LI>A random dollar value appears and updates every {CONFIG.tickMinMs / 1000} to {CONFIG.tickMaxMs / 1000} seconds.</LI>
            <LI>The maximum possible value increases over time, up to {formatAUD(CONFIG.maxCeiling)}.</LI>
            <LI>A hidden bomb will explode at a random moment between {CONFIG.bombMinSec} to {CONFIG.bombMaxSec} seconds.</LI>
            <LI>Press STOP before the bomb to bank the current value shown.</LI>
            <LI>If the bomb explodes first, you win nothing.</LI>
            <LI>Your session stats show average winnings, success rate, and top win.</LI>
          </UL>
        </Instructions>

        <Paragraph>
          Your scores will be recorded in the table below. You can press Reset session to clear all information. Feel free to play this multiple times
        </Paragraph>


        {/* Display */}
        <motion.div
          className="relative mt-6 rounded-2xl border bg-white p-10 text-center shadow-sm"
          animate={status === "lost" && showExplosion ? { x: [0, -14, 12, -10, 8, -6, 4, -2, 0] } : { x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-sm uppercase tracking-wide text-gray-500">Current</div>
          <div className={`mt-2 select-none tabular-nums text-6xl font-extrabold text-black ${isRunning ? "animate-pulse" : ""}`}>
            {current === null ? "—" : formatAUD(current)}
          </div>

          {/* Loss animation (simple boom) */}
          <AnimatePresence>
            {showExplosion && (
              <motion.div
                key="explosion"
                className="pointer-events-none absolute inset-0 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {/* flash */}
                <motion.div
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ duration: 2, times: [0, 0.06, 1], ease: "easeOut" }}
                  style={{
                    background:
                      "radial-gradient(circle at center, rgba(255,255,255,0.95), rgba(255,0,0,0.6) 40%, rgba(0,0,0,0.6) 70%)",
                    mixBlendMode: "screen",
                  }}
                />

                {/* particles */}
                {particles.map((p) => (
                  <motion.span
                    key={p.id}
                    className="absolute left-1/2 top-1/2 block rounded-full"
                    style={{ width: p.size, height: p.size, background: "linear-gradient(180deg, #ffffff, #ef4444)" }}
                    initial={{ x: -p.size / 2, y: -p.size / 2, scale: 0, opacity: 1 }}
                    animate={{
                      x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
                      y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
                      scale: 1,
                      opacity: 0,
                      rotate: 180,
                    }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  />
                ))}

                {/* shockwave ring */}
                <motion.div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/80"
                  initial={{ scale: 0.2, opacity: 1 }}
                  animate={{ scale: 6, opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  style={{ width: 48, height: 48 }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-center gap-3">
            {status !== "running" && (
              <button
                onClick={begin}
                className="rounded-2xl bg-emerald-600 px-6 py-3 text-white font-semibold shadow hover:bg-emerald-700 disabled:opacity-50"
                disabled={isRunning}
              >
                {(status === "won" || status === "lost") ? "Play Again" : "Begin"}
              </button>
            )}

            {status === "running" && (
              <button
                onClick={stop}
                className="rounded-2xl bg-amber-500 px-6 py-3 text-white font-semibold shadow hover:bg-amber-600 disabled:opacity-50"
                disabled={!isRunning || current === null}
              >
                STOP
              </button>
            )}

          </div>

          {/* Round status banner */}
          {status === "won" && (
            <div className="mt-4 text-emerald-700 font-semibold">Nice one! You banked {formatAUD(lastCurrRef.current ?? currentRef.current ?? current ?? 0)}.</div>
          )}
          {status === "lost" && (
            <div className="mt-4 text-red-700 font-semibold">Boom! Bomb went off; no winnings.</div>
          )}
        </motion.div>

        {/* Summary */}
        <div className="mt-4 flex flex-wrap items-center justify-between text-sm">
          <div className="flex flex-row gap-4">
            <div className="rounded-xl bg-gray-900 px-3 py-2">Average: <span className="font-semibold">{formatAUD(avg)}</span></div>
            <div className="rounded-xl bg-gray-900 px-3 py-2">Success rate: <span className="font-semibold">{successRate}%</span></div>
            <div className="rounded-xl bg-green-900 px-3 py-2">Max win: <span className="font-semibold">{formatAUD(maxWin)}</span></div>
          </div>
          <button
            onClick={resetSession}
            className="rounded-2xl bg-red-800 px-4 py-1 text-gray-100 font-medium hover:bg-gray-300"
          >
            Reset session
          </button>
        </div>

        {/* Session Table */}
        <div className="mt-8 overflow-x-auto rounded-xl overflow-hidden">
          <table className="min-w-full border-separate">
            <thead>
              <tr className="text-left text-sm text-gray-500 bg-white">
                <th className="px-3">#</th>
                <th className="px-3">Outcome</th>
                <th className="px-3">Winnings</th>
                <th className="px-3">Stopped @</th>
                <th className="px-3">Bomb @</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr className="bg-white">
                  <td className="px-3 py-2 text-gray-500 w-full text-center italic" colSpan={5}>No games yet. Hit Begin to play</td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="bg-white shadow-sm">
                    <td className="px-3 py-2 rounded-l-xl font-mono text-black">{r.id}</td>
                    <td className={`px-3 py-2 ${r.outcome === "Win" ? "text-emerald-700" : "text-red-700"}`}>{r.outcome}</td>
                    <td className="px-3 py-2 font-semibold text-black">{formatAUD(r.winnings)}</td>
                    <td className="px-3 py-2 text-black">{r.stoppedAtSec ? `${r.stoppedAtSec.toFixed(1)}s` : ""}</td>
                    <td className="px-3 py-2 rounded-r-xl text-black">{r.bombAtSec.toFixed(1)}s</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>


        {/* Dev helper: reveal internal ceiling X while running */}
        {/* <div className="mt-2 text-xs text-gray-400">Ceiling now: {isRunning ? computeX(Date.now() - startMsRef.current, bombDelayMsRef.current) : ""}</div> */}
      </div>
      <div>

      </div>
    </Activity>
  );
};

export default ActivityA;
