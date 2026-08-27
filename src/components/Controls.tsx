import { useState } from "react";
import {
  ChevronUp,
  CloudRain,
  Copy,
  Download,
  ExternalLink,
  Flower2,
  QrCode,
  RotateCw,
  Type,
} from "lucide-react";

interface ControlsProps {
  url: string;
  onUrl: (v: string) => void;
  onCommit: () => void;
  season: number;
  onSeason: (i: number) => void;
  rain: boolean;
  onToggleRain: () => void;
  isCustom: boolean;
  leafValue: string;
  groundValue: string;
  onCustom: (key: "leaf" | "ground", val: string) => void;
  onResetColors: () => void;
  onShuffle: () => void;
  onCopy: () => void;
  copied: boolean;
  onDownload: () => void;
  qr: boolean;
  onToggle: () => void;
  onOpenLink: () => void;
  gridLabel: string;
  bannerText: string;
  onBannerText: (v: string) => void;
  bannerColor: string;
  onBannerColor: (v: string) => void;
}

const BANNER_COLOR_PRESETS = [
  "#e11d48", // Crimson Rose
  "#2563eb", // Royal Blue
  "#059669", // Emerald Green
  "#d97706", // Amber Gold
  "#7c3aed", // Vivid Purple
  "#0f172a", // Midnight Dark
];

export default function Controls({
  url,
  onUrl,
  onCommit,
  season,
  onSeason,
  rain,
  onToggleRain,
  isCustom,
  leafValue,
  groundValue,
  onCustom,
  onResetColors,
  onShuffle,
  onCopy,
  copied,
  onDownload,
  qr,
  onToggle,
  onOpenLink,
  gridLabel,
  bannerText,
  onBannerText,
  bannerColor,
  onBannerColor,
}: ControlsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 rounded-full border border-rose-950/15 bg-white/85 p-2 shadow-[0_16px_36px_-12px_rgba(76,20,35,0.25)] backdrop-blur-2xl">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 rounded-full bg-rose-950 px-4.5 py-2.5 text-xs font-semibold text-rose-50 shadow-sm transition hover:bg-rose-900 active:scale-95"
        >
          {qr ? (
            <>
              <Flower2 className="h-4 w-4 text-rose-300" />
              <span>Bloom Tree</span>
            </>
          ) : (
            <>
              <QrCode className="h-4 w-4 text-rose-300" />
              <span>Flat QR</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleRain}
          className={`grid h-10 w-10 place-items-center rounded-full border transition active:scale-95 ${
            rain
              ? "border-sky-300 bg-sky-100 text-sky-700 shadow-inner"
              : "border-stone-200/80 bg-white/70 text-stone-700 hover:bg-stone-50"
          }`}
          title="Toggle Rain"
        >
          <CloudRain className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onShuffle}
          className="grid h-10 w-10 place-items-center rounded-full border border-stone-200/80 bg-white/70 text-stone-700 transition hover:bg-stone-50 active:scale-95"
          title="Regrow variation"
        >
          <RotateCw className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onOpenLink}
          className="grid h-10 w-10 place-items-center rounded-full border border-stone-200/80 bg-white/70 text-stone-700 transition hover:bg-stone-50 active:scale-95"
          title="Open target URL"
        >
          <ExternalLink className="h-4 w-4 text-rose-600" />
        </button>

        <button
          type="button"
          onClick={onCopy}
          className="grid h-10 w-10 place-items-center rounded-full border border-stone-200/80 bg-white/70 text-stone-700 transition hover:bg-stone-50 active:scale-95"
          title="Share link"
        >
          <Copy className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onDownload}
          className="grid h-10 w-10 place-items-center rounded-full border border-stone-200/80 bg-white/70 text-stone-700 transition hover:bg-stone-50 active:scale-95"
          title="Download PNG QR"
        >
          <Download className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition ${
            open
              ? "bg-rose-100 text-rose-950"
              : "bg-stone-100 text-stone-700 hover:bg-stone-200/80"
          }`}
        >
          <span>Settings</span>
          <ChevronUp
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {open && (
        <div className="flex w-88 max-w-[92vw] flex-col gap-3.5 rounded-3xl border border-rose-950/15 bg-white/90 p-4 shadow-[0_20px_45px_-10px_rgba(76,20,35,0.3)] backdrop-blur-2xl">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              QR Target Link ({gridLabel})
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => onUrl(e.target.value)}
              onBlur={onCommit}
              onKeyDown={(e) => e.key === "Enter" && onCommit()}
              placeholder="https://..."
              className="w-full rounded-xl border border-stone-200 bg-white/90 px-3 py-2 text-xs font-medium text-stone-800 shadow-inner focus:border-rose-400 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-rose-900/10 bg-rose-50/50 p-3">
            <div className="flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5 text-rose-700" />
              <label className="text-[10px] font-bold uppercase tracking-wider text-rose-950">
                Helicopter Sky Banner
              </label>
            </div>

            <input
              type="text"
              value={bannerText}
              onChange={(e) => onBannerText(e.target.value)}
              placeholder="Custom Banner Text..."
              maxLength={28}
              className="w-full rounded-xl border border-rose-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-rose-950 shadow-inner focus:border-rose-500 focus:outline-none"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] font-medium text-stone-500">Color</span>
              <div className="flex items-center gap-1.5">
                {BANNER_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onBannerColor(color)}
                    style={{ backgroundColor: color }}
                    className={`h-5 w-5 rounded-full border transition-all ${
                      bannerColor === color
                        ? "scale-125 border-stone-900 shadow-sm ring-2 ring-rose-400/40"
                        : "border-white/80 opacity-85 hover:scale-110"
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={bannerColor}
                  onChange={(e) => onBannerColor(e.target.value)}
                  className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  title="Custom Banner Color"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Season
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {["Sakura", "Summer", "Autumn", "Winter"].map((name, i) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onSeason(i)}
                  className={`rounded-xl py-1.5 text-xs font-semibold transition ${
                    season === i
                      ? "bg-rose-950 text-rose-50 shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200/70"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}