"use client";

import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface SessionExitDialogProps {
  open: boolean;
  onEndAndGoHome: () => void;
  onResume: () => void;
  onClose: () => void;
}

const actionButtonClassName =
  "h-11 cursor-pointer px-4 text-sm font-[family:var(--font-display)] font-bold tracking-[0.12em] uppercase transition-opacity hover:opacity-80 disabled:opacity-60";

export function SessionExitDialog({
  open,
  onEndAndGoHome,
  onResume,
  onClose,
}: SessionExitDialogProps) {
  const titleId = useId();
  const [step, setStep] = useState<"end" | "resume">("end");

  useEffect(() => {
    if (open) setStep("end");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const title = step === "end" ? "Leave this session?" : "Resume listening?";
  const message =
    step === "end"
      ? "Do you want to end this session and go back home?"
      : "Do you want to resume the session?";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-pointer"
            style={{ backgroundColor: "rgba(12, 13, 16, 0.55)" }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[380px] p-6"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Close dialog"
            >
              <X size={18} strokeWidth={2} />
            </button>

            <h2
              id={titleId}
              className="mb-1 pr-8 text-2xl font-[family:var(--font-display)] text-[var(--text-primary)]"
            >
              {title}
            </h2>
            <p className="mb-6 text-sm font-[family:var(--font-body)] text-[var(--text-secondary)]">
              {message}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              {step === "end" ? (
                <>
                  <button
                    type="button"
                    className={`${actionButtonClassName} flex-1 text-white`}
                    style={{ backgroundColor: "#B91C1C" }}
                    onClick={onEndAndGoHome}
                  >
                    Yes, go home
                  </button>
                  <button
                    type="button"
                    className={`${actionButtonClassName} flex-1 border border-[var(--border-subtle)] text-[var(--text-primary)]`}
                    style={{ backgroundColor: "var(--bg-primary)" }}
                    onClick={() => setStep("resume")}
                  >
                    No
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={`${actionButtonClassName} flex-1 text-white`}
                    style={{ backgroundColor: "var(--accent-red)" }}
                    onClick={() => {
                      onResume();
                      onClose();
                    }}
                  >
                    Yes, resume
                  </button>
                  <button
                    type="button"
                    className={`${actionButtonClassName} flex-1 border border-[var(--border-subtle)] text-[var(--text-primary)]`}
                    style={{ backgroundColor: "var(--bg-primary)" }}
                    onClick={onClose}
                  >
                    No, stay paused
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
