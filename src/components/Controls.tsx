import { motion } from "framer-motion";
import {
  Check,
  Copy,
  Dices,
  Download,
  Flower2,
  Leaf,
  Link2,
  QrCode,
  RotateCcw,
  Snowflake,
  Sprout,
  Sun,
} from "lucide-react";
import { cn } from "../utils/cn";

const SEASON_UI = [
  { label: "Spring", icon: Flower2, tint: "hover:bg-pink-100/80" },
  { label: "Summer", icon: Sun, tint: "hover:bg-emerald-100/80" },
  { label: "Autumn", icon: Leaf, tint: "hover:bg-orange-100/80" },
  { label: "Winter", icon: Snowflake, tint: "hover:bg-sky-100/80" },
];

const iconBtn =
  "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/10 bg-white/80 text-ink/75 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-white hover:text-ink active:translate-y-0 active:scale-95";

export default function Controls({
  url,
  onUrl,
  onCommit,
  season,
  onSeason,
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
  gridLabel,
}: {
  url: string;
  onUrl: (v: string) => void;
  onCommit: () => void;
  season: number;
  onSeason: (i: number) => void;
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
  gridLabel: string;
}) {
  return (
    <motion.div
      initial={{ y: 90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 120, damping: 17, delay: 0.35 }}
      className="pointer-events-auto w-[min(94vw,840px)] rounded-[26px] border border-ink/10 bg-white/65 p-3 shadow-[0_24px_60px_-18px_rgba(23,33,26,0.35)] backdrop-blur-2xl"
    >
      {/* row 1 — the link */}
      <div className="flex items-center gap-2">
        <div className="group relative flex-1">
          <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40 transition-colors group-focus-within:text-ink" />
          <input
            value={url}
            onChange={(e) => onUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onCommit()}
            onBlur={onCommit}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="https://your-link.com"
            aria-label="Link to grow"
            className="h-11 w-full rounded-full border border-ink/10 bg-white/80 pl-10 pr-24 font-sans text-sm text-ink outline-none transition-all placeholder:text-ink/35 focus:border-ink/30 focus:bg-white focus:shadow-[0_0_0_4px_rgba(23,33,26,0.07)]"
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full bg-ink/[0.06] px-2 py-0.5 font-mono text-[10px] tracking-wide text-ink/55">
            {gridLabel}
          </span>
        </div>

        <button
          onClick={onShuffle}
          className={iconBtn}
          title="Shuffle the tree (same link, new shape)"
          aria-label="Shuffle tree"
        >
          <Dices className="h-[18px] w-[18px]" />
        </button>

        <button
          onClick={onToggle}
          aria-label={qr ? "Regrow the tree" : "Reveal the QR code"}
          className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-ink text-cream shadow-[0_10px_24px_-8px_rgba(23,33,26,0.6)] transition-transform duration-150 hover:scale-105 active:scale-95"
        >
          <motion.span
            key={qr ? "sprout" : "qr"}
            initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="grid place-items-center"
          >
            {qr ? <Sprout className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
          </motion.span>
        </button>
      </div>

      {/* row 2 — look & share */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-2">
        <div className="flex items-center gap-1 rounded-full border border-ink/10 bg-white/60 p-1">
          {SEASON_UI.map((s, i) => (
            <button
              key={s.label}
              onClick={() => onSeason(i)}
              aria-label={`${s.label} palette`}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-ink/60 transition-all duration-150",
                s.tint,
                !isCustom && season === i && "bg-ink text-cream shadow-sm hover:bg-ink",
                isCustom && "opacity-80",
              )}
            >
              <s.icon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-full border border-ink/10 bg-white/60 px-3 py-1.5">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-ink/60">
            <input
              type="color"
              value={leafValue}
              onChange={(e) => onCustom("leaf", e.target.value)}
              aria-label="Foliage colour"
            />
            Foliage
          </label>
          <span className="h-4 w-px bg-ink/10" />
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-ink/60">
            <input
              type="color"
              value={groundValue}
              onChange={(e) => onCustom("ground", e.target.value)}
              aria-label="Ground colour"
            />
            Ground
          </label>
          {isCustom && (
            <button
              onClick={onResetColors}
              className="grid h-5 w-5 place-items-center rounded-full text-ink/50 transition-colors hover:bg-ink/10 hover:text-ink"
              title="Back to season colours"
              aria-label="Reset colours"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>

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
          <button onClick={onDownload} className={cn(iconBtn, "w-auto gap-2 px-3.5")} title="Download scannable QR PNG">
            <Download className="h-4 w-4" />
            <span className="hidden text-xs font-semibold sm:inline">QR PNG</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
