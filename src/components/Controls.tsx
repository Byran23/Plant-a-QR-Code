import { useState } from "react";
import {
  ChevronUp,
  CloudRain,
  Copy,
  Download,
  ExternalLink,
  Flower2,
  Palette as PaletteIcon,
  QrCode,
  RotateCcw,
  RotateCw,
  Tag,
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
  isEditable: boolean;
  leafValue: string;
  groundValue: string;
  onEditable: (key: "leaf" | "ground", val: string) => void;
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
  customThemeLabel: string;
  onCustomThemeLabel: (v: string) => void;
}

const BANNER_COLOR_PRESETS = [
  "#e11d48", // Crimson Rose
  "#2563eb", // Royal Blue
  "#059669", // Emerald Green
  "#d97706", // Amber Gold
  "#7c3aed", // Vivid Purple
  "#0f172a", // Midnight Dark
];

const PETAL_COLOR_PRESETS = [
  "#ff9ebb", // Sakura Pink
  "#ff4d6d", // Deep Blossom
  "#3ec96f", // Summer Green
  "#f97a2b", // Autumn Tangerine
  "#e63946", // Ruby Rose
  "#ffffff", // Snow Petal
  "#c084fc", // Lavender
];

const GROUND_COLOR_PRESETS = [
  "#89c053", // Spring Meadow
  "#68b85d", // Deep Grass
  "#cfae62", // Autumn Gold
  "#f2f6fb", // Frost Snow
  "#ede7de", // Stone Patio
  "#529134", // Garden Green
  "#2b5233", // Dark Forest
];

export default function Controls({
  url,
  onUrl,
  onCommit,
  season,
  onSeason,
  rain,
  onToggleRain,
  isEditable,
  leafValue,
  groundValue,
  onEditable,
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
  customThemeLabel,
  onCustomThemeLabel,
}: ControlsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-2">
      {/* Floating Main Bar */}
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

      {/* Expanded Customization Drawer */}
      {open && (
        <div className="flex w-92 max-w-[94vw] max-h-[70vh] overflow-y-auto flex-col gap-3.5 rounded-3xl border border-rose-950/15 bg-white/95 p-4.5 shadow-[0_20px_45px_-10px_rgba(76,20,35,0.3)] backdrop-blur-2xl">
          {/* Target Link Input */}
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
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-800 shadow-inner focus:border-rose-400 focus:outline-none"
            />
          </div>

          {/* Helicopter Banner Customization */}
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
              placeholder="Banner Text..."
              maxLength={28}
              className="w-full rounded-xl border border-rose-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-rose-950 shadow-inner focus:border-rose-500 focus:outline-none"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] font-medium text-stone-500">Banner Color</span>
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
                  title="Editable Banner Color"
                />
              </div>
            </div>
          </div>

          {/* Season Presets */}
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
                    season === i && !isEditable
                      ? "bg-rose-950 text-rose-50 shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200/70"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Editable Theme & Colors Section */}
          <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <PaletteIcon className="h-3.5 w-3.5 text-stone-700" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700">
                  Editable Theme & Colors
                </span>
              </div>
              {isEditable && (
                <button
                  type="button"
                  onClick={onResetColors}
                  className="flex items-center gap-1 text-[10px] font-semibold text-rose-700 hover:text-rose-900"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset Colors</span>
                </button>
              )}
            </div>

            {/* Editable Theme Label Input */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <Tag className="h-3 w-3 text-stone-500" />
                <label className="text-[10px] font-semibold text-stone-600">
                  Custom Theme Label
                </label>
              </div>
              <input
                type="text"
                value={customThemeLabel}
                onChange={(e) => onCustomThemeLabel(e.target.value)}
                placeholder="Editable / Custom Theme Name..."
                maxLength={20}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 shadow-inner focus:border-rose-400 focus:outline-none"
              />
            </div>

            {/* Editable Petal / Blossom / Leaves Color */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-stone-200/60">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-stone-600">Petals & Leaves</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-stone-400">{leafValue}</span>
                  <input
                    type="color"
                    value={leafValue}
                    onChange={(e) => onEditable("leaf", e.target.value)}
                    className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
                    title="Choose Petal Color"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {PETAL_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onEditable("leaf", c)}
                    style={{ backgroundColor: c }}
                    className={`h-5 w-5 rounded-full border transition-all ${
                      leafValue.toLowerCase() === c.toLowerCase()
                        ? "scale-125 border-stone-900 shadow-sm ring-2 ring-rose-400/40"
                        : "border-stone-300 opacity-85 hover:scale-110"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Editable Ground / Lawn / Patio Color */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-stone-200/60">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-stone-600">Ground & Grass</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-stone-400">{groundValue}</span>
                  <input
                    type="color"
                    value={groundValue}
                    onChange={(e) => onEditable("ground", e.target.value)}
                    className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
                    title="Choose Ground Color"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {GROUND_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onEditable("ground", c)}
                    style={{ backgroundColor: c }}
                    className={`h-5 w-5 rounded-full border transition-all ${
                      groundValue.toLowerCase() === c.toLowerCase()
                        ? "scale-125 border-stone-900 shadow-sm ring-2 ring-rose-400/40"
                        : "border-stone-300 opacity-85 hover:scale-110"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}