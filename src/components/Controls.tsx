import { motion } from "framer-motion";
import {
  Check,
  CloudRain,
  Copy,
  Dices,
  Download,
  ExternalLink,
  Flower2,
  Leaf,
  Link2,
  Moon,
  QrCode,
  RotateCcw,
  Snowflake,
  Sun,
  SunMedium,
} from "lucide-react";
import type { Weather } from "../lib/palettes";
import { cn } from "../utils/cn";

const SEASON_UI = [
  { label: "Sakura", icon: Flower2, tint: "hover:bg-rose-100/90" },
  { label: "Summer", icon: Sun, tint: "hover:bg-emerald-100/90" },
  { label: "Autumn", icon: Leaf, tint: "hover:bg-amber-100/90" },
  { label: "Winter", icon: Snowflake, tint: "hover:bg-sky-100/90" },
];

const WEATHER_UI: { id: Weather; label: string; icon: typeof SunMedium }[] = [
  { id: "day", label: "Day", icon: SunMedium },
  { id: "night", label: "Night", icon: Moon },
  { id: "rainy", label: "Rain", icon: CloudRain },
];

const iconBtn =
  "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-rose-950/10 bg-white/85 text-stone-700 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-white hover:text-stone-950 hover:shadow active:translate-y-0 active:scale-95";

export default function Controls({
  url,
  onUrl,
  onCommit,
  season,
  onSeason,
  weather,
  onWeather,
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
}: {
  url: string;
  onUrl: (v: string) => void;
  onCommit: () => void;
  season: number;
  onSeason: (i: number) => void;
  weather: Weather;
  onWeather: (w: Weather) => void;
  isCustom: boolean;
  leafValue: string;
  groundValue: string;
  onCustom: (key: "leaf" | "ground", v: string) => void;
  onResetColors: () => void;
  onShuffle: () => void;
  onCopy: () => void;
  copied: boolean;
  onDownload: () => void;
  qr: boolean;
  onToggle: () => void;
  onOpenLink?: () => void;
  gridLabel: string;
}) {
  return (
    <motion.div
      initial={{ y: 90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 120, damping: 17, delay: 0.35 }}
      className="pointer-events-auto w-[min(94vw,880px)] rounded-[26px] border border-rose-900/15 bg-white/70 p-3.5 shadow-[0_24px_60px_-18px_rgba(76,20,35,0.28)] backdrop-blur-2xl"
    >
      {/* row 1 — the link */}
      <div className="flex items-center gap-2">
        <div className="group relative flex-1">
          <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-rose-600" />
          <input
            value={url}
            onChange={(e) => onUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onCommit()}
            onBlur={onCommit}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="https://your-link.com"
            aria-label="Link to bloom"
            className="h-11 w-full rounded-full border border-stone-200/80 bg-white/80 pl-10 pr-24 font-sans text-sm text-stone-900 outline-none transition-all placeholder:text-stone-400 focus:border-rose-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(244,63,94,0.12)]"
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full bg-rose-950/[0.06] px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide text-rose-900/70">
            {gridLabel}
          </span>
        </div>

        {onOpenLink && (
          <button
            onClick={onOpenLink}
            className={iconBtn}
            title="Open link in new tab"
            aria-label="Open link"
          >
            <ExternalLink className="h-[17px] w-[17px] text-rose-600" />
          </button>
        )}

        <button
          onClick={onShuffle}
          className={iconBtn}
          title="Shuffle tree branch & blossom shapes"
          aria-label="Shuffle tree"
        >
          <Dices className="h-[18px] w-[18px]" />
        </button>

        <button
          onClick={onToggle}
          aria-label={qr ? "Bloom the sakura tree" : "Assemble the QR code"}
          className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-rose-950 text-rose-100 shadow-[0_10px_24px_-8px_rgba(76,20,35,0.5)] ring-1 ring-rose-400/20 transition-transform duration-150 hover:scale-105 active:scale-95"
        >
          <motion.span
            key={qr ? "flower" : "qr"}
            initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="grid place-items-center"
          >
            {qr ? <Flower2 className="h-5 w-5 text-rose-300" /> : <QrCode className="h-5 w-5" />}
          </motion.span>
        </button>
      </div>

      {/* row 2 — palettes, weather & actions */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-2">
        {/* Seasons */}
        <div className="flex items-center gap-1 rounded-full border border-stone-200/80 bg-white/70 p-1">
          {SEASON_UI.map((s, i) => (
            <button
              key={s.label}
              onClick={() => onSeason(i)}
              aria-label={`${s.label} palette`}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-stone-600 transition-all duration-150",
                s.tint,
                !isCustom && season === i && "bg-rose-950 text-rose-100 shadow-sm hover:bg-rose-950",
                isCustom && "opacity-80",
              )}
            >
              <s.icon className={cn("h-3.5 w-3.5", !isCustom && season === i ? "text-rose-300" : "")} />
              <span className="hidden md:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Weather Selector (Day / Night / Rain) */}
        <div className="flex items-center gap-1 rounded-full border border-stone-200/80 bg-white/70 p-1">
          {WEATHER_UI.map((w) => {
            const Icon = w.icon;
            const active = weather === w.id;
            return (
              <button
                key={w.id}
                onClick={() => onWeather(w.id)}
                aria-label={`${w.label} mode`}
                className={cn(
                  "flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-stone-600 transition-all duration-150 hover:bg-stone-100",
                  active && "bg-stone-800 text-stone-100 shadow-sm hover:bg-stone-800",
                )}
                title={`${w.label} mode`}
              >
                <Icon className={cn("h-3.5 w-3.5", active ? "text-amber-300" : "")} />
                <span className="hidden sm:inline">{w.label}</span>
              </button>
            );
          })}
        </div>

        {/* Custom Colors */}
        <div className="flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/70 px-3 py-1.5">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-stone-600">
            <input
              type="color"
              value={leafValue}
              onChange={(e) => onCustom("leaf", e.target.value)}
              aria-label="Petal colour"
              className="h-4 w-4 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
            Petals
          </label>
          <span className="h-4 w-px bg-stone-200" />
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-stone-600">
            <input
              type="color"
              value={groundValue}
              onChange={(e) => onCustom("ground", e.target.value)}
              aria-label="Patio / ground colour"
              className="h-4 w-4 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
            Patio
          </label>
          {isCustom && (
            <button
              onClick={onResetColors}
              className="grid h-5 w-5 place-items-center rounded-full text-stone-400 transition-colors hover:bg-rose-100 hover:text-rose-700"
              title="Reset to default season colors"
              aria-label="Reset colors"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Share & Download */}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onCopy} className={cn(iconBtn, "w-auto gap-2 px-3.5")} title="Copy shareable link">
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span className="hidden text-xs font-semibold sm:inline">
              {copied ? "Copied" : "Share"}
            </span>
          </button>
          <button onClick={onDownload} className={cn(iconBtn, "w-auto gap-2 px-3.5")} title="Download Sakura QR Code PNG">
            <Download className="h-4 w-4" />
            <span className="hidden text-xs font-semibold sm:inline">QR PNG</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}