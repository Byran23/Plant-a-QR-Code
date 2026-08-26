import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

  const toastTimer = useRef<number | undefined>(undefined);
  const copyTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), msg });
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  /* commit the input (debounced while typing) */
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

  /* leaving QR mode when the content changes keeps things honest */
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

  /* reflect state into the URL hash so a copied link restores everything */
  useEffect(() => {
    writeHash({ url: committed, season, leaf, ground: groundColor, salt } satisfies ShareState);
  }, [committed, season, leaf, groundColor, salt]);

  const onCopy = useCallback(() => {
    writeHash({ url: committed, season, leaf, ground: groundColor, salt });
    const done = () => {
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
      notify("Link copied — the tree travels with it");
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(window.location.href).then(done).catch(() => {
        notify("Copy was blocked — grab the URL from the address bar");
      });
    } else {
      notify("Copy is not available — grab the URL from the address bar");
    }
  }, [committed, season, leaf, groundColor, salt, notify]);

  const onDownload = useCallback(() => {
    downloadPng(activeGrid.text, palette.qrDark, palette.qrLight)
      .then(() => notify("Scannable QR image saved"))
      .catch(() => notify("Could not save the image"));
  }, [activeGrid, palette, notify]);

  const toggle = useCallback(() => setQr((v) => !v), []);

  /* spacebar flips the tree (when not typing) */
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
    <div className="relative h-full w-full overflow-hidden font-sans text-ink">
      {/* sky */}
      <div className="fixed inset-0 z-0">
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

      {/* giant outlined season word (behind the 3D scene) */}
      <Watermark label={palette.label} />

      {/* the living QR */}
      <Scene grid={activeGrid} palette={palette} seed={seed} qr={qr} onToggle={toggle} />

      {/* atmosphere finishers */}
      <div
        className="pointer-events-none fixed inset-0 z-20"
        style={{
          background:
            "radial-gradient(125% 95% at 50% 38%, transparent 58%, rgba(23,33,26,0.16) 100%)",
        }}
      />
      <div className="noise pointer-events-none fixed inset-0 z-20" />

      <Header />
      <ScannerOverlay show={qr} />
      <FooterBits />

      {/* bottom stack: hint + controls */}
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

      <Toast toast={toast} />
    </div>
  );
}
