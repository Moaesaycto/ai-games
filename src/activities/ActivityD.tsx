import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Activity from "@/components/Activity";
import { Title, Paragraph, Instructions, UL, LI } from "@/components/Text";
import { motion } from "framer-motion";

// ======================================================
// ActivityD — Draw a digit, see a live guess + the guts
// Fixes:
//  - Correct pointer→canvas mapping (CSS px, not backing px)
//  - Overlay bbox draws in CSS space
//  - Responsive, DPR-safe canvas sizing with ResizeObserver
//  - Keeps drawings across resizes
// ======================================================

// Types
 type NumGrid = number[][]; // row-major [H][W] in [0,1]
 type Pred = { digit: number; prob: number; dist: number };

 // Small image utils
 const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
 const H28 = 28, W28 = 28;

 function zeros(h: number, w: number): NumGrid {
  return Array.from({ length: h }, () => Array(w).fill(0));
 }

 function fromImageDataToGray(img: ImageData, invert = true): NumGrid {
  const { width, height, data } = img;
  const out = zeros(height, width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // luma (rec. 601)
      const v = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255; // [0,1], white≈1
      out[y][x] = invert ? 1 - v : v;  // ink ~1
    }
  }
  return out;
 }

 function toImageData(grid: NumGrid): ImageData {
  const h = grid.length, w = grid[0].length;
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = clamp01(grid[y][x]);
      const g = Math.round(v * 255);
      img.data[i] = g; img.data[i + 1] = g; img.data[i + 2] = g; img.data[i + 3] = 255;
    }
  }
  return img;
 }

void toImageData

 function mse(a: NumGrid, b: NumGrid): number {
  const h = a.length, w = a[0].length;
  let s = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = a[y][x] - b[y][x]; s += d * d; }
  return s / (h * w);
 }

 // reflect helper for padding
 const reflect = (i: number, n: number) => {
  if (n === 1) return 0;
  while (i < 0 || i >= n) i = i < 0 ? -i - 1 : 2 * n - i - 1;
  return i;
 };

 // 3x3 conv with reflect padding (fixed)
 function convolve3(img: NumGrid, k: number[][]): NumGrid {
  const h = img.length, w = img[0].length;
  const out = zeros(h, w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const yy = reflect(y + ky, h);
          const xx = reflect(x + kx, w);
          s += img[yy][xx] * k[ky + 1][kx + 1];
        }
      }
      out[y][x] = s;
    }
  }
  return out;
 }

 function normalizeAbs(g: NumGrid): NumGrid {
  const h = g.length, w = g[0].length;
  let m = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m = Math.max(m, Math.abs(g[y][x]));
  if (m < 1e-8) return zeros(h, w);
  const out = zeros(h, w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y][x] = Math.abs(g[y][x]) / m;
  return out;
 }

 function maxPool2(g: NumGrid): NumGrid {
  const h = g.length, w = g[0].length;
  const H = Math.floor(h / 2), W = Math.floor(w / 2);
  const out = zeros(H, W);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = g[2*y][2*x], b = g[2*y][2*x+1], c = g[2*y+1][2*x], d = g[2*y+1][2*x+1];
      out[y][x] = Math.max(a, b, c, d);
    }
  }
  return out;
 }

 // Classic filters we can visualise
const KERNELS = {
  SobelX: [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1]
  ],
  SobelY: [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1]
  ],
  Laplace: [
    [0, 1, 0],
    [1, -4, 1],
    [0, 1, 0]
  ],
  Blur3: [
    [1 / 16, 2 / 16, 1 / 16],
    [2 / 16, 4 / 16, 2 / 16],
    [1 / 16, 2 / 16, 1 / 16]
  ]
};

 // Prototype bank built from canvas-rendered fonts
 type Proto = { digit: number; grid: NumGrid };

 function drawDigitPrototype(d: number, font: string, size: number, dx = 0, dy = 0): NumGrid {
  const c = document.createElement("canvas"); c.width = W28; c.height = H28;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `bold ${size}px ${font}`;
  ctx.fillText(String(d), W28/2 + dx, H28/2 + dy);
  const img = ctx.getImageData(0,0,W28,H28);
  return fromImageDataToGray(img, true);
 }

 function buildPrototypeBank(): Map<number, Proto[]> {
  const map = new Map<number, Proto[]>();
  const fonts = ["Arial", "Courier New", "Georgia", "system-ui", "Helvetica"];
  const sizes = [18, 20, 22, 24];
  const offsets = [-1, 0, 1];
  for (let d = 0; d <= 9; d++) {
    const arr: Proto[] = [];
    for (const f of fonts) for (const s of sizes) for (const ox of offsets) for (const oy of offsets) {
      arr.push({ digit: d, grid: drawDigitPrototype(d, f, s, ox, oy) });
    }
    map.set(d, arr);
  }
  return map;
 }

 // HiDPI-aware canvas setup
 function setupCanvas(c: HTMLCanvasElement, cssSize: number, dpr: number) {
  c.style.width = `${cssSize}px`;
  c.style.height = `${cssSize}px`;
  c.width = Math.floor(cssSize * dpr);
  c.height = Math.floor(cssSize * dpr);
  const ctx = c.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
 }

 // Preprocess drawing to MNIST-like 28x28 using scratch canvases
 function preprocessTo28x28(source: HTMLCanvasElement, scratchCrop: HTMLCanvasElement, scratchOut: HTMLCanvasElement): { grid: NumGrid; bbox: {x:number;y:number;w:number;h:number}|null } {
  const w = source.width, h = source.height; // backing px
  const ctx = source.getContext("2d")!;
  // operate in backing pixels
  const prev = ctx.getTransform();
  ctx.setTransform(1,0,0,1,0,0);
  const img = ctx.getImageData(0,0,w,h);
  ctx.setTransform(prev.a, prev.b, prev.c, prev.d, prev.e, prev.f);

  const gray = fromImageDataToGray(img, true); // ink ~= 1, bg ~= 0
  // threshold lightly to find bounding box
  let minx=w, miny=h, maxx=-1, maxy=-1;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) if (gray[y][x] > 0.08) { minx=Math.min(minx,x); miny=Math.min(miny,y); maxx=Math.max(maxx,x); maxy=Math.max(maxy,y); }
  if (maxx < 0) { return { grid: zeros(H28,W28), bbox: null }; }
  const bw = maxx-minx+1, bh = maxy-miny+1;
  // scale longest side to 20px (like MNIST inner box), keep aspect
  const scale = 20 / Math.max(bw, bh);
  const sw = Math.max(1, Math.round(bw * scale));
  const sh = Math.max(1, Math.round(bh * scale));
  // reuse scratch canvases
  scratchCrop.width = sw; scratchCrop.height = sh;
  const cctx = scratchCrop.getContext("2d")!;
  cctx.imageSmoothingEnabled = true; cctx.imageSmoothingQuality = "high";
  cctx.setTransform(1,0,0,1,0,0);
  cctx.clearRect(0,0,sw,sh);
  cctx.drawImage(source, minx, miny, bw, bh, 0, 0, sw, sh);

  scratchOut.width = W28; scratchOut.height = H28;
  const octx = scratchOut.getContext("2d")!;
  octx.setTransform(1,0,0,1,0,0);
  octx.fillStyle = "#fff"; octx.fillRect(0,0,W28,H28);
  const ox = Math.floor((W28 - sw)/2), oy = Math.floor((H28 - sh)/2);
  octx.drawImage(scratchCrop, ox, oy);
  const outImg = octx.getImageData(0,0,W28,H28);
  const grid = fromImageDataToGray(outImg, true);
  return { grid, bbox: { x:minx, y:miny, w:bw, h:bh } };
 }

 // Pixel grid for visualisation
 const PixelGrid: React.FC<{ grid: NumGrid; alt?: string; cell?: number }> = ({ grid, alt, cell = 12 }) => (
  <div className="inline-block">
    <div className="grid rounded-xl border bg-white overflow-hidden" style={{ gridTemplateColumns: `repeat(${grid[0].length}, ${cell}px)` }} aria-label={alt} role="img">
      {grid.flat().map((v, i) => (
        <div key={i} style={{ width: cell, height: cell, backgroundColor: `rgb(${Math.round(v*255)},${Math.round(v*255)},${Math.round(v*255)})` }} />
      ))}
    </div>
  </div>
 );

 // Main component
 const ActivityD: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [cssCanvasSize, setCssCanvasSize] = useState<number>(280); // responsive
  const [grid28, setGrid28] = useState<NumGrid>(() => zeros(H28, W28));
  const [preds, setPreds] = useState<Pred[]>([]);
  const [topProto, setTopProto] = useState<NumGrid | null>(null);

  const drawRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const scratchCropRef = useRef<HTMLCanvasElement | null>(null);
  const scratchOutRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [brush, setBrush] = useState(22);
  const dprRef = useRef<number>(Math.max(1, window.devicePixelRatio || 1));

  // Build prototypes once
  const protos = useMemo(() => buildPrototypeBank(), []);

  // Responsive / DPR-aware initialisation & resizing
  useEffect(() => {
    const c = drawRef.current; if (!c) return;
    const overlay = overlayRef.current!;

    const applySize = (size: number) => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      dprRef.current = dpr;
      // Save current bitmap to preserve drawing
      const oldCtx = c.getContext("2d")!;
      const oldTransform = oldCtx.getTransform();
      void oldTransform
      oldCtx.setTransform(1,0,0,1,0,0);
      const oldBmp = document.createElement("canvas");
      oldBmp.width = c.width; oldBmp.height = c.height;
      (oldBmp.getContext("2d")!).drawImage(c, 0, 0);
      // Reconfigure canvases
      const ctx = setupCanvas(c, size, dpr);
      setupCanvas(overlay, size, dpr);
      // Restore drawing scaled to new backing store
      ctx.drawImage(oldBmp, 0, 0, oldBmp.width, oldBmp.height, 0, 0, c.width, c.height);
      // Stylings
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#000"; ctx.lineWidth = brush; ctx.fillStyle = "#fff";
      // ensure white background if blank
      // (no-op if already drawn)
    };

    // Initial size
    applySize(cssCanvasSize);

    // ResizeObserver to follow container width
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = Math.floor(entry.contentRect.width);
      const size = Math.max(180, Math.min(440, width));
      if (size !== cssCanvasSize) {
        setCssCanvasSize(size);
        applySize(size);
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);

    // DPR change listener
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onDprChange = () => applySize(cssCanvasSize);
    // Some browsers don't fire; also listen to window resize
    window.addEventListener("resize", onDprChange);

    // scratch canvases off-DOM
    scratchCropRef.current = document.createElement("canvas");
    scratchOutRef.current = document.createElement("canvas");

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onDprChange);
      mq.removeEventListener?.("change", onDprChange);
      // no cleanup needed for scratch
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep brush in sync
  useEffect(() => {
    const c = drawRef.current; if (!c) return; c.getContext("2d")!.lineWidth = brush;
  }, [brush]);

  // Pointer helpers (use CSS pixels; ctx is scaled by DPR)
  const getPos = (e: PointerEvent, el: HTMLCanvasElement) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left; // CSS px
    const y = e.clientY - rect.top;  // CSS px
    return { x, y };
  };

  const startDraw = useCallback((x: number, y: number) => {
    const c = drawRef.current; if (!c) return;
    drawing.current = true;
    const ctx = c.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const drawTo = useCallback((x: number, y: number) => {
    const c = drawRef.current; if (!c || !drawing.current) return;
    const ctx = c.getContext("2d")!;
    ctx.lineTo(x, y);
    ctx.stroke();
  }, []);

  const endDraw = useCallback(() => { drawing.current = false; }, []);

  // Live processing (throttled by rAF)
  const rafId = useRef<number | null>(null);
  const processNow = useCallback(() => {
    if (!drawRef.current) return;
    const crop = scratchCropRef.current!;
    const out = scratchOutRef.current!;
    const { grid, bbox } = preprocessTo28x28(drawRef.current, crop, out);
    setGrid28(grid);
    // bbox overlay draw — use CSS coords
    const ov = overlayRef.current; if (ov) {
      const dpr = dprRef.current;
      const octx = ov.getContext("2d")!;
      octx.clearRect(0,0,ov.width,ov.height);
      if (bbox) {
        // Work in CSS space by dividing by dpr
        const x = bbox.x / dpr, y = bbox.y / dpr, w = bbox.w / dpr, h = bbox.h / dpr;
        octx.strokeStyle = "rgba(0,0,0,0.35)"; octx.lineWidth = 2;
        octx.strokeRect(x, y, w, h);
      }
    }
    // Classify via prototype MSE
    const dists: number[] = new Array(10).fill(1e9);
    let bestGrid: NumGrid | null = null; let bestDist = Infinity;
    for (let d = 0; d <= 9; d++) {
      const arr = protos.get(d)!;
      for (const p of arr) {
        const dist = mse(grid, p.grid);
        if (dist < dists[d]) dists[d] = dist;
        if (dist < bestDist) { bestDist = dist; bestGrid = p.grid; }
      }
    }
    // temperature auto-tune
    const spread = Math.max(1e-9, Math.max(...dists) - Math.min(...dists));
    const alpha = Math.min(120, Math.max(30, 60 / Math.sqrt(spread + 1e-9)));
    const logits = dists.map((dd) => -alpha * dd);
    const maxL = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - maxL));
    const Z = exps.reduce((a,b)=>a+b,0);
    const probs = exps.map((e)=> e/Z);
    const predArr: Pred[] = probs.map((p, i) => ({ digit: i, prob: p, dist: dists[i] }));
    predArr.sort((a,b)=> b.prob - a.prob);
    setPreds(predArr);
    setTopProto(bestGrid);
  }, [protos]);

  const requestProcess = useCallback(() => {
    if (rafId.current) return; // coalesce
    rafId.current = requestAnimationFrame(() => { rafId.current = null; processNow(); });
  }, [processNow]);

  useEffect(() => () => { if (rafId.current) cancelAnimationFrame(rafId.current); }, []);

  // Attach PointerEvent listeners directly for best latency
  useEffect(() => {
    const c = drawRef.current; if (!c) return;
    const onPointerDown = (e: PointerEvent) => { e.preventDefault(); c.setPointerCapture(e.pointerId); const {x,y} = getPos(e, c); startDraw(x,y); drawTo(x,y); requestProcess(); };
    const onPointerMove = (e: PointerEvent) => { if (!drawing.current) return; e.preventDefault(); const {x,y} = getPos(e, c); drawTo(x,y); requestProcess(); };
    const onPointerUp = (e: PointerEvent) => { e.preventDefault(); c.releasePointerCapture?.(e.pointerId); endDraw(); requestProcess(); };
    c.addEventListener("pointerdown", onPointerDown);
    c.addEventListener("pointermove", onPointerMove);
    c.addEventListener("pointerup", onPointerUp);
    c.addEventListener("pointerleave", onPointerUp);
    return () => {
      c.removeEventListener("pointerdown", onPointerDown);
      c.removeEventListener("pointermove", onPointerMove);
      c.removeEventListener("pointerup", onPointerUp);
      c.removeEventListener("pointerleave", onPointerUp);
    };
  }, [drawTo, endDraw, requestProcess, startDraw]);

  const clear = () => {
    const c = drawRef.current; if (!c) return; const ctx = c.getContext("2d")!; ctx.save();
    // reset transform since setupCanvas set dpr scale
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = "#fff"; ctx.fillRect(0,0,c.width,c.height);
    ctx.restore();
    const ov = overlayRef.current; if (ov) ov.getContext("2d")!.clearRect(0,0,ov.width,ov.height);
    setGrid28(zeros(H28,W28)); setPreds([]); setTopProto(null);
  };

  // Feature maps (derived from grid28)
  const feat = useMemo(() => {
    const g = grid28;
    const sx = normalizeAbs(convolve3(g, KERNELS.SobelX));
    const sy = normalizeAbs(convolve3(g, KERNELS.SobelY));
    const lap = normalizeAbs(convolve3(g, KERNELS.Laplace));
    const blur = normalizeAbs(convolve3(g, KERNELS.Blur3));
    return { sx, sy, lap, blur, pool_sx: maxPool2(sx), pool_sy: maxPool2(sy) };
  }, [grid28]);

  const top3 = preds.slice(0,3);

  return (
    <Activity>
      <div className="mx-auto w-full">
        <div className="flex items-center justify-between gap-2">
          <Title level={1}>Draw a Digit</Title>
        </div>
        <Paragraph>
          Sketch any digit (0–9). The model centres and shrinks your drawing to a 28x28 patch (MNIST-style), compares it to a bank of digit prototypes, and updates the guess in real time. Side panels show classic conv filters (Sobel/Laplacian/Blur) and pooled maps so you can see what features light up.
        </Paragraph>

        <Instructions>
          How it works
          <UL>
            <LI><strong>Preprocess:</strong> we crop your ink, scale longest side to 20px, and centre into 28x28.</LI>
            <LI><strong>Classify:</strong> template-matching vs many font-rendered prototypes; softmax over MSE gives probabilities (auto temperature).</LI>
            <LI><strong>Visualise:</strong> 3x3 conv filters highlight edges and blobs; 2x2 max-pool shows downsampled features.</LI>
          </UL>
        </Instructions>

        {/* Main layout */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[auto_1fr]">
          {/* Draw area */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wide text-gray-500">Canvas</div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-600" htmlFor="brush">Brush: {brush}px</label>
                <input id="brush" type="range" min={6} max={40} step={1} value={brush} onChange={(e)=> setBrush(parseInt(e.target.value))} />
                <button onClick={clear} className="rounded-xl bg-red-700 px-3 py-1.5 text-white text-sm font-semibold shadow hover:bg-red-800">Clear</button>
              </div>
            </div>
            <div ref={containerRef} className="relative mt-2">
              <canvas
                ref={drawRef}
                className="touch-none rounded-xl border shadow-sm bg-white"
                aria-label="Digit drawing canvas"
              />
              <canvas ref={overlayRef} className="pointer-events-none absolute left-0 top-0 rounded-xl" />
            </div>
          </div>

          {/* Right: Predictions + Working */}
          <div className="grid gap-4">
            {/* Predictions */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-gray-500">Prediction</div>
              {top3.length === 0 ? (
                <div className="mt-2 text-gray-500">Draw a digit to see probabilities.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {top3.map((p) => (
                    <div key={p.digit} className="grid grid-cols-[28px_1fr_auto] items-center gap-2 text-black">
                      <div className="text-lg font-semibold tabular-nums">{p.digit}</div>
                      <div className="h-2 rounded bg-gray-200 overflow-hidden"><div className="h-full bg-emerald-600" style={{ width: `${Math.round(p.prob*100)}%` }} /></div>
                      <div className="text-sm tabular-nums w-14 text-right">{(p.prob*100).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preprocessed 28x28 + best prototype */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Preprocessed (28x28) & Closest Prototype</div>
              <div className="flex items-start gap-6">
                <div className="flex flex-col items-center gap-1">
                  <div className="text-[11px] text-gray-500">Your input</div>
                  <PixelGrid grid={grid28} cell={10} />
                </div>
                {topProto && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-[11px] text-gray-500">Closest prototype</div>
                    <PixelGrid grid={topProto} cell={10} />
                  </div>
                )}
              </div>
            </div>

            {/* Feature maps */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Conv filters (abs-normalised)</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] text-gray-500">Sobel X</div>
                  <PixelGrid grid={feat.sx} cell={8} />
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">Sobel Y</div>
                  <PixelGrid grid={feat.sy} cell={8} />
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">Laplacian</div>
                  <PixelGrid grid={feat.lap} cell={8} />
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">Blur</div>
                  <PixelGrid grid={feat.blur} cell={8} />
                </div>
              </div>
              <div className="mt-4 text-xs uppercase tracking-wide text-gray-500 mb-1">Max-pooled (2x2, stride 2)</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] text-gray-500">Pool(Sobel X)</div>
                  <PixelGrid grid={feat.pool_sx} cell={8} />
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">Pool(Sobel Y)</div>
                  <PixelGrid grid={feat.pool_sy} cell={8} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <motion.div className="mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          Note: this is a didactic, transparent classifier (prototype matching + simple conv visualisations), not a trained CNN. It's robust enough for most handwriting, but if it struggles try writing larger, with a single stroke, and centred.
        </motion.div>
      </div>
    </Activity>
  );
 };

export default ActivityD;
