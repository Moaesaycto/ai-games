import Activity from "@/components/Activity";
import { Instructions, LI, Paragraph, Title, UL } from "@/components/Text";
import { TrashIcon } from "@radix-ui/react-icons";
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

const GAS_URL = (import.meta as any).env.VITE_GAS_URL;
const PROMPTS = ["chicken", "bee", "cat", "dog"] as const;

const ActivityE = () => {
  const sigRef = useRef<SignatureCanvas>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 500, h: 300 });

  function paintWhite() {
    const canvas = sigRef.current?.getCanvas();
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "source-over";
      }
    }
  }

  useEffect(() => {
    setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  }, []);

  useEffect(() => {
    const resize = () => {
      const maxW = 700;
      const ar = 5 / 3;
      const cw = Math.min(maxW, wrapRef.current?.clientWidth || maxW);
      const w = Math.max(300, Math.round(cw));
      const h = Math.round(w / ar);
      setSize({ w, h });
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (sigRef.current) {
      const ctx = sigRef.current.getCanvas().getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size.w, size.h);
      }
    }
  }, [size]);

  const clear = () => {
    if (sigRef.current) {
      sigRef.current.clear();
      const ctx = sigRef.current.getCanvas().getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size.w, size.h);
      }
    }
  };

  const upload = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) { setMsg("Please draw something before submitting."); return; }
    if (!GAS_URL) { setMsg("Missing GAS_URL – add your Apps Script Web App URL."); return; }
    setUploading(true); setMsg("");
    try {
      paintWhite();
      const dataUrl = sigRef.current.getCanvas().toDataURL("image/png");
      await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ prompt, pngBase64: dataUrl }) });
      setMsg("Submitted!");
      setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
      clear();
    } catch (err: any) { setMsg(`Submit failed: ${err?.message || err}`); }
    finally { setUploading(false); }
  };

  return (
    <Activity>
      <div className="mx-auto w-full">
        <div className="flex items-center justify-between gap-2">
          <Title level={1}>Pictionary Data Creation</Title>
        </div>
        <Paragraph>
          In order to get the AI to work, we need to teach it what certain things look like. Read the instructions carefully.
        </Paragraph>
        <Instructions>
          How to Teach the model
          <UL>
            <LI>You will be provided a prompt, which will be {PROMPTS.map((item, idx) => {
              if (idx === PROMPTS.length - 1) return `or ${item}`;
              if (idx === PROMPTS.length - 2) return `${item} `;
              return `${item}, `;
            })}.</LI>
            <LI>In the white canvas, you are to draw a doodle of the prompt.</LI>
            <LI>When you are happy with the doodle, press the "Submit" button. This will send the drawing to the server to train the model.</LI>
            <LI>If you are unhappy with your drawing, press the "Clear" button.</LI>
            <LI>Repeat as many times as you want. The more data to work from, the better.</LI>
            <LI>If you get the same prompt more than once, try drawing it differently to how you did before.</LI>
          </UL>
        </Instructions>
        <Paragraph>
          Your drawings will directly be used to train the AI model, so make sure you are drawing it carefully and accurately.
        </Paragraph>
      </div>
      <div ref={wrapRef} className="w-full max-w-md mx-auto p-4 grid gap-3">
        <h2 className="text-lg font-semibold">Draw a {prompt}</h2>
        <SignatureCanvas
          ref={sigRef}
          penColor="#000"
          backgroundColor="#fff"
          canvasProps={{
            width: size.w,
            height: size.h,
            className: "border rounded",
            style: { width: `${size.w}px`, height: `${size.h}px` }
          }}
        />
        <div className="flex gap-2 justify-between">
          <button onClick={upload} disabled={uploading} className="px-3 py-1 border rounded">
            {uploading ? "Submitting..." : "Submit"}
          </button>
          <button onClick={clear} className="px-3 py-1 border border-red-500 text-red-500 rounded flex gap-2 items-center">
            <TrashIcon width={20} height={20} />
            <span>Clear</span>
          </button>
        </div>
        {msg && <p className="text-xs opacity-80">{msg}</p>}
      </div>
    </Activity>
  );
}

export default ActivityE;
