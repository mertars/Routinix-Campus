"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

// Genel amaçlı 6 haneli (varsayılan) OTP pin-input — tek bir kontrollü string
// value/onChange sözleşmesiyle çalışır, tıpkı normal bir <input> gibi; bu
// yüzden çağıran taraf (örn. bir useReducer) tek bir string state'i
// yönetmeye devam eder, kutucuklara bölünmüş olması sadece görsel bir detaydır.
export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = false,
  disabled = false,
  ringClassName = "focus:border-indigo-400 focus:ring-indigo-400/30",
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  ringClassName?: string;
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function setDigit(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "").slice(-1);
    const next = digits.slice();
    next[index] = clean;
    onChange(next.join(""));
    if (clean && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const lastIndex = Math.min(pasted.length, length) - 1;
    inputRefs.current[Math.max(lastIndex, 0)]?.focus();
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoFocus={autoFocus && index === 0}
          disabled={disabled}
          value={digit}
          onChange={(e) => setDigit(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          className={cn(
            "h-12 w-10 rounded-xl border border-white/15 bg-white/5 text-center text-xl font-mono font-semibold text-white outline-none transition-all duration-150 focus:bg-white/10 focus:ring-2 disabled:opacity-40 sm:h-14 sm:w-12 sm:text-2xl",
            ringClassName
          )}
        />
      ))}
    </div>
  );
}
