"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type SessionProfile = { name: string; title: string | null; institutionName: string | null; institutionLogoUrl: string | null };

// ⚠️ SUNUCUDAN GELEN KİMLİK (2026-09-15, Mert'in bildirdiği hata).
// Bu hook'lar eskiden kimliği yalnızca /api/auth/session'dan, panel mount
// olduktan SONRA alıyordu; o 2-3 saniye boyunca ekranda lib/mock-data.ts'teki
// DEMO isimler duruyordu ("İrfan Hoca", "Arslan", "Arslan Dershaneleri") —
// yani her kullanıcı her açılışta BAŞKA BİRİNİN adını görüyordu. Artık kök
// layout kimliği sunucuda çözüp buraya veriyor (bkz. app/layout.tsx +
// lib/server/auth/session-profile.ts): doğru isim İLK BOYAMADA yerinde.
//
// Geri dönüş değerleri artık boş string — yanlış bir isim göstermektense
// hiç göstermemek doğrudur. Sağlayıcı yoksa (eski davranış) ağ isteği yine
// devreye girer, sadece bir tık geç dolar.
const ServerProfileContext = createContext<SessionProfile | null>(null);

export function SessionProfileProvider({ profile, children }: { profile: SessionProfile | null; children: ReactNode }) {
  // Modül önbelleğini de doldurur: aynı sayfadaki student-scope/teacher-scope
  // gibi diğer tüketiciler de ağ isteği atmadan aynı değeri görsün.
  if (profile && !cachedProfile) cachedProfile = profile;
  return <ServerProfileContext.Provider value={profile}>{children}</ServerProfileContext.Provider>;
}

function useServerProfile(): SessionProfile | null {
  return useContext(ServerProfileContext) ?? cachedProfile;
}

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
        cachedProfile = {
          name: data.name ?? "",
          title: data.title ?? null,
          institutionName: data.institutionName ?? null,
          institutionLogoUrl: data.institutionLogoUrl ?? null,
        };
        return cachedProfile;
      })
      .catch(() => null);
  }
  return inflight;
}

export function useInstitutionName(): string {
  const server = useServerProfile();
  const [name, setName] = useState(server?.institutionName ?? "");

  useEffect(() => {
    if (name) return;
    fetchProfile().then((profile) => {
      if (profile?.institutionName) setName(profile.institutionName);
    });
  }, [name]);

  return name;
}

// Üst barlardaki kurum rozetinde (bkz. principal/student/teacher top-bar.tsx)
// varsayılan Sparkles ikonunun yerine geçer — kurum bir logo yüklediyse
// (Institution.logoUrl, "Logoyu Güncelle" ekranı) rozet artık jenerik bir
// yıldız yerine kurumun KENDİ logosunu gösterir.
export function useInstitutionLogoUrl(): string | null {
  const server = useServerProfile();
  const [logoUrl, setLogoUrl] = useState(server?.institutionLogoUrl ?? null);

  useEffect(() => {
    if (logoUrl) return;
    fetchProfile().then((profile) => {
      if (profile?.institutionLogoUrl) setLogoUrl(profile.institutionLogoUrl);
    });
  }, [logoUrl]);

  return logoUrl;
}

// Öğrenci/Öğretmen Hero'larındaki isim (bkz. app/student/page.tsx,
// app/teacher/page.tsx) — AYNI kök nedenden dolayı gerekliydi: eskiden
// KOZMETİK rol-seçimi persona'sından ("Arslan"/"İrfan Hoca" demo adları)
// geliyordu. Gerçek bir öğrenci/öğretmen için bu yanlış olurdu — sadece
// tesadüfen demo hesaplarla test edilirken doğru görünüyordu.
export function useSessionName(): string {
  const server = useServerProfile();
  const [name, setName] = useState(server?.name ?? "");

  useEffect(() => {
    if (name) return;
    fetchProfile().then((data) => {
      if (data?.name) setName(data.name);
    });
  }, [name]);

  return name;
}

// Yönetici Paneli Hero'sundaki isim/unvan (bkz. app/principal/page.tsx) —
// eskiden localStorage'daki KOZMETİK rol-seçimi persona'sından ("Mert" demo
// adı) geliyordu, gerçek oturumla hiç bağlantısı yoktu. fallbackName/
// fallbackTitle sadece ilk yükleme anı için — gerçek değer geldiğinde
// üzerine yazılır.
export function useAdminProfile(fallbackTitle: string): { name: string; title: string } {
  const server = useServerProfile();
  const [profile, setProfile] = useState({ name: server?.name ?? "", title: server?.title ?? (server ? fallbackTitle : "") });

  useEffect(() => {
    if (profile.name) return;
    fetchProfile().then((data) => {
      if (data?.name) setProfile({ name: data.name, title: data.title ?? fallbackTitle });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.name]);

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
