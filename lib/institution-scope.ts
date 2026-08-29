"use client";

import { useEffect, useState } from "react";
import { INSTITUTION_NAME as DEMO_INSTITUTION_NAME } from "@/lib/mock-data";

type SessionProfile = { name: string; title: string | null; institutionName: string | null };

// /api/auth/session zaten öğrenci/öğretmen panellerinin kendi id'lerini
// öğrenmek için mount başına bir kez çağrılıyor (bkz. lib/student-scope.ts,
// lib/teacher-scope.ts) — isim/unvan/kurum adı da aynı yanıtın parçası, bu
// yüzden modül seviyesinde tek bir promise'e önbelleklenir: aynı sayfada üst
// bar + Hero + bir yazdırma modalı aynı anda bu hook'ları kullansa bile TEK
// bir istek atılır.
let cachedProfile: SessionProfile | null = null;
let inflight: Promise<SessionProfile | null> | null = null;

function fetchProfile(): Promise<SessionProfile | null> {
  if (cachedProfile) return Promise.resolve(cachedProfile);
  if (!inflight) {
    inflight = fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        cachedProfile = { name: data.name ?? "", title: data.title ?? null, institutionName: data.institutionName ?? null };
        return cachedProfile;
      })
      .catch(() => null);
  }
  return inflight;
}

// Geri dönüş DEĞERİ olarak DEMO_INSTITUTION_NAME kullanılır — sadece
// session henüz çözülmeden geçen ilk anda (hydration/yükleme sırasında)
// boş yerine tanıdık bir isim göstermek için; gerçek kurum adı geldiği an
// üzerine yazılır. Eskiden TÜM panellerin üst barları lib/mock-data.ts'teki
// sabit "Arslan Dershaneleri" ismini gösteriyordu — yeni bir kurum için bu
// tamamen yanlış olurdu.
export function useInstitutionName(): string {
  const [name, setName] = useState(cachedProfile?.institutionName ?? DEMO_INSTITUTION_NAME);

  useEffect(() => {
    fetchProfile().then((profile) => {
      if (profile?.institutionName) setName(profile.institutionName);
    });
  }, []);

  return name;
}

// Öğrenci/Öğretmen Hero'larındaki isim (bkz. app/student/page.tsx,
// app/teacher/page.tsx) — AYNI kök nedenden dolayı gerekliydi: eskiden
// KOZMETİK rol-seçimi persona'sından ("Arslan"/"İrfan Hoca" demo adları)
// geliyordu. Gerçek bir öğrenci/öğretmen için bu yanlış olurdu — sadece
// tesadüfen demo hesaplarla test edilirken doğru görünüyordu.
export function useSessionName(fallback: string): string {
  const [name, setName] = useState(cachedProfile?.name ?? fallback);

  useEffect(() => {
    fetchProfile().then((data) => {
      if (data?.name) setName(data.name);
    });
  }, []);

  return name;
}

// Yönetici Paneli Hero'sundaki isim/unvan (bkz. app/principal/page.tsx) —
// eskiden localStorage'daki KOZMETİK rol-seçimi persona'sından ("Mert" demo
// adı) geliyordu, gerçek oturumla hiç bağlantısı yoktu. fallbackName/
// fallbackTitle sadece ilk yükleme anı için — gerçek değer geldiğinde
// üzerine yazılır.
export function useAdminProfile(fallbackName: string, fallbackTitle: string): { name: string; title: string } {
  const [profile, setProfile] = useState({ name: cachedProfile?.name ?? fallbackName, title: cachedProfile?.title ?? fallbackTitle });

  useEffect(() => {
    fetchProfile().then((data) => {
      if (data?.name) setProfile({ name: data.name, title: data.title ?? fallbackTitle });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return profile;
}

let cachedEtutAdminManaged: boolean | null = null;
let etutAdminManagedInflight: Promise<boolean> | null = null;

function fetchEtutAdminManaged(): Promise<boolean> {
  if (cachedEtutAdminManaged !== null) return Promise.resolve(cachedEtutAdminManaged);
  if (!etutAdminManagedInflight) {
    etutAdminManagedInflight = fetch("/api/admin/institution-settings")
      .then((res) => res.json())
      .then((data) => {
        cachedEtutAdminManaged = data.isEtutAdminManaged ?? true;
        return cachedEtutAdminManaged as boolean;
      })
      .catch(() => true);
  }
  return etutAdminManagedInflight;
}

// Etüt Yönetimi Merkezi (Kampüs V2 Part 2): InstitutionSettings.isEtutAdminManaged
// AÇIK olduğunda öğretmen/öğrenci panellerindeki bireysel etüt alma/verme
// akışları gizlenir — TÜM atama yönetici panelindeki "Etüt Yönetimi"
// ekranından yapılır (bkz. app/api/admin/etut-management). Varsayılan TRUE
// (şemadaki varsayılanla aynı) — henüz hiç ayarlanmamış bir kurumda bile
// bireysel butonlar YANLIŞLIKLA açık kalmasın diye.
export function useEtutAdminManaged(): boolean {
  const [managed, setManaged] = useState(cachedEtutAdminManaged ?? true);

  useEffect(() => {
    fetchEtutAdminManaged().then(setManaged);
  }, []);

  return managed;
}
