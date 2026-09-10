import {
  LayoutDashboard,
  Users,
  Receipt,
  Landmark,
  FileSpreadsheet,
  Package,
  Users2,
  FileSignature,
  CalendarClock,
  Target,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

// ÖDEME MODÜLÜ SEKME KAYDI — ERP'dekiyle aynı gerekçe (bkz. lib/erp-tabs.ts):
// komut paleti bu sekmeleri de aratabilsin diye panel bileşeninden ayrıldı.
//
// Erişim kuralı burada DEĞİL: hangi rolün hangi sekmeyi görebildiği
// lib/payments/payment-roles.ts'te (canAccessTab). Palet de o kuralı
// uygular — yetkisiz bir sekme arama sonucunda görünmez.

export type PaymentTabId =
  | "dashboard"
  | "students"
  | "expenses"
  | "accounts"
  | "bank-import"
  | "products"
  | "payroll"
  | "contracts"
  | "renewals"
  | "budget"
  | "reports";

export type PaymentTab = {
  id: PaymentTabId;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
};

export const PAYMENT_TABS: PaymentTab[] = [
  { id: "dashboard", label: "Kontrol Paneli", icon: LayoutDashboard, keywords: ["özet", "tahsilat durumu"] },
  { id: "students", label: "Öğrenci Ödemeleri", icon: Users, keywords: ["taksit", "borç", "plan", "tahsilat"] },
  { id: "expenses", label: "Giderler", icon: Receipt, keywords: ["fatura", "kira", "masraf", "ödeme"] },
  { id: "accounts", label: "Kasa & Banka", icon: Landmark, keywords: ["hesap", "bakiye", "sayım", "virman"] },
  { id: "bank-import", label: "Banka Ekstresi", icon: FileSpreadsheet, keywords: ["havale", "eft", "eşleştirme", "içe aktar"] },
  { id: "products", label: "Ürün & Etkinlik", icon: Package, keywords: ["kitap", "kırtasiye", "gezi"] },
  { id: "payroll", label: "Bordro", icon: Users2, keywords: ["maaş", "personel", "avans"] },
  { id: "contracts", label: "Sözleşmeler", icon: FileSignature, keywords: ["imza", "şablon", "veli sözleşmesi"] },
  { id: "renewals", label: "Kayıt Yenileme", icon: CalendarClock, keywords: ["yenile", "dönem", "kayıt"] },
  { id: "budget", label: "Bütçe", icon: Target, keywords: ["hedef", "plan", "gider bütçesi"] },
  { id: "reports", label: "Raporlar", icon: BarChart3, keywords: ["rapor", "analiz", "gelir gider"] },
];
