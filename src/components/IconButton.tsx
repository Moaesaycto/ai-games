import type { ReactNode } from "react";
import { useState } from "react";

type IconButtonProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  color: string; // hex value, e.g. "#3b82f6"
  link: string;
  suppressWarning?: boolean; // optional flag to skip the warning
  openInNewTab?: boolean; // optional flag for tab behaviour, defaults to true
};

const IconButton = ({
  icon,
  title,
  subtitle,
  color,
  link,
  suppressWarning = false,
  openInNewTab = true,
}: IconButtonProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const textColor = getContrastYIQ(color);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (suppressWarning) {
      navigateToLink();
    } else {
      setShowDialog(true);
    }
  };

  const navigateToLink = () => {
    if (openInNewTab) {
      window.open(link, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = link;
    }
  };

  const confirmNavigation = () => {
    navigateToLink();
    setShowDialog(false);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-4 p-5 rounded-2xl transition hover:scale-105 w-full text-left"
        style={{
          backgroundColor: color,
          color: textColor,
        }}
      >
        <div
          className="flex items-center justify-center w-16 h-16 rounded-full"
          style={{
            backgroundColor: darkenColor(color, 0.15),
            color: textColor,
          }}
        >
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold">{title}</span>
          <span className="text-lg opacity-80">{subtitle}</span>
        </div>
      </button>

      {showDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 px-4">
          <div className="bg-white text-black p-6 rounded-xl shadow-lg w-full max-w-lg">
            <h2 className="text-xl font-bold mb-3">Leaving this site</h2>
            <p className="mb-3">
              You're about to visit an external site (which is safe, but uncontrolled).
            </p>
            <p>Do you want to continue?</p>
            <br />
            <p className="mb-5 break-words">
              Destination: <code className="bg-gray-200 px-1 rounded">{link}</code>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={confirmNavigation}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

function darkenColor(hex: string, percent: number) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * (percent * -100));
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 0 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

function getContrastYIQ(hex: string) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#ffffff";
}

export default IconButton;
