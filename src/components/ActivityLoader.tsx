import {
  useState,
  type ComponentType,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import ActivityA from "@/activities/ActivityA";
import ActivityB from "@/activities/ActivityB";
import ActivityC from "@/activities/ActivityC";
import ActivityD from "@/activities/ActivityD";
import ActivityE from "@/activities/ActivityE";


const componentMap: Record<string, ComponentType<any> | ReactElement> = {
  ActivityA,
  ActivityB,
  ActivityC,
  ActivityD,
  ActivityE,
};

const parseCodes = (): Record<string, string> => {
  const raw = import.meta.env.VITE_CODES || "";
  return raw
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean)
    .reduce((acc: { [x: string]: any; }, pair: { split: (arg0: string) => { (): any; new(): any; map: { (arg0: (s: any) => any): [any, any]; new(): any; }; }; }) => {
      const [code, name] = pair.split(":").map((s) => s.trim());
      if (code && name) acc[code.toUpperCase()] = name;
      return acc;
    }, {} as Record<string, string>);
};

export default function ActivityLoader({
  onLoaded,
}: {
  onLoaded: (node: ReactNode) => void;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const codes = parseCodes();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const key = input.trim().toUpperCase();
    const compName = codes[key];
    const Comp = compName ? componentMap[compName] : undefined;

    let node: ReactNode | null = null;
    if (typeof Comp === "function") {
      const C = Comp as ComponentType<any>;
      node = <C />;
    } else if (Comp && typeof Comp === "object") {
      node = Comp as ReactElement; // already a JSX element
    }

    if (node) {
      onLoaded(node);
    } else {
      setError("Invalid code. Please try again.");
      console.error("Invalid component mapping:", compName, Comp);
    }
  };

  return (
    <div className="p-4 w-full max-w-xl">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          placeholder="Enter activity code"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="border p-2 rounded flex-1"
          aria-label="Activity code"
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Go</button>
      </form>
      {error && <p className="mt-3 text-red-500">{error}</p>}
    </div>
  );
}
