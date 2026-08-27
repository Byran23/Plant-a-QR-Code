import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, Delete, KeyRound, ShieldAlert } from "lucide-react";

interface PinLoginProps {
  onSuccess: () => void;
  correctPin?: string;
}

export default function PinLogin({
  onSuccess,
  correctPin = "0223",
}: PinLoginProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pin.length === correctPin.length) {
      if (pin === correctPin) {
        onSuccess();
      } else {
        setError(true);
        const timer = setTimeout(() => {
          setPin("");
          setError(false);
        }, 650);
        return () => clearTimeout(timer);
      }
    }
  }, [pin, correctPin, onSuccess]);

  // Physical keyboard listener for desktop users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key) && pin.length < correctPin.length) {
        setPin((prev) => prev + e.key);
      } else if (e.key === "Backspace") {
        setPin((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin, correctPin]);

  const handleDigit = (digit: string) => {
    if (pin.length < correctPin.length) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xl">
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.9, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 15 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-rose-950/15 bg-white/85 p-6 shadow-[0_24px_50px_-12px_rgba(76,20,35,0.35)] backdrop-blur-2xl"
      >
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-950 text-rose-200 shadow-md ring-1 ring-rose-300/30">
            {error ? (
              <ShieldAlert className="h-6 w-6 text-rose-400" />
            ) : (
              <Lock className="h-6 w-6 text-rose-300" />
            )}
          </div>
          <h2 className="mt-4 font-display text-xl font-bold tracking-tight text-stone-900">
            Enter Security PIN
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Authorized access required to customize this QR code
          </p>
        </div>

        {/* PIN Dots Indicator */}
        <motion.div
          animate={error ? { x: [-12, 12, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.45 }}
          className="my-6 flex justify-center gap-4"
        >
          {Array.from({ length: correctPin.length }).map((_, i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-all duration-200 ${
                i < pin.length
                  ? error
                    ? "border-rose-600 bg-rose-600 scale-110"
                    : "border-rose-950 bg-rose-950 scale-110"
                  : "border-stone-300 bg-transparent"
              }`}
            />
          ))}
        </motion.div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="flex h-13 items-center justify-center rounded-2xl border border-stone-200/80 bg-white/80 text-lg font-semibold text-stone-800 shadow-sm transition-all hover:bg-stone-50 hover:scale-[1.02] active:scale-95 active:bg-stone-100"
            >
              {num}
            </button>
          ))}

          {/* Quick Info / Key Hint */}
          <div className="flex h-13 items-center justify-center rounded-2xl text-stone-400">
            <KeyRound className="h-5 w-5" />
          </div>

          {/* 0 */}
          <button
            type="button"
            onClick={() => handleDigit("0")}
            className="flex h-13 items-center justify-center rounded-2xl border border-stone-200/80 bg-white/80 text-lg font-semibold text-stone-800 shadow-sm transition-all hover:bg-stone-50 hover:scale-[1.02] active:scale-95 active:bg-stone-100"
          >
            0
          </button>

          {/* Backspace */}
          <button
            type="button"
            onClick={handleBackspace}
            className="flex h-13 items-center justify-center rounded-2xl border border-stone-200/80 bg-white/80 text-stone-600 shadow-sm transition-all hover:bg-stone-50 hover:scale-[1.02] active:scale-95 active:bg-stone-100"
            title="Backspace"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}