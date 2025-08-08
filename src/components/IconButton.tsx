import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type IconButtonProps = {
    icon: ReactNode;
    title: string;
    subtitle: string;
    color: string; // hex value, e.g. "#3b82f6"
    link: string;
};

const IconButton = ({ icon, title, subtitle, color, link }: IconButtonProps) => {
    const textColor = getContrastYIQ(color);

    return (
        <Link
            to={link}
            className={`flex items-center gap-4 p-5 rounded-2xl transition hover:scale-105`}
            style={{
                backgroundColor: color,
                color: textColor, // auto-adjust text colour
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
        </Link>
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
