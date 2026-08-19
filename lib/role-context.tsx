"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { MOCK_PERSONAS, type Persona, type RoleId } from "./mock-data";

type RoleContextValue = {
  role: RoleId | null;
  persona: Persona | null;
  selectRole: (role: RoleId) => void;
  clearRole: () => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

const STORAGE_KEY = "routinix-kampus-role";

// localStorage istemci-taraflıdır, middleware.ts (sunucu tarafında çalışır)
// onu OKUYAMAZ — bu yüzden aynı değer aynı isimde bir cookie'ye de yazılır.
// ⚠️ Bu, gerçek bir oturum/kimlik doğrulama DEĞİLDİR — sadece "kazara" rol
// çakışmasını (örn. öğrenci linki bulup /principal'a girmesi) engeller.
// Cookie tarayıcıdan elle değiştirilebilir; gerçek güvenlik için şifre
// doğrulamalı bir login akışı ve sunucu tarafı oturum gerekir.
function setRoleCookie(role: RoleId) {
  document.cookie = `${STORAGE_KEY}=${role}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}
function clearRoleCookie() {
  document.cookie = `${STORAGE_KEY}=; path=/; max-age=0`;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<RoleId | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as RoleId | null;
    if (stored) {
      setRole(stored);
      setRoleCookie(stored);
    }
  }, []);

  function selectRole(next: RoleId) {
    setRole(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    setRoleCookie(next);
  }

  function clearRole() {
    setRole(null);
    window.localStorage.removeItem(STORAGE_KEY);
    clearRoleCookie();
  }

  const persona = MOCK_PERSONAS.find((p) => p.id === role) ?? null;

  return (
    <RoleContext.Provider value={{ role, persona, selectRole, clearRole }}>{children}</RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole, RoleProvider içinde kullanılmalı");
  return ctx;
}
