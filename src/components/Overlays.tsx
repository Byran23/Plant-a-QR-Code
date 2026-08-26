import { AnimatePresence, motion } from "framer-motion";
import { Check, Flower2, MousePointerClick, ScanLine, ShieldCheck } from "lucide-react";

/* ---------------------------------------------------------------- */

export function Header() {
  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 110, damping: 16, delay: 0.1 }}
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between p-5 sm:p-6"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-950 text-rose-200 shadow-[0_12px_28px_-10px_rgba(76,20,35,0.45)] ring-1 ring-rose-300/30">
          <Flower2 className="h-5 w-5 text-rose-300" />
        </div>
        <div>
          <h1 className="font-display text-[22px] font-semibold leading-none tracking-tight text-stone-900">
            SakuraQR
          </h1>
          <p className="mt-1 font-sans text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
            plant a link · bloom a code
          </p>
        </div>
      </div>

      <div className="hidden items-center gap-2 rounded-full border border-rose-900/10 bg-white/70 px-3.5 py-2 shadow-sm backdrop-blur-xl sm:flex">
        <ShieldCheck className="h-3.5 w-3.5 text-rose-600" />
        <span className="text-[11px] font-semibold text-stone-700">
          100% client-side — your link never leaves this tab
        </span>
      </div>
    </motion.header>
  );
}

/* ---------------------------------------------------------------- */

export function Watermark({ label }: { label: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[5] flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="sync">
        <motion.span
          key={label}
          initial={{ opacity: 0, y: 60, rotate: 1.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          exit={{ opacity: 0, y: -60, rotate: -1.5 }}
          transition={{ type: "spring", stiffness: 60, damping: 16 }}
          className="watermark select-none whitespace-nowrap font-display text-[19vw] font-black uppercase leading-none text-rose-950/[0.04]"
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------- */

export function Hint({ qr }: { qr: boolean }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={qr ? "back" : "reveal"}
        initial={{ opacity: 0, y: 14, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="flex items-center gap-2.5 rounded-full border border-rose-950/15 bg-rose-950/90 px-5 py-2.5 text-rose-50 shadow-[0_16px_36px_-12px_rgba(76,20,35,0.45)] backdrop-blur-xl"
      >
        <motion.span
          animate={{ scale: [1, 0.82, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="grid place-items-center"
        >
          {qr ? (
            <Flower2 className="h-4 w-4 text-rose-300" />
          ) : (
            <MousePointerClick className="h-4 w-4 text-rose-300" />
          )}
        </motion.span>
        <span className="text-[13px] font-medium tracking-tight">
          {qr ? "Tap again to bloom your tree" : "Tap the tree — blossoms settle into the QR code"}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

/* ---------------------------------------------------------------- */

export function ScannerOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="pointer-events-none fixed inset-0 z-30 flex flex-col items-center justify-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-7 flex items-center gap-2 rounded-full border border-rose-950/20 bg-rose-950/90 px-4.5 py-2 text-rose-50 shadow-lg backdrop-blur"
          >
            <ScanLine className="h-3.5 w-3.5 text-rose-300" />
            <span className="text-xs font-medium">The petals formed the code — ready to scan</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------------------------------------------------------- */

export function Toast({ toast }: { toast: { id: number; msg: string } | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 240, damping: 20 }}
            className="flex items-center gap-2 rounded-full border border-rose-800/30 bg-rose-950 px-4.5 py-2.5 text-rose-50 shadow-[0_18px_40px_-12px_rgba(76,20,35,0.5)]"
            style={{ paddingLeft: 16, paddingRight: 18 }}
          >
            <Check className="h-4 w-4 text-rose-300" />
            <span className="text-[13px] font-medium">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------- */

export function FooterBits() {
  return (
    <>
      <p className="pointer-events-none fixed bottom-4 left-5 z-30 hidden text-[11px] font-medium text-stone-500/80 lg:block">
        every link blooms its own tree
      </p>
      <p className="pointer-events-none fixed bottom-4 right-5 z-30 hidden text-[11px] font-medium text-stone-500/80 lg:block">
        drag to orbit · scroll to zoom · space to flip
      </p>
    </>
  );
}