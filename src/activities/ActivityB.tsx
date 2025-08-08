import React, { useEffect, useMemo, useRef, useState } from "react";
import Activity from "@/components/Activity";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Instructions, LI, Paragraph, Title, UL } from "@/components/Text";

// --- Types ---
type Status = "idle" | "running" | "won" | "lost";
type Difficulty = "easy" | "medium" | "hard";

type GameRecord = {
  id: number;
  outcome: "Win" | "Loss";
  points: number;
  difficulty: Difficulty;
  word: string;
  guess?: string;
  hintsUsed: number;
};

// --- Word banks ---
const WORD_BANK: Record<Difficulty, string[]> = {
  easy: [
    "APPLE",
    "HOUSE",
    "KOALA",
    "TRAIN",
    "GUITAR",
    "RIVER",
    "BRIDGE",
    "KANGAROO",
    "PLANET",
    "GARDEN",
    "SCHOOL",
    "BEACH",
    "MOUNTAIN",
    "FOREST",
    "FLOWER",
    "BUTTERFLY",
    "BICYCLE",
    "SCOOTER",
    "AEROPLANE",
    "ROCKET",
    "CLOUD",
    "RAINBOW",
    "SUNSHINE",
    "SUNFLOWER",
    "STARFISH",
    "UMBRELLA",
    "RAINCOAT",
    "ISLAND",
    "DESERT",
    "VALLEY",
    "OCEAN",
    "ELEPHANT",
    "TIGER",
    "LION",
    "MONKEY",
    "ZEBRA",
    "GIRAFFE",
    "PENGUIN",
    "CAMEL",
    "WHALE",
    "DOLPHIN",
    "SHARK",
    "SPIDER",
    "OCTOPUS",
    "TURTLE",
    "PARROT",
    "EMU",
    "WOMBAT",
    "PLATYPUS",
    "DINGO",
    "WALLABY",
    "ECHIDNA",
    "POSSUM",
    "SWAN",
    "KOOKABURRA",
    "COCKATOO",
    "CASSOWARY",
    "BANANA",
    "ORANGE",
    "CARROT",
    "CUCUMBER",
    "SANDWICH",
    "BISCUIT",
    "PANCAKE",
    "PENCIL",
    "CRAYON",
    "MARKER",
    "NOTEBOOK",
    "BACKPACK",
    "SCHOOLBAG",
    "SCISSORS",
    "TABLE",
    "CHAIR",
    "WINDOW",
    "DOOR",
    "KITCHEN",
    "BEDROOM",
    "SOCCER",
    "CRICKET",
    "RUGBY",
    "TENNIS",
    "BASKETBALL",
    "SKATEBOARD",
    "TORCH",
    "LAMP",
    "CASTLE",
    "PIRATE",
    "ROBOT",
    "ALIEN",
    "MAGNET",
    "VOLCANO",
    "CANYON",
    "METEOR",
    "SEASHELL",
    "SEAHORSE",
    "SANDCASTLE",
    "WATERFALL",
    "RAINDROP",
    "SNOWFLAKE",
    "HONEYBEE",
    "FLOWERPOT",
    "NECKLACE",
    "BOOMERANG",
    "OUTBACK",
    "SUNSET",
    "SUNRISE",
    "FERRY",
    "TRUCK",
    "CARAVAN",
    "BUS",
    "COLOUR",
  ],
  medium: [
    "PYTHON",
    "ORIGAMI",
    "MATRIX",
    "ALGORITHM",
    "GALAXY",
    "SYMMETRY",
    "COMPOSER",
    "TEMPLATE",
    "TRIANGLE",
    "DYNAMICS",
    "FRACTION",
    "INFINITY",
    "ALGEBRA",
    "GEOMETRY",
    "VECTOR",
    "PATTERN",
    "SEQUENCE",
    "RHYTHM",
    "MELODY",
    "HARMONY",
    "CHORD",
    "SONATA",
    "ORCHESTRA",
    "PYRAMID",
    "SPHERE",
    "CYLINDER",
    "CONE",
    "PRISM",
    "HEXAGON",
    "OCTAGON",
    "PENTAGON",
    "TELESCOPE",
    "MICROSCOPE",
    "SATELLITE",
    "ASTEROID",
    "COMET",
    "NEBULA",
    "GRAVITY",
    "ORBIT",
    "ECOSYSTEM",
    "HABITAT",
    "GEOLOGY",
    "BIOLOGY",
    "PHYSICS",
    "CHEMISTRY",
    "MOLECULE",
    "ELECTRON",
    "PROTON",
    "NEUTRON",
    "CIRCUIT",
    "BATTERY",
    "RESISTOR",
    "CAPACITOR",
    "MAGNETISM",
    "VARIABLE",
    "FUNCTION",
    "SYNTAX",
    "COMPILER",
    "DEBUGGER",
    "PROGRAM",
  ],
  hard: [
    "EQUIVOCAL",
    "SYNTHESIS",
    "PARADOXICAL",
    "PSYCHOMETRIC",
    "RHAPSODY",
    "CRYPTIC",
    "LABYRINTH",
    "ZEALOUSNESS",
    "CATALYST",
    "HYPERBOLIC",
    "PHOTOSYNTHESIS",
    "METAMORPHOSIS",
    "ONOMATOPOEIA",
    "IDIOSYNCRASY",
    "OBFUSCATION",
    "SERENDIPITY",
    "QUINTESSENTIAL",
    "INEFFABLE",
    "ANACHRONISTIC",
    "MAGNANIMOUS",
    "PERNICIOUS",
    "LOQUACIOUS",
    "CACOPHONY",
    "EUPHEMISM",
    "DICHOTOMY",
    "AMBIVALENCE",
    "AMBIGUITY",
    "CONUNDRUM",
    "ENIGMATIC",
    "IMPERCEPTIBLE",
    "PARALLELOGRAM",
    "ORTHOGONAL",
    "ISOMORPHISM",
    "THERMODYNAMICS",
    "ELECTROMAGNETISM",
    "SUPERPOSITION",
    "INTERFERENCE",
    "DIFFERENTIABLE",
    "PALAEONTOLOGY",
    "ARCHAEOLOGY",
    "ETYMOLOGY",
    "PALINDROMIC",
    "TRANSCENDENTAL",
    "IRRATIONALITY",
    "COMMUTATIVE",
    "ASSOCIATIVE",
    "DISTRIBUTIVE",
    "HYPOTENUSE",
    "HOMEOMORPHISM",
    "ANTHROPOLOGY",
    "PHILOSOPHY",
    "CONSERVATION",
    "EQUIVALENCE",
    "SUFFICIENCY",
    "RECURRENCE",
    "ISOPERIMETRIC",
    "NONLINEARITY",
    "AMELIORATION",
    "VICISSITUDE",
    "SYZYGY",
  ],
};


const BASE_POINTS: Record<Difficulty, number> = {
  easy: 100,
  medium: 200,
  hard: 400,
};

// Helpers
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const sample = <T,>(arr: T[]) => arr[randInt(0, arr.length - 1)];

const normalise = (s: string) => s.replace(/[^A-Z]/gi, "").toUpperCase();

const countLetters = (s: string) => (s.match(/[A-Z]/gi) || []).length;

const ActivityB: React.FC = () => {
  // --- State ---
  const [status, setStatus] = useState<Status>("idle");
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("medium");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const [target, setTarget] = useState<string>(""); // UPPERCASE
  const [revealed, setRevealed] = useState<boolean[]>([]); // per-char reveal flags
  const [hintsUsed, setHintsUsed] = useState(0);
  const [guess, setGuess] = useState("");

  const [records, setRecords] = useState<GameRecord[]>([]);
  const [roundId, setRoundId] = useState(1);

  const [showExplosion, setShowExplosion] = useState(false);
  const explosionTO = useRef<number | null>(null);

  // Derived
  const charArray = useMemo(() => target.split(""), [target]);
  const letterCount = useMemo(() => countLetters(target), [target]);

  const hasUnrevealedLetters = useMemo(
    () => charArray.some((ch, i) => /[A-Z]/.test(ch) && !revealed[i]),
    [charArray, revealed]
  );

  useEffect(() => {
    if (status === "running" && !hasUnrevealedLetters) {
      loseRound();
    }
  }, [status, hasUnrevealedLetters]);

  const masked = useMemo(() => {
    if (!target) return "";
    return charArray
      .map((ch, i) => {
        if (!/[A-Z]/.test(ch)) return ch; // preserve spaces/hyphens if you add them later
        return revealed[i] ? ch : "_";
      })
      .join(" ");
  }, [charArray, revealed, target]);

  const pointsIfWin = useMemo(() => {
    const base = BASE_POINTS[difficulty];
    if (letterCount === 0) return base;
    const ratio = Math.max(0, 1 - hintsUsed / letterCount);
    return Math.max(10, Math.round(base * ratio));
  }, [difficulty, hintsUsed, letterCount]);

  // Cleanup
  useEffect(() => () => {
    if (explosionTO.current !== null) window.clearTimeout(explosionTO.current);
  }, []);

  // --- Actions ---
  const begin = (d?: Difficulty) => {
    const diff = d ?? selectedDifficulty;
    setDifficulty(diff);
    setSelectedDifficulty(diff);

    const w = sample(WORD_BANK[diff]);
    setTarget(w);
    setRevealed(Array(w.length).fill(false));
    setHintsUsed(0);
    setGuess("");

    setStatus("running");
    setShowExplosion(false);
  };

  const revealOne = () => {
    if (status !== "running") return;
    // collect unrevealed letter indices
    const indices: number[] = [];
    for (let i = 0; i < charArray.length; i++) {
      if (!/[A-Z]/.test(charArray[i])) continue;
      if (!revealed[i]) indices.push(i);
    }
    if (indices.length === 0) return;
    const idx = sample(indices);
    setRevealed((prev) => {
      const next = prev.slice();
      next[idx] = true;
      return next;
    });
    setHintsUsed((n) => n + 1);
  };

  const submitGuess = () => {
    if (status !== "running") return;
    const g = normalise(guess);
    const t = normalise(target);
    if (!g) return;
    if (g === t) {
      winRound(pointsIfWin, g);
    } else {
      loseRound(g);
    }
  };

  const winRound = (points: number, g: string) => {
    setStatus("won");
    setRecords((r) => [
      { id: roundId, outcome: "Win", points, difficulty, word: target, guess: g, hintsUsed },
      ...r,
    ]);
    setRoundId((n) => n + 1);
    if (typeof window !== "undefined") {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 } });
    }
  };

  const loseRound = (g?: string) => {
    setStatus("lost");
    setRecords((r) => [
      { id: roundId, outcome: "Loss", points: 0, difficulty, word: target, guess: g, hintsUsed },
      ...r,
    ]);
    setRoundId((n) => n + 1);
    setShowExplosion(true);
    if (explosionTO.current !== null) window.clearTimeout(explosionTO.current);
    explosionTO.current = window.setTimeout(() => {
      setShowExplosion(false);
      explosionTO.current = null;
    }, 2000);
  };

  const resetSession = () => {
    setStatus("idle");
    setTarget("");
    setRevealed([]);
    setHintsUsed(0);
    setGuess("");
    setRecords([]);
    setRoundId(1);
    setShowExplosion(false);
  };

  // Stats
  const { avg, successRate, maxPoints } = useMemo(() => {
    const games = records.length;
    const total = records.reduce((s, r) => s + r.points, 0);
    const wins = records.filter((r) => r.outcome === "Win").length;
    const max = records.reduce((m, r) => Math.max(m, r.points), 0);
    return {
      avg: games ? Math.round(total / games) : 0,
      successRate: games ? Math.round((wins / games) * 100) : 0,
      maxPoints: max,
    };
  }, [records]);

  const isRunning = status === "running";

  // UI helpers
  const renderMaskedWord = () => (
    <div className={`mt-2 select-none tabular-nums text-6xl font-extrabold text-black`}>
      {masked || ""}
    </div>
  );

  const DifficultyPicker: React.FC<{ compact?: boolean }> = ({ compact }) => (
    <div className={`inline-flex items-center gap-2 ${compact ? "mt-0" : "mt-2"}`}>
      {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
        <button
          key={d}
          onClick={() => setSelectedDifficulty(d)}
          className={`rounded-2xl px-3 py-2 text-sm font-semibold shadow ${selectedDifficulty === d
            ? d === "easy"
              ? "bg-emerald-600 text-white"
              : d === "medium"
                ? "bg-yellow-600 text-white"
                : "bg-red-700 text-white"
            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
        >
          {d[0].toUpperCase() + d.slice(1)}
        </button>
      ))}
    </div>
  );

  return (
    <Activity>
      <div className="mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <Title level={1}>Word Guesser</Title>
        </div>

        <Paragraph>
          Guess the hidden word. You can request letter hints, but each hint reduces your potential points. Harder words are worth more.
        </Paragraph>

        <Instructions>
          How to Play
          <UL>
            <LI>Select a difficulty, then press Begin.</LI>
            <LI>Type your guess at any time, or reveal a single letter.</LI>
            <LI>Fewer hints = more points. Wrong guess ends the round.</LI>
          </UL>
        </Instructions>

        {/* Control bar */}
        <div className="mt-2 flex flex-wrap items-center justify-between">
          <DifficultyPicker />
          {status !== "running" && (
            <button
              onClick={() => begin()}
              className="rounded-2xl bg-emerald-600 px-6 py-3 text-white font-semibold shadow hover:bg-emerald-700"
            >
              Begin
            </button>
          )}
        </div>

        {/* Display */}
        <motion.div
          className="relative mt-6 rounded-2xl border bg-white p-10 text-center shadow-sm"
          animate={status === "lost" && showExplosion ? { x: [0, -14, 12, -10, 8, -6, 4, -2, 0] } : { x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-sm uppercase tracking-wide text-gray-500">
            {status === "won" && (
              <div className="text-emerald-700 font-semibold">Correct! +{pointsIfWin} pts</div>
            )}
            {status === "lost" && (
              <div className="text-red-700 font-semibold">Incorrect. The word was {target}.</div>
            )}
            {(status !== "lost" && status !== "won") && (
              <span>Word</span>
            )}
          </div>
          {renderMaskedWord()}

          {/* Loss animation overlay */}
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

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <input
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitGuess();
              }}
              placeholder={status === "running" ? "Type your guess…" : "Start a game to guess"}
              className="w-64 rounded-2xl border px-4 py-3 text-black shadow-sm focus:outline-none focus:ring"
              disabled={!isRunning}
            />

            <button
              onClick={submitGuess}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-white font-semibold shadow hover:bg-blue-700 disabled:opacity-50"
              disabled={!isRunning || !guess.trim()}
            >
              Guess
            </button>

            <button
              onClick={revealOne}
              className="rounded-2xl bg-amber-500 px-5 py-3 text-white font-semibold shadow hover:bg-amber-600 disabled:opacity-50"
              disabled={!isRunning || revealed.every(Boolean)}
            >
              Reveal a letter (−pts)
            </button>
          </div>

          {/* Round status banner */}
          {status === "running" && (
            <div className="mt-4 text-gray-700">
              Potential score: <span className="font-semibold">{pointsIfWin} pts</span> • Hints used: <span className="font-semibold">{hintsUsed}</span>
            </div>
          )}

          {(status === "won" || status === "lost") && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-sm text-gray-600">Play again:</span>
              <div className="inline-flex gap-2">
                {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => begin(d)}
                    className={`rounded-2xl px-3 py-2 text-sm font-semibold shadow ${d === "easy"
                      ? "bg-emerald-600 text-white"
                      : d === "medium"
                        ? "bg-yellow-600 text-white"
                        : "bg-red-800 text-white"
                      }`}
                  >
                    {d[0].toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Summary */}
        <div className="mt-4 flex flex-wrap items-center justify-between text-sm">
          <div className="flex flex-row gap-4">
            <div className="rounded-xl bg-gray-900 px-3 py-2">Average: <span className="font-semibold">{avg} pts</span></div>
            <div className="rounded-xl bg-gray-900 px-3 py-2">Success rate: <span className="font-semibold">{successRate}%</span></div>
            <div className="rounded-xl bg-green-900 px-3 py-2">Max: <span className="font-semibold">{maxPoints} pts</span></div>
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
                <th className="px-3">Difficulty</th>
                <th className="px-3">Word</th>
                <th className="px-3">Guess</th>
                <th className="px-3">Hints</th>
                <th className="px-3">Points</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr className="bg-white">
                  <td className="px-3 py-2 text-gray-500 w-full text-center italic" colSpan={7}>No games yet. Select a difficulty and begin.</td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="bg-white shadow-sm">
                    <td className="px-3 py-2 rounded-l-xl font-mono text-black">{r.id}</td>
                    <td className={`px-3 py-2 ${r.outcome === "Win" ? "text-emerald-700" : "text-red-700"}`}>{r.outcome}</td>
                    <td className="px-3 py-2 text-black capitalize">{r.difficulty}</td>
                    <td className="px-3 py-2 text-black">{r.word}</td>
                    <td className="px-3 py-2 text-black">{r.guess ?? "—"}</td>
                    <td className="px-3 py-2 text-black">{r.hintsUsed}</td>
                    <td className="px-3 py-2 rounded-r-xl font-semibold text-black">{r.points}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Activity>
  );
};

export default ActivityB;
