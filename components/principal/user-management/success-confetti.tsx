"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

const COLORS = ["#D97706", "#15803D", "#5C3D2E", "#B45309", "#059669"];

// Harici bir konfeti kütüphanesi eklemeden, salt Framer Motion ile küçük
// renkli parçacıkları merkezden dışa doğru dağıtan hafif bir başarı efekti.
export function SuccessConfetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        angle: (i / 22) * Math.PI * 2,
        distance: 60 + Math.random() * 60,
        color: COLORS[i % COLORS.length],
        size: 5 + Math.random() * 4,
        delay: Math.random() * 0.15,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
          animate={{
            opacity: 0,
            x: Math.cos(piece.angle) * piece.distance,
            y: Math.sin(piece.angle) * piece.distance + 40,
            scale: 0.4,
            rotate: 180,
          }}
          transition={{ duration: 1.1, ease: "easeOut", delay: piece.delay }}
          className="absolute rounded-sm"
          style={{ width: piece.size, height: piece.size, backgroundColor: piece.color }}
        />
      ))}
    </div>
  );
}
