"use client";

import { cn } from "@/lib/utils";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return initials.join("") || "?";
}

export function AvatarInitials({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-600/15 font-semibold text-brand-700 dark:bg-brand-600/25 dark:text-brand-300",
        className
      )}
    >
      {getInitials(name)}
    </span>
  );
}
