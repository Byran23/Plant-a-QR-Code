import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Flower2, Lock, QrCode } from "lucide-react";
import Scene from "./three/Scene";
import Controls from "./components/Controls";
import PinLogin from "./components/PinLogin";
import { FooterBits, Header, Hint, Toast, Watermark } from "./components/Overlays";
import { buildGrid, downloadPng, readHash, writeHash, type ShareState } from "./lib/qr";
import { resolvePalette, SEASONS } from "./lib/palettes";
import { hashSeed } from "./lib/random";

const DEFAULT_URL = "https://sp-lis.launion.gov.ph/";

export default function App() {
  const boot = useMemo(readHash, []);
  const [url, setUrl] = useState(boot.url ?? DEFAULT_URL);
  const [committed, setCommitted] = useState(boot.url ?? DEFAULT_URL);
  const [season, setSeason] = useState(boot.season ?? 0);
  const [rain, setRain] = useState(false);
  const [leaf, setLeaf] = useState<string | null>(boot.leaf);
  const [groundColor, setGroundColor] = useState<string | null>(boot.ground);
  const [salt, setSalt] = useState(boot.salt);
  const [qr, setQr] = useState(false);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [bannerText, setBannerText] = useState("Bryan R. Cañaveral");
  const [bannerColor, setBannerColor] = useState("#e11d48");
  const [customThemeLabel, setCustomThemeLabel] = useState("Editable");

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

  useEffect(() => {
    setQr(false);
  }, [committed]);

  const seed = useMemo(
    () => (hashSeed(activeGrid.text) + salt * 7919) >>> 0,
    [activeGrid, salt],
  );
  const palette = useMemo(
    () => resolvePalette(season, leaf, groundColor, customThemeLabel),
    [season, leaf, groundColor, customThemeLabel],
  );

  useEffect(() => {
    if (!isMinimalView) {
      writeHash({ url: committed, season, leaf, ground: groundColor, salt } satisfies ShareState);
    }
  }, [committed, season, leaf, groundColor, salt, isMinimalView]);

  const onCopy = useCallback(() => {
    const params = new URLSearchParams();
    params.set("u", committed);
    if (season !== 0) params.set("s", String(season));
    if (leaf) params.set("lf", leaf.replace("#", ""));
    if (groundColor) params.set("gd", groundColor.replace("#", ""));
    if (salt) params.set("r", String(salt));
    params.set("v", "1");

    const shareUrl = `${window.location.origin}${window.location.pathname}#${params.toString()}`;

    const done = () => {
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
      notify("Share link copied — includes direct open link & minimal view");
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
  const toggleRain = useCallback(() => setRain((r) => !r), []);

  const handleOpenLink = useCallback(() => {
    let target = committed.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`;
    }
    window.open(target, "_blank", "noopener,noreferrer");
  }, [committed]);

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

  const isEditable = Boolean(leaf || groundColor);
  const baseSeason = SEASONS[((season % 4) + 4) % 4];

  return (
    <div className="relative h-full w-full overflow-hidden font-sans text-stone-900 select-none">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
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
          className="absolute left-1/2 top-[22%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-80 transition-all duration-1000"
          style={{ background: palette.sunGlow }}
        />
        <div
          className="absolute inset-0 transition-all duration-1000"
          style={{
            background: `radial-gradient(65% 55% at 50% 36%, ${palette.glow} 0%, transparent 80%)`,
          }}
        />

        <svg
          className="absolute inset-x-0 bottom-0 w-full h-[42vh] opacity-90 transition-all duration-1000"
          viewBox="0 0 1440 420"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0,260 L120,220 L280,270 L460,180 L620,240 L840,160 L1020,230 L1240,170 L1440,240 L1440,420 L0,420 Z"
            fill={palette.ridgeFar}
          />
          <path
            d="M0,320 Q320,240 640,300 T1440,280 L1440,420 L0,420 Z"
            fill={palette.ridgeNear}
          />
        </svg>
      </div>

      <Watermark label={palette.label} />
      <Scene
        grid={activeGrid}
        palette={palette}
        seed={seed}
        qr={qr}
        rain={rain}
        bannerText={bannerText}
        bannerColor={bannerColor}
        onToggle={toggle}
      />

      <div
        className="pointer-events-none fixed inset-0 z-20"
        style={{
          background: "radial-gradient(125% 95% at 50% 38%, transparent 58%, rgba(76,20,35,0.08) 100%)",
        }}
      />
      <div className="noise pointer-events-none fixed inset-0 z-20 opacity-25" />

      {/* PIN Security Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <PinLogin
            correctPin="0223"
            onSuccess={() => {
              setIsAuthenticated(true);
              setShowLoginModal(false);
              notify("Access granted — QR Controls unlocked");
            }}
          />
        )}
      </AnimatePresence>

      {isMinimalView ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-between p-6">
          <div />
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center gap-3"
          >
            <button
              onClick={toggle}
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-rose-950/20 bg-rose-950/90 px-5 py-3 text-rose-50 shadow-[0_16px_36px_-12px_rgba(76,20,35,0.5)] backdrop-blur-xl transition-all hover:scale-105 active:scale-95"
            >
              {qr ? (
                <>
                  <Flower2 className="h-4 w-4 text-rose-300" />
                  <span className="text-xs font-semibold">Bloom Sakura</span>
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 text-rose-300" />
                  <span className="text-xs font-semibold">Assemble QR</span>
                </>
              )}
            </button>

            <button
              onClick={handleOpenLink}
              title={`Open ${committed}`}
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-stone-300/80 bg-white/90 px-4 py-3 text-stone-800 shadow-md backdrop-blur-xl transition-all hover:scale-105 active:scale-95"
            >
              <ExternalLink className="h-4 w-4 text-rose-600" />
              <span className="text-xs font-semibold">Open Link</span>
            </button>
          </motion.div>
        </div>
      ) : (
        <>
          <Header />
          <FooterBits />

          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex flex-col items-center gap-3 sm:bottom-5">
            <Hint qr={qr} />

            {isAuthenticated ? (
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
                rain={rain}
                onToggleRain={toggleRain}
                isEditable={isEditable}
                leafValue={leaf ?? baseSeason.foliage[1]}
                groundValue={groundColor ?? baseSeason.grass[0]}
                onEditable={(key, v) => (key === "leaf" ? setLeaf(v) : setGroundColor(v))}
                onResetColors={() => {
                  setLeaf(null);
                  setGroundColor(null);
                  setCustomThemeLabel("Editable");
                }}
                onShuffle={() => setSalt((s) => s + 1)}
                onCopy={onCopy}
                copied={copied}
                onDownload={onDownload}
                qr={qr}
                onToggle={toggle}
                onOpenLink={handleOpenLink}
                gridLabel={`${activeGrid.size}×${activeGrid.size}`}
                bannerText={bannerText}
                onBannerText={setBannerText}
                bannerColor={bannerColor}
                onBannerColor={setBannerColor}
                customThemeLabel={customThemeLabel}
                onCustomThemeLabel={setCustomThemeLabel}
              />
            ) : (
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                onClick={() => setShowLoginModal(true)}
                className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-rose-950/20 bg-rose-950/90 px-6 py-3.5 text-rose-50 shadow-[0_16px_36px_-12px_rgba(76,20,35,0.5)] backdrop-blur-xl transition-all hover:scale-105 active:scale-95"
              >
                <Lock className="h-4 w-4 text-rose-300" />
                <span className="text-sm font-semibold tracking-wide">
                  Log in to Configure QR
                </span>
              </motion.button>
            )}
          </div>
        </>
      )}

      <Toast toast={toast} />
    </div>
  );
}