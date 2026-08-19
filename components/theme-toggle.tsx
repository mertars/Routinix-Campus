"use client";

import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label="Tema değiştir"
      className="relative flex h-9 w-16 items-center rounded-full border border-hairline bg-white/70 px-1 shadow-sm backdrop-blur-sm transition-colors dark:border-white/10 dark:bg-midnight-card/70"
    >
      <motion.div
        className="flex h-7 w-7 items-center justify-center rounded-full bg-espresso text-cream shadow-sm dark:bg-brand-600"
        animate={{ x: isDark ? 28 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </motion.div>
    </button>
  );
}
