import React, { useEffect, useMemo, useRef, useState } from "react";
import Activity from "@/components/Activity";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Instructions, LI, Paragraph, Title, UL, Warning } from "@/components/Text";

// ======================================================
// ActivityC – Diffusion Grid Puzzle (teaches conv + noise)
// ======================================================
// Mechanics (simple, visual, and fast on-canvas):
// - Target: a 16x16 grayscale sprite (pick from a small bank).
// - Start: pure Gaussian noise in [0,1].
// - Step: x <- clamp( x - η * Conv_k(Act(x)) - γ * (x - target) + σ_t * ε )
//   where Act ∈ {identity, ReLU, tanh}, kernel k from a small palette, σ_t from a schedule.
// - Win if MSE < threshold before T steps; else loss at T.
// - Shows side-by-side grids, delta heatmap, σ schedule progress, PSNR/MSE.

// ---- Config ----
const CONFIG = {
    H: 16,
    W: 16,
    steps: 12,
    etaDefault: 0.25,
    guideDefault: 0.55, // guidance γ
    winMSE: 0.010, // lower is better; ≈ PSNR > 20 dB for 8-bit range normalised
    autoMinMs: 200,
    autoMaxMs: 1200,
} as const;

// ---- Types ----
type Status = "idle" | "running" | "won" | "lost";
type KernelName =
    | "Blur"
    | "Sharpen"
    | "SobelX"
    | "SobelY"
    | "Laplacian"
    | "Emboss"
    | "Custom";

type ActName = "Identity" | "ReLU" | "Tanh";

type GameRecord = {
    id: number;
    outcome: "Win" | "Loss";
    stepsUsed: number;
    psnr: number;
    mse: number;
    kernel: KernelName;
    act: ActName;
    eta: number;
    guidance: number;
    targetName: string;
};

// Simple preset type so we can ship an "optimal" demo
type Preset = {
    name: string;
    kernel: KernelName;
    act: ActName;
    eta: number; // step size
    guidance: number; // gamma
    T: number; // steps
    sigmaStart: number;
    sigmaEnd: number;
};

const PRESETS: Record<string, Preset> = {
    Optimal: {
        // Stable, fast convergence for most sprites; avoids edge-operator blow-ups
        name: "Optimal",
        kernel: "Blur",
        act: "Tanh",
        eta: 0.22,
        guidance: 0.70,
        T: 16,
        sigmaStart: 0.55,
        sigmaEnd: 0.04,
    },
};

// ---- Math helpers ----
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const randn = (() => {
    // Box–Muller, cached
    let spare: number | null = null;
    return () => {
        if (spare !== null) {
            const v = spare; spare = null; return v;
        }
        let u = 0, v = 0, s = 0;
        while (s === 0 || s >= 1) {
            u = Math.random() * 2 - 1;
            v = Math.random() * 2 - 1;
            s = u * u + v * v;
        }
        const mul = Math.sqrt((-2 * Math.log(s)) / s);
        spare = v * mul;
        return u * mul;
    };
})();

function mse(a: number[][], b: number[][]) {
    const H = a.length, W = a[0].length;
    let s = 0;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const d = a[y][x] - b[y][x];
            s += d * d;
        }
    }
    return s / (H * W);
}

function psnr(mseVal: number, maxVal = 1) {
    if (mseVal <= 1e-12) return Infinity;
    return 10 * Math.log10((maxVal * maxVal) / mseVal);
}

function applyAct(x: number, act: ActName) {
    if (act === "ReLU") return Math.max(0, x);
    if (act === "Tanh") return Math.tanh(x * 2 - 1) * 0.5 + 0.5; // keep in [0,1]
    return x;
}

function convolve2d(
    img: number[][],
    kernel: number[][],
    pad: "zero" | "reflect" = "zero"
) {
    const H = img.length, W = img[0].length;
    const KH = kernel.length, KW = kernel[0].length;
    const oy = Math.floor(KH / 2), ox = Math.floor(KW / 2);
    const out: number[][] = Array.from({ length: H }, () => Array(W).fill(0));

    function sample(y: number, x: number) {
        if (y >= 0 && y < H && x >= 0 && x < W) return img[y][x];
        if (pad === "reflect") {
            const yy = y < 0 ? -y - 1 : y >= H ? H - (y - H) - 1 : y;
            const xx = x < 0 ? -x - 1 : x >= W ? W - (x - W) - 1 : x;
            return img[yy][xx];
        }
        return 0;
    }

    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            let s = 0;
            for (let ky = 0; ky < KH; ky++) {
                for (let kx = 0; kx < KW; kx++) {
                    s += kernel[ky][kx] * sample(y + ky - oy, x + kx - ox);
                }
            }
            out[y][x] = s;
        }
    }
    return out;
}

function addNoise(img: number[][], sigma: number) {
    const H = img.length, W = img[0].length;
    const out: number[][] = Array.from({ length: H }, () => Array(W).fill(0));
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            out[y][x] = clamp01(img[y][x] + sigma * randn());
        }
    }
    return out;
}

function blendGuidance(x: number[][], target: number[][], gamma: number) {
    const H = x.length, W = x[0].length;
    const out: number[][] = Array.from({ length: H }, () => Array(W).fill(0));
    for (let y = 0; y < H; y++) {
        for (let x0 = 0; x0 < W; x0++) {
            out[y][x0] = x[y][x0] - gamma * (x[y][x0] - target[y][x0]);
        }
    }
    return out;
}

function mapAct(img: number[][], act: ActName) {
    const H = img.length, W = img[0].length;
    const out: number[][] = Array.from({ length: H }, () => Array(W).fill(0));
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) out[y][x] = applyAct(img[y][x], act);
    }
    return out;
}

function linspace(a: number, b: number, n: number) {
    if (n <= 1) return [a];
    const arr: number[] = new Array(n);
    for (let i = 0; i < n; i++) arr[i] = a + (i * (b - a)) / (n - 1);
    return arr;
}

// ---- Kernels ----
const KERNELS: Record<KernelName, number[][]> = {
    Blur: [
        [1 / 16, 2 / 16, 1 / 16],
        [2 / 16, 4 / 16, 2 / 16],
        [1 / 16, 2 / 16, 1 / 16],
    ],
    Sharpen: [
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0],
    ],
    SobelX: [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1],
    ],
    SobelY: [
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1],
    ],
    Laplacian: [
        [0, 1, 0],
        [1, -4, 1],
        [0, 1, 0],
    ],
    Emboss: [
        [-2, -1, 0],
        [-1, 1, 1],
        [0, 1, 2],
    ],
    Custom: [
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
    ],
};

// ---- Target sprites (16x16) ----
// Encoded as strings of '.' (0) and '#' (1); then lightly blurred for anti-alias.
const SPRITES: { name: string; s: string[] }[] = [
    {
        name: "Smiley",
        s: [
            "................",
            "................",
            ".....######.....",
            "..############..",
            "..############..",
            ".###..####..###.",
            ".###..####..###.",
            ".##############.",
            ".##############.",
            ".##############.",
            ".####..##..####.",
            "..###......###..",
            "..############..",
            ".....######.....",
            "................",
            "................",
        ],
    },
    {
        name: "Heart",
        s: [
            "................",
            "................",
            "................",
            "....##....##....",
            "...####..####...",
            "..############..",
            "..############..",
            "..############..",
            "...##########...",
            "....########....",
            ".....######.....",
            "......####......",
            ".......##.......",
            "................",
            "................",
            "................",
        ],
    },
    {
        name: "Diamond",
        s: [
            "................",
            "................",
            ".......##.......",
            "......####......",
            ".....######.....",
            "....########....",
            "...##########...",
            "..############..",
            "...##########...",
            "....########....",
            ".....######.....",
            "......####......",
            ".......##.......",
            "................",
            "................",
            "................",
        ],
    },
    {
        name: "Square",
        s: [
            "................",
            "................",
            "................",
            "...##########...",
            "...##########...",
            "...##......##...",
            "...##......##...",
            "...##......##...",
            "...##......##...",
            "...##......##...",
            "...##......##...",
            "...##########...",
            "...##########...",
            "................",
            "................",
            "................",
        ],
    },
    {
        name: "Cross",
        s: [
            "................",
            "................",
            "..##........##..",
            "..###......###..",
            "...###....###...",
            "....###..###....",
            ".....######.....",
            "......####......",
            "......####......",
            ".....######.....",
            "....###..###....",
            "...###....###...",
            "..###......###..",
            "..##........##..",
            "................",
            "................",
        ],
    },
    {
        name: "Stripes",
        s: [
            "................",
            "################",
            "################",
            "................",
            "................",
            "################",
            "################",
            "................",
            "................",
            "################",
            "################",
            "................",
            "................",
            "################",
            "################",
            "................",
        ],
    },
];

function spriteToImage(s: string[]): number[][] {
    const H = s.length, W = s[0].length;
    const img: number[][] = Array.from({ length: H }, () => Array(W).fill(0));
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) img[y][x] = s[y][x] === "#" ? 1 : 0;
    }
    // light blur for anti-alias
    return convolve2d(img, KERNELS.Blur, "reflect");
}

function zeros(H: number, W: number) {
    return Array.from({ length: H }, () => Array(W).fill(0));
}
function randomNoise(H: number, W: number) {
    const out = zeros(H, W);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y][x] = clamp01(Math.random());
    return out;
}

// ---- UI subcomponents ----
const PixelGrid: React.FC<{
    grid: number[][];
    alt?: string;
    cell?: number;
}> = ({ grid, alt, cell = 18 }) => {
    const H = grid.length, W = grid[0].length;
    return (
        <div className="inline-block">
            <div
                className="grid rounded-xl border bg-white overflow-hidden"
                style={{ gridTemplateColumns: `repeat(${W}, ${cell}px)` }}
                aria-label={alt}
            >
                {grid.flat().map((v, i) => (
                    <div
                        key={i}
                        className="h-4 w-4"
                        style={{
                            width: cell,
                            height: cell,
                            backgroundColor: `rgb(${Math.round(v * 255)}, ${Math.round(v * 255)}, ${Math.round(v * 255)})`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

const HeatmapGrid: React.FC<{
    a: number[][]; // current
    b: number[][]; // target
    cell?: number;
}> = ({ a, b, cell = 18 }) => {
    const H = a.length, W = a[0].length;
    return (
        <div className="inline-block">
            <div className="grid rounded-xl border bg-white overflow-hidden" style={{ gridTemplateColumns: `repeat(${W}, ${cell}px)` }}>
                {a.flatMap((_, i) => {
                    const y = Math.floor(i / W), x = i % W;
                    const d = Math.abs(a[y][x] - b[y][x]); // [0,1]
                    const r = Math.min(255, Math.round(255 * d));
                    return (
                        <div key={i} style={{ width: cell, height: cell, backgroundColor: `rgb(${r}, 0, 0)`, opacity: 0.7 }} />
                    );
                })}
            </div>
        </div>
    );
};

// ---- Main Component ----
const ActivityC: React.FC = () => {
    const [status, setStatus] = useState<Status>("idle");
    const [targetIdx, setTargetIdx] = useState(0);
    const [target, setTarget] = useState<number[][]>(() => spriteToImage(SPRITES[0].s));
    const [x, setX] = useState<number[][]>(() => randomNoise(CONFIG.H, CONFIG.W));

    const [kernelName, setKernelName] = useState<KernelName>("Blur");
    const [act, setAct] = useState<ActName>("Identity");
    const [eta, setEta] = useState<number>(CONFIG.etaDefault);
    const [guidance, setGuidance] = useState<number>(CONFIG.guideDefault);

    const [customKernel, setCustomKernel] = useState<number[][]>([
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
    ]);

    const [T, setT] = useState<number>(CONFIG.steps);
    const [sigmaStart, setSigmaStart] = useState(0.6);
    const [sigmaEnd, setSigmaEnd] = useState(0.05);
    const schedule = useMemo(() => linspace(sigmaStart, sigmaEnd, T), [sigmaStart, sigmaEnd, T]);
    const [t, set_t] = useState(0);

    const [auto, setAuto] = useState(false);
    const autoTO = useRef<number | null>(null);

    const [records, setRecords] = useState<GameRecord[]>([]);
    const [roundId, setRoundId] = useState(1);

    const [showExplosion, setShowExplosion] = useState(false);
    const explosionTO = useRef<number | null>(null);

    // Derived metrics
    const mseNow = useMemo(() => mse(x, target), [x, target]);
    const psnrNow = useMemo(() => psnr(mseNow), [mseNow]);
    const won = mseNow <= CONFIG.winMSE;

    // Cleanup timers
    useEffect(() => () => {
        if (autoTO.current !== null) window.clearTimeout(autoTO.current);
        if (explosionTO.current !== null) window.clearTimeout(explosionTO.current);
    }, []);

    useEffect(() => {
        if (status !== "running") return;
        if (won) {
            endRound(true);
        } else if (t >= T) {
            endRound(false);
        }
    }, [status, won, t, T]);

    const kernel = useMemo(() => (kernelName === "Custom" ? customKernel : KERNELS[kernelName]), [kernelName, customKernel]);

    function nextStep() {
        // x <- clamp( x - η * Conv_k(Act(x)) - γ * (x - target) + σ_t * ε )
        const actX = mapAct(x, act);
        const conv = convolve2d(actX, kernel, "reflect");
        const H = x.length, W = x[0].length;
        const guided = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, xx) => clamp01(x[y][xx] - eta * conv[y][xx])));
        const toward = blendGuidance(guided, target, guidance);
        const noisy = addNoise(toward, schedule[Math.min(t, schedule.length - 1)]);
        setX(noisy);
        set_t((k) => k + 1);
    }

    function begin() {
        setStatus("running");
        setShowExplosion(false);
        set_t(0);
        setX(randomNoise(CONFIG.H, CONFIG.W));
    }

    function applyPreset(p: Preset, autoRun = true) {
        setKernelName(p.kernel);
        setAct(p.act);
        setEta(p.eta);
        setGuidance(p.guidance);
        setT(p.T);
        setSigmaStart(p.sigmaStart);
        setSigmaEnd(p.sigmaEnd);
        begin();
        if (autoRun) setAuto(true);
    }

    function endRound(w: boolean) {
        setStatus(w ? "won" : "lost");
        if (!w) {
            setShowExplosion(true);
            if (explosionTO.current !== null) window.clearTimeout(explosionTO.current);
            explosionTO.current = window.setTimeout(() => {
                setShowExplosion(false);
                explosionTO.current = null;
            }, 1600);
        } else {
            if (typeof window !== "undefined") confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 } });
        }
        const rec: GameRecord = {
            id: roundId,
            outcome: w ? "Win" : "Loss",
            stepsUsed: Math.min(t, T),
            psnr: psnrNow,
            mse: mseNow,
            kernel: kernelName,
            act,
            eta,
            guidance,
            targetName: SPRITES[targetIdx].name,
        };
        setRecords((r) => [rec, ...r]);
        setRoundId((n) => n + 1);
        setAuto(false);
        if (autoTO.current !== null) window.clearTimeout(autoTO.current);
    }

    function resetSession() {
        if (autoTO.current !== null) window.clearTimeout(autoTO.current);
        setAuto(false);
        setStatus("idle");
        setX(randomNoise(CONFIG.H, CONFIG.W));
        set_t(0);
        setRecords([]);
        setRoundId(1);
        setShowExplosion(false);
    }

    function pickTarget(idx: number) {
        const spr = SPRITES[idx];
        setTargetIdx(idx);
        setTarget(spriteToImage(spr.s));
        set_t(0);
        setX(randomNoise(CONFIG.H, CONFIG.W));
        setStatus("idle");
    }

    // Auto stepping loop
    useEffect(() => {
        if (!auto || status !== "running") return;
        const speed = Math.round(CONFIG.autoMaxMs - (CONFIG.autoMaxMs - CONFIG.autoMinMs) * (eta)); // higher eta -> faster demo
        autoTO.current = window.setTimeout(() => {
            nextStep();
        }, speed);
        return () => {
            if (autoTO.current !== null) window.clearTimeout(autoTO.current);
        };
    }, [auto, status, t, eta]);

    // Stats summary over session
    const { avgPsnr, successRate, bestPsnr } = useMemo(() => {
        const games = records.length;
        const wins = records.filter((r) => r.outcome === "Win").length;
        const ps = records.map((r) => r.psnr).filter((v) => Number.isFinite(v));
        const avg = ps.length ? Math.round((ps.reduce((a, b) => a + b, 0) / ps.length) * 10) / 10 : 0;
        const best = ps.length ? Math.max(...ps) : 0;
        return { avgPsnr: avg, successRate: games ? Math.round((wins / games) * 100) : 0, bestPsnr: Math.round(best * 10) / 10 };
    }, [records]);

    // UI Helpers
    const ControlLabel: React.FC<{ title: string, hint?: string }> = ({ title, hint }) => (
        <div className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-2">
            <span>{title}</span>
            {hint ? <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">{hint}</span> : null}
        </div>
    );

    return (
        <Activity>
            <div className="mx-auto w-full">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                    <Title level={1}>Diffusion Grid</Title>
                </div>

                <Paragraph>
                    Denoise a 16×16 image from noise using a convolution kernel, activation, guidance, and a noise schedule; reach a low error before steps run out.
                </Paragraph>

                <Instructions>
                    What this shows (in plain terms)
                    <UL>
                        <LI><strong>Goal:</strong> start from noise and iteratively <em>pull</em> pixels toward the target while <em>smoothing</em> local structure; you're balancing <em>denoising</em> vs <em>fidelity</em>.</LI>
                        <LI><strong>Convolution</strong> is a tiny filter that encourages shapes/textures; edgey filters add detail but can destabilise, while blur stabilises.</LI>
                        <LI><strong>Guidance</strong> is a direct tug toward the target (like teacher-forced diffusion); high values lock onto the target, low values wander.</LI>
                        <LI><strong>Noise schedule</strong> starts noisy (explore) then cools down (refine); later steps should be quieter.</LI>
                        <LI><strong>Win condition:</strong> MSE ≤ {CONFIG.winMSE} (≈ PSNR &gt; 20 dB) before you hit T steps.</LI>
                    </UL>
                    Quick parameter guide
                    <UL>
                        <LI><strong>η (step size):</strong> how hard each update pushes; too high → oscillations/divergence, too low → slow.</LI>
                        <LI><strong>γ (guidance):</strong> how strongly to match the target this step; think of it as a blend between your current image and the target.</LI>
                        <LI><strong>Kernel:</strong> the shaping prior; <em>Blur</em> = smooth & stable, <em>Sharpen/Laplacian/Sobel</em> = detail & risk, <em>Emboss</em> = directional shading.</LI>
                        <LI><strong>Activation:</strong> pixel nonlinearity; <em>Tanh</em> gently squashes extremes (keeps values sane), <em>ReLU</em> zero-cuts negatives, <em>Identity</em> is raw.</LI>
                        <LI><strong>σ schedule:</strong> noise per step; high early σ encourages exploration, small late σ allows fine detail.</LI>
                    </UL>
                    Tips
                    <UL>
                        <LI>Stuck? Lower η or switch to Blur. Too smooth? Try Sharpen or a small Laplacian with a <em>lower</em> η.</LI>
                        <LI>Crashing (red heatmap everywhere)? Reduce η or γ, or increase T so σ can cool more gradually.</LI>
                    </UL>
                </Instructions>

                <Warning>
                    Please note that this task is highly advanced, and can only be done properly under clear direction. If you are trying to recreate this at home, please read through the worksheet
                    for more information.
                </Warning>

                {/* Presets */}
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <ControlLabel title="Presets" hint="one-click demo" />
                        <div className="mt-2 flex flex-wrap gap-2">
                            <button
                                onClick={() => applyPreset(PRESETS.Optimal)}
                                className="rounded-2xl bg-emerald-600 px-4 py-2 text-white font-semibold shadow hover:bg-emerald-700"
                                aria-label="Run optimal preset"
                            >
                                Run Optimal
                            </button>
                            <div className="text-xs text-gray-600 leading-snug">
                                <div><strong>Optimal</strong>: Blur + Tanh, η=0.22, γ=0.70, T=16, σ: 0.55→0.04 (auto-runs).</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Target picker */}
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <ControlLabel title="Target" />
                        <div className="mt-2 flex flex-wrap gap-2">
                            {SPRITES.map((sp, i) => (
                                <button
                                    key={sp.name}
                                    onClick={() => pickTarget(i)}
                                    className={`rounded-xl px-3 py-1.5 text-sm font-semibold shadow ${i === targetIdx ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}
                                >
                                    {sp.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Kernel & activation */}
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <ControlLabel title="Kernel" />
                        <div className="mt-2 flex flex-wrap gap-2">
                            {(["Blur", "Sharpen", "SobelX", "SobelY", "Laplacian", "Emboss", "Custom"] as KernelName[]).map((k) => (
                                <button key={k} onClick={() => setKernelName(k)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold shadow ${kernelName === k ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>{k}</button>
                            ))}
                        </div>
                        {kernelName === "Custom" && (
                            <div className="mt-3 grid grid-cols-3 gap-1">
                                {customKernel.flatMap((vRow, r) => vRow.map((v, c) => (
                                    <input
                                        key={`${r}-${c}`}
                                        type="number"
                                        value={v}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            setCustomKernel((K) => {
                                                const next = K.map((row) => row.slice());
                                                next[r][c] = Number.isFinite(val) ? val : 0;
                                                return next;
                                            });
                                        }}
                                        className="w-16 rounded border px-1 py-0.5 text-sm text-black"
                                        step="0.1"
                                    />
                                )))}
                            </div>
                        )}
                        <div className="mt-3">
                            <ControlLabel title="Activation" />
                            <div className="mt-2 flex gap-2">
                                {(["Identity", "ReLU", "Tanh"] as ActName[]).map((a) => (
                                    <button key={a} onClick={() => setAct(a)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold shadow ${act === a ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>{a}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Hyperparameters */}
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <ControlLabel title="Hyperparameters" />
                        <div className="mt-2 space-y-3">
                            <div>
                                <div className="text-xs text-gray-600">η (step size): {eta.toFixed(2)}</div>
                                <input type="range" min={0.05} max={0.8} step={0.01} value={eta} onChange={(e) => setEta(parseFloat(e.target.value))} className="w-full" />
                            </div>
                            <div>
                                <div className="text-xs text-gray-600">γ (guidance): {guidance.toFixed(2)}</div>
                                <input type="range" min={0} max={1} step={0.01} value={guidance} onChange={(e) => setGuidance(parseFloat(e.target.value))} className="w-full" />
                            </div>
                            <div>
                                <div className="text-xs text-gray-600">T (steps): {T}</div>
                                <input type="range" min={6} max={24} step={1} value={T} onChange={(e) => { setT(parseInt(e.target.value)); if (t > parseInt(e.target.value)) set_t(parseInt(e.target.value)); }} className="w-full" />
                            </div>
                            <div>
                                <div className="text-xs text-gray-600">σ start: {sigmaStart.toFixed(2)}</div>
                                <input type="range" min={0} max={1} step={0.01} value={sigmaStart} onChange={(e) => setSigmaStart(parseFloat(e.target.value))} className="w-full" />
                            </div>
                            <div>
                                <div className="text-xs text-gray-600">σ end: {sigmaEnd.toFixed(2)}</div>
                                <input type="range" min={0} max={1} step={0.01} value={sigmaEnd} onChange={(e) => setSigmaEnd(parseFloat(e.target.value))} className="w-full" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Display & Actions */}
                <motion.div
                    className="relative mt-6 rounded-2xl border bg-white p-6 text-center shadow-sm"
                    animate={status === "lost" && showExplosion ? { x: [0, -14, 12, -10, 8, -6, 4, -2, 0] } : { x: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="grid gap-6 lg:grid-cols-[auto_auto_1fr] items-center justify-items-center">
                        {/* Grids */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="text-sm uppercase tracking-wide text-gray-500">Target</div>
                            <PixelGrid grid={target} alt="Target image" />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <div className="text-sm uppercase tracking-wide text-gray-500">Current</div>
                            <PixelGrid grid={x} alt="Current image" />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <div className="text-sm uppercase tracking-wide text-gray-500">Delta Heatmap</div>
                            <HeatmapGrid a={x} b={target} />
                        </div>
                    </div>

                    {/* Explosion overlay on loss */}
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
                                    transition={{ duration: 1.6, times: [0, 0.06, 1], ease: "easeOut" }}
                                    style={{
                                        background:
                                            "radial-gradient(circle at center, rgba(255,255,255,0.95), rgba(255,0,0,0.6) 40%, rgba(0,0,0,0.6) 70%)",
                                        mixBlendMode: "screen",
                                    }}
                                />
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

                    {/* Metrics & Stepper */}
                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-xl bg-gray-900 px-3 py-2 text-white">MSE: <span className="font-semibold">{mseNow.toFixed(4)}</span></div>
                        <div className="rounded-xl bg-gray-900 px-3 py-2 text-white">PSNR: <span className="font-semibold">{Number.isFinite(psnrNow) ? psnrNow.toFixed(1) + " dB" : "∞"}</span></div>
                        <div className="rounded-xl bg-gray-900 px-3 py-2 text-white">Step: <span className="font-semibold">{Math.min(t, T)} / {T}</span></div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                        {status !== "running" && (
                            <>
                                <button onClick={begin} className="rounded-2xl bg-emerald-600 px-6 py-3 text-white font-semibold shadow hover:bg-emerald-700">{status === "idle" ? "Begin" : "Play Again"}</button>
                                <button onClick={() => applyPreset(PRESETS.Optimal)} className="rounded-2xl bg-indigo-600 px-6 py-3 text-white font-semibold shadow hover:bg-indigo-700">Run Optimal</button>
                            </>
                        )}
                        {status === "running" && (
                            <>
                                <button onClick={nextStep} className="rounded-2xl bg-blue-600 px-6 py-3 text-white font-semibold shadow hover:bg-blue-700">Step</button>
                                <button onClick={() => setAuto((v) => !v)} className={`rounded-2xl px-6 py-3 text-white font-semibold shadow ${auto ? "bg-amber-600 hover:bg-amber-700" : "bg-amber-500 hover:bg-amber-600"}`}>{auto ? "Pause Auto" : "Auto"}</button>
                            </>
                        )}
                    </div>

                    {/* Round status banner */}
                    {status === "won" && (
                        <div className="mt-4 text-emerald-700 font-semibold">Nice! You reconstructed the target. PSNR {Number.isFinite(psnrNow) ? psnrNow.toFixed(1) : "∞"} dB.</div>
                    )}
                    {status === "lost" && (
                        <div className="mt-4 text-red-700 font-semibold">Out of steps. Try different η/γ or kernels.</div>
                    )}

                    {/* Sigma schedule progress */}
                    <div className="mt-6">
                        <ControlLabel title="Noise schedule σt" hint="lower is cleaner" />
                        <div className="mt-2 flex items-end gap-1">
                            {schedule.map((s, i) => (
                                <div key={i} className={`w-4 rounded-t ${i < t ? "bg-emerald-500" : "bg-gray-300"}`} style={{ height: Math.max(4, Math.round(s * 40)) }} />
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Summary */}
                <div className="mt-4 flex flex-wrap items-center justify-between text-sm">
                    <div className="flex flex-row gap-4">
                        <div className="rounded-xl bg-gray-900 px-3 py-2 text-white">Avg PSNR: <span className="font-semibold">{avgPsnr} dB</span></div>
                        <div className="rounded-xl bg-gray-900 px-3 py-2 text-white">Success rate: <span className="font-semibold">{successRate}%</span></div>
                        <div className="rounded-xl bg-green-900 px-3 py-2 text-white">Best: <span className="font-semibold">{bestPsnr} dB</span></div>
                    </div>
                    <button onClick={resetSession} className="rounded-2xl bg-red-800 px-4 py-1 text-gray-100 font-medium hover:bg-gray-300">Reset session</button>
                </div>

                {/* Session Table */}
                <div className="mt-8 overflow-x-auto rounded-xl overflow-hidden">
                    <table className="min-w-full border-separate">
                        <thead>
                            <tr className="text-left text-sm text-gray-500 bg-white">
                                <th className="px-3">#</th>
                                <th className="px-3">Outcome</th>
                                <th className="px-3">Target</th>
                                <th className="px-3">Kernel</th>
                                <th className="px-3">Act</th>
                                <th className="px-3">η</th>
                                <th className="px-3">γ</th>
                                <th className="px-3">Steps</th>
                                <th className="px-3">PSNR</th>
                                <th className="px-3">MSE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.length === 0 ? (
                                <tr className="bg-white">
                                    <td className="px-3 py-2 text-gray-500 w-full text-center italic" colSpan={10}>No games yet. Pick a target and begin.</td>
                                </tr>
                            ) : (
                                records.map((r) => (
                                    <tr key={r.id} className="bg-white shadow-sm">
                                        <td className="px-3 py-2 rounded-l-xl font-mono text-black">{r.id}</td>
                                        <td className={`px-3 py-2 ${r.outcome === "Win" ? "text-emerald-700" : "text-red-700"}`}>{r.outcome}</td>
                                        <td className="px-3 py-2 text-black">{r.targetName}</td>
                                        <td className="px-3 py-2 text-black">{r.kernel}</td>
                                        <td className="px-3 py-2 text-black">{r.act}</td>
                                        <td className="px-3 py-2 text-black">{r.eta.toFixed(2)}</td>
                                        <td className="px-3 py-2 text-black">{r.guidance.toFixed(2)}</td>
                                        <td className="px-3 py-2 text-black">{r.stepsUsed}</td>
                                        <td className="px-3 py-2 text-black">{Number.isFinite(r.psnr) ? r.psnr.toFixed(1) : "∞"}</td>
                                        <td className="px-3 py-2 rounded-r-xl font-mono text-black">{r.mse.toFixed(4)}</td>
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

export default ActivityC;
