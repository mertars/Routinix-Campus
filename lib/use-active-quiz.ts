"use client";

import { useCallback, useEffect, useState } from "react";

export type ActiveQuizQuestion = { id: string; imageLabel: string };
export type ActiveQuiz = {
  id: string;
  name: string;
  branchId: string;
  durationSeconds: number;
  launchedAt: string;
  questions: ActiveQuizQuestion[];
};

// Öğrenci tarafında canlı Pop-Quiz'i yoklamak için paylaşılan polling hook'u
// — hem Ana Sayfa banner'ı hem Pop-Quiz sekmesi aynı bilgiye ihtiyaç duyuyor.
// LiveSync'in localStorage 'storage' event'iyle sağladığı anlık senkronizasyon
// yerine, gerçek Postgres'ten periyodik yoklama (polling) kullanır.
export function useActiveQuiz(branchId: string, studentId: string, pollMs = 3000) {
  const [quiz, setQuiz] = useState<ActiveQuiz | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchOnce = useCallback(async () => {
    if (!branchId) return;
    try {
      const res = await fetch(`/api/quizzes/active?branchId=${encodeURIComponent(branchId)}&studentId=${encodeURIComponent(studentId)}`);
      const data = await res.json();
      setQuiz(data.quiz ?? null);
      setAlreadySubmitted(!!data.alreadySubmitted);
    } catch {
      // sessiz — bir sonraki poll'da tekrar denenir
    } finally {
      setLoading(false);
    }
  }, [branchId, studentId]);

  useEffect(() => {
    fetchOnce();
    const interval = setInterval(fetchOnce, pollMs);
    return () => clearInterval(interval);
  }, [fetchOnce, pollMs]);

  return { quiz, alreadySubmitted, loading, refetch: fetchOnce };
}
