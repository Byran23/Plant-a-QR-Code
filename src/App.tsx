import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flower2, QrCode } from "lucide-react";
import Scene from "./three/Scene";
import Controls from "./components/Controls";
import { FooterBits, Header, Hint, ScannerOverlay, Toast, Watermark } from "./components/Overlays";
import { buildGrid, downloadPng, readHash, writeHash, type ShareState } from "./lib/qr";
import { resolvePalette, SEASONS } from "./lib/palettes";
import { hashSeed } from "./lib/random";

const DEFAULT_URL = "https://wikipedia.org";

export default function App() {
  const boot = useMemo(readHash, []);
  const [url, setUrl] = useState(boot.url ?? DEFAULT_URL);
  const [committed, setCommitted] = useState(boot.url ?? DEFAULT_URL);
  const [season, setSeason] = useState(boot.season ?? 0);
  const [leaf, setLeaf] = useState<string | null>(boot.leaf);
  const [groundColor, setGroundColor] = useState<string | null>(boot.ground);
  const [salt, setSalt] = useState(boot.salt);
  const [qr, setQr] = useState(false);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Minimal viewer mode when shared (hides menus/headers, shows only tree & tap button)
  const isMinimalView = useMemo(() => {
    if (typeof window === "undefined") return false;
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return search.get("v") === "1" || hash.get("v") === "1";
  }, []);

  const toastTimer = useRef<number | undefined>(undefined);
  const copyTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), msg });
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  /* commit input (debounced while typing) */
  useEffect(() => {
    const t = window.setTimeout(() => {
      const v = url.trim();
      if (v && v !== committed) setCommitted(v);
    }, 480);
    return () => window.clearTimeout(t);
  }, [url, committed]);

  const grid = useMemo(() => {
    try {
      return buildGrid(committed);
    } catch {
      return null;
    }
  }, [committed]);
  const fallback = useMemo(() => buildGrid(DEFAULT_URL), []);
  useEffect(() => {
    if (!grid) notify("That link is too long to grow — try something shorter");
  }, [grid, notify]);
  const activeGrid = grid ?? fallback;

  /* resetting QR mode when URL content changes */
  useEffect(() => {
    setQr(false);
  }, [committed]);

  const seed = useMemo(
    () => (hashSeed(activeGrid.text) + salt * 7919) >>> 0,
    [activeGrid, salt],
  );
  const palette = useMemo(
    () => resolvePalette(season, leaf, groundColor),
    [season, leaf, groundColor],
  );

  /* sync hash state */
  useEffect(() => {
    if (!isMinimalView) {
      writeHash({ url: committed, season, leaf, ground: groundColor, salt } satisfies ShareState);
    }
  }, [committed, season, leaf, groundColor, salt, isMinimalView]);

  /* generate clean minimalist share link */
  const onCopy = useCallback(() => {
    const params = new URLSearchParams();
    params.set("u", committed);
    if (season !== 0) params.set("s", String(season));
    if (leaf) params.set("lf", leaf.replace("#", ""));
    if (groundColor) params.set("gd", groundColor.replace("#", ""));
    if (salt) params.set("r", String(salt));
    params.set("v", "1"); // activate minimal view mode for recipients

    const shareUrl = `${window.location.origin}${window.location.pathname}#${params.toString()}`;

    const done = () => {
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
      notify("Share link copied — shows just the blooming tree & QR");
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl).then(done).catch(() => {
        notify("Copy was blocked — grab the URL from address bar");
      });
    } else {
      notify("Copy not available — grab URL from address bar");
    }
  }, [committed, season, leaf, groundColor, salt, notify]);

  const onDownload = useCallback(() => {
    downloadPng(activeGrid.text, palette.qrDark, palette.qrLight)
      .then(() => notify("Scannable QR image saved"))
      .catch(() => notify("Could not save the image"));
  }, [activeGrid, palette, notify]);

  const toggle = useCallback(() => setQr((v) => !v), []);

  /* spacebar flips the tree */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      setQr((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isCustom = !!(leaf || groundColor);
  const baseSeason = SEASONS[((season % 4) + 4) % 4];

  return (
    <div className="relative h-full w-full overflow-hidden font-sans text-stone-900 select-none">
      {/* Dynamic atmospheric background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <AnimatePresence>
          <motion.div
            key={palette.baseId + palette.sky[0]}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${palette.sky[0]} 0%, ${palette.sky[1]} 100%)`,
            }}
          />
        </AnimatePresence>
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(55% 42% at 50% 32%, ${palette.glow} 0%, transparent 70%)`,
            transition: "background 900ms ease-in-out",
          }}
        />
      </div>

      {/* Season watermark */}
      <Watermark label={palette.label} />

      {/* 3D Scene */}
      <Scene grid={activeGrid} palette={palette} seed={seed} qr={qr} onToggle={toggle} />

      {/* Vignette overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-20"
        style={{
          background: "radial-gradient(125% 95% at 50% 38%, transparent 58%, rgba(76,20,35,0.08) 100%)",
        }}
      />
      <div className="noise pointer-events-none fixed inset-0 z-20 opacity-30" />

      {/* Scanner viewfinder overlay */}
      <ScannerOverlay show={qr} />

      {isMinimalView ? (
        /* Minimal Shared Presentation Mode: Just Floating Flip Button */
        <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-between p-6">
          <div />
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={toggle}
            className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-rose-950/20 bg-rose-950/90 px-6 py-3 text-rose-50 shadow-[0_16px_36px_-12px_rgba(76,20,35,0.5)] backdrop-blur-xl transition-all hover:scale-105 active:scale-95"
          >
            {qr ? (
              <>
                <Flower2 className="h-4 w-4 text-rose-300" />
                <span className="text-xs font-semibold">Bloom Sakura Tree</span>
              </>
            ) : (
              <>
                <QrCode className="h-4 w-4 text-rose-300" />
                <span className="text-xs font-semibold">Scan QR Code</span>
              </>
            )}
          </motion.button>
        </div>
      ) : (
        /* Full Studio Mode */
        <>
          <Header />
          <FooterBits />

          {/* Bottom stack: Hint + Controls */}
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex flex-col items-center gap-3 sm:bottom-5">
            <Hint qr={qr} />
            <Controls
              url={url}
              onUrl={setUrl}
              onCommit={() => {
                const v = url.trim();
                if (v && v !== committed) setCommitted(v);
              }}
              season={season}
              onSeason={(i) => {
                setSeason(i);
                setLeaf(null);
                setGroundColor(null);
              }}
              isCustom={isCustom}
              leafValue={leaf ?? baseSeason.foliage[1]}
              groundValue={groundColor ?? baseSeason.grass[0]}
              onCustom={(key, v) => (key === "leaf" ? setLeaf(v) : setGroundColor(v))}
              onResetColors={() => {
                setLeaf(null);
                setGroundColor(null);
              }}
              onShuffle={() => setSalt((s) => s + 1)}
              onCopy={onCopy}
              copied={copied}
              onDownload={onDownload}
              qr={qr}
              onToggle={toggle}
              gridLabel={`${activeGrid.size}×${activeGrid.size}`}
            />
          </div>
        </>
      )}

      <Toast toast={toast} />
    </div>
  );
}