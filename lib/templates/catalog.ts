// HAZIR şablonlar.
//
// Veritabanında değil burada dururlar (gerekçe: prisma/schema.prisma >
// Template). Kurum bunları silemez ama uygulayıp üstünde oynayabilir ve
// "kendi şablonum olarak kaydet" diyebilir — o an kuruma ait yeni bir
// Template satırı doğar.
//
// Metinlerdeki {{...}} yer tutucuları uygulanırken doldurulur
// (bkz. fillPlaceholders). Doldurulamayan bir yer tutucu SİLİNMEZ,
// olduğu gibi bırakılır: müdür "{{tarih}}" görüp elle yazar, sessizce
// boş kalmış bir cümleyle duyuru yayınlamaktansa.

export type TemplateModule =
  | "ANNOUNCEMENT"
  | "INSTALLMENT_PLAN"
  | "EXPENSE"
  | "GUIDANCE_NOTE"
  | "HOMEWORK"
  | "SCHEDULE"
  | "MESSAGE";

export type BuiltInTemplate = {
  /** Kurum şablonlarıyla çakışmaması için "hazir:" önekli. */
  id: string;
  module: TemplateModule;
  name: string;
  description: string;
  payload: Record<string, unknown>;
};

export const TEMPLATE_MODULE_LABEL: Record<TemplateModule, string> = {
  ANNOUNCEMENT: "Duyuru",
  INSTALLMENT_PLAN: "Taksit Planı",
  EXPENSE: "Gider",
  GUIDANCE_NOTE: "Rehberlik Notu",
  HOMEWORK: "Ödev",
  SCHEDULE: "Ders Programı",
  MESSAGE: "Mesaj",
};

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  // ——— Duyurular ———
  {
    id: "hazir:duyuru-veli-toplantisi",
    module: "ANNOUNCEMENT",
    name: "Veli Toplantısı",
    description: "Tarih ve saati doldurup yayınlayın.",
    payload: {
      title: "Veli Toplantısı Duyurusu",
      content:
        "Değerli velimiz,\n\n{{tarih}} tarihinde saat {{saat}}'da kurumumuzda veli toplantısı yapılacaktır. Öğrencimizin dönem içindeki akademik durumu ve gelişimi hakkında görüşmek üzere katılımınızı bekliyoruz.\n\nSaygılarımızla,\n{{kurum}}",
      category: "EVENT",
      scopeType: "ALL_SCHOOL",
    },
  },
  {
    id: "hazir:duyuru-deneme-sinavi",
    module: "ANNOUNCEMENT",
    name: "Deneme Sınavı",
    description: "Sınav tarihi, saati ve getirilecekler.",
    payload: {
      title: "Deneme Sınavı Duyurusu",
      content:
        "Değerli öğrencimiz,\n\n{{tarih}} {{gun}} günü saat {{saat}}'da deneme sınavı uygulanacaktır. Sınava kurşun kalem, silgi ve öğrenci kimliğinizle katılmanız gerekmektedir.\n\nSınav salonunda en geç 15 dakika önce hazır bulununuz.\n\nBaşarılar dileriz.\n{{kurum}}",
      category: "EXAM",
      scopeType: "ALL_SCHOOL",
    },
  },
  {
    id: "hazir:duyuru-tatil",
    module: "ANNOUNCEMENT",
    name: "Tatil Bildirimi",
    description: "Kurumun kapalı olacağı günler.",
    payload: {
      title: "Tatil Duyurusu",
      content:
        "Değerli velimiz ve öğrencimiz,\n\n{{baslangic}} - {{bitis}} tarihleri arasında kurumumuz tatil olacaktır. Derslerimiz {{donus}} tarihinde normal programıyla devam edecektir.\n\nİyi tatiller dileriz.\n{{kurum}}",
      category: "HOLIDAY",
      scopeType: "ALL_SCHOOL",
    },
  },
  {
    id: "hazir:duyuru-odeme-hatirlatma",
    module: "ANNOUNCEMENT",
    name: "Ödeme Hatırlatması",
    description: "Taksit vadesi yaklaşan veliler için genel duyuru.",
    payload: {
      title: "Taksit Ödeme Hatırlatması",
      content:
        "Değerli velimiz,\n\n{{tarih}} tarihinde taksit vadeniz dolmaktadır. Ödemenizi kurumumuz muhasebe biriminden veya banka hesabımızdan gerçekleştirebilirsiniz.\n\nÖdemesini yapmış velilerimiz bu mesajı dikkate almayabilir.\n\nSaygılarımızla,\n{{kurum}}",
      category: "GENERAL",
      scopeType: "ALL_SCHOOL",
    },
  },
  {
    id: "hazir:duyuru-acil-kapali",
    module: "ANNOUNCEMENT",
    name: "Acil: Eğitime Ara",
    description: "Hava/doğal afet gibi ani kapanışlar için.",
    payload: {
      title: "Önemli: Bugünkü Dersler İptal",
      content:
        "Değerli velimiz ve öğrencimiz,\n\n{{sebep}} nedeniyle {{tarih}} tarihindeki derslerimiz iptal edilmiştir. Telafi programı ayrıca duyurulacaktır.\n\nSağlıklı günler dileriz.\n{{kurum}}",
      category: "EMERGENCY",
      scopeType: "ALL_SCHOOL",
    },
  },

  // ——— Taksit planları ———
  // Dershanelerde en sık kurulan planlar. Tutar bilerek BOŞ: öğrenciye
  // göre değişir, şablon sadece taksit yapısını taşır.
  {
    id: "hazir:plan-10-taksit",
    module: "INSTALLMENT_PLAN",
    name: "10 Taksit (Eylül-Haziran)",
    description: "Eğitim yılı boyunca aylık ödeme.",
    payload: { installmentCount: 10, titlePrefix: "Eğitim Ücreti" },
  },
  {
    id: "hazir:plan-9-taksit",
    module: "INSTALLMENT_PLAN",
    name: "9 Taksit (Ekim-Haziran)",
    description: "Eylül peşinatı ayrı alınan kurumlar için.",
    payload: { installmentCount: 9, titlePrefix: "Eğitim Ücreti" },
  },
  {
    id: "hazir:plan-4-taksit",
    module: "INSTALLMENT_PLAN",
    name: "4 Taksit (Dönemlik)",
    description: "Üç ayda bir ödeme.",
    payload: { installmentCount: 4, titlePrefix: "Eğitim Ücreti" },
  },
  {
    id: "hazir:plan-pesin",
    module: "INSTALLMENT_PLAN",
    name: "Peşin",
    description: "Tek çekim.",
    payload: { installmentCount: 1, titlePrefix: "Eğitim Ücreti (Peşin)" },
  },
  {
    id: "hazir:plan-yaz-kursu",
    module: "INSTALLMENT_PLAN",
    name: "Yaz Kursu (3 Taksit)",
    description: "Haziran-Ağustos kısa dönem.",
    payload: { installmentCount: 3, titlePrefix: "Yaz Kursu Ücreti" },
  },

  // ——— Giderler ———
  {
    id: "hazir:gider-kira",
    module: "EXPENSE",
    name: "Bina Kirası",
    description: "Aylık sabit gider.",
    payload: { title: "Bina Kirası", categoryHint: "Kira" },
  },
  {
    id: "hazir:gider-elektrik",
    module: "EXPENSE",
    name: "Elektrik Faturası",
    description: "Aylık fatura.",
    payload: { title: "Elektrik Faturası", categoryHint: "Fatura" },
  },
  {
    id: "hazir:gider-dogalgaz",
    module: "EXPENSE",
    name: "Doğalgaz Faturası",
    description: "Kış aylarında aylık.",
    payload: { title: "Doğalgaz Faturası", categoryHint: "Fatura" },
  },
  {
    id: "hazir:gider-internet",
    module: "EXPENSE",
    name: "İnternet / Telefon",
    description: "Aylık abonelik.",
    payload: { title: "İnternet ve Telefon", categoryHint: "Fatura" },
  },
  {
    id: "hazir:gider-kirtasiye",
    module: "EXPENSE",
    name: "Kırtasiye & Fotokopi",
    description: "Deneme basımı, kağıt, toner.",
    payload: { title: "Kırtasiye ve Fotokopi Gideri", categoryHint: "Kırtasiye" },
  },
  {
    id: "hazir:gider-temizlik",
    module: "EXPENSE",
    name: "Temizlik & Hijyen",
    description: "Malzeme ve hizmet alımı.",
    payload: { title: "Temizlik Malzemesi", categoryHint: "Genel" },
  },
  {
    id: "hazir:gider-servis",
    module: "EXPENSE",
    name: "Öğrenci Servisi",
    description: "Servis firması ödemesi.",
    payload: { title: "Öğrenci Servis Ödemesi", categoryHint: "Ulaşım" },
  },

  // ——— Rehberlik notları ———
  {
    id: "hazir:rehberlik-veli-gorusme",
    module: "GUIDANCE_NOTE",
    name: "Veli Görüşmesi",
    description: "Görüşmenin konusu ve varılan karar.",
    payload: {
      category: "ACADEMIC",
      confidentialityLevel: "RESTRICTED",
      note: "Görüşme tarihi: {{tarih}}\nGörüşülen kişi: {{veli}}\n\nGörüşme konusu:\n- \n\nVelinin aktardıkları:\n- \n\nVarılan karar / alınacak aksiyon:\n- ",
    },
  },
  {
    id: "hazir:rehberlik-akademik-dusus",
    module: "GUIDANCE_NOTE",
    name: "Akademik Düşüş Takibi",
    description: "Net düşüşü fark edilen öğrenci için.",
    payload: {
      category: "ACADEMIC",
      confidentialityLevel: "RESTRICTED",
      note: "Gözlem: Son denemelerde net düşüşü tespit edildi.\n\nDüşüşün görüldüğü dersler:\n- \n\nÖğrencinin ifadesi:\n- \n\nPlanlanan destek (etüt, ödev takibi, veli görüşmesi):\n- \n\nTekrar değerlendirme tarihi: {{tarih}}",
    },
  },
  {
    id: "hazir:rehberlik-devamsizlik",
    module: "GUIDANCE_NOTE",
    name: "Devamsızlık Görüşmesi",
    description: "Devamsızlığı artan öğrenci için.",
    payload: {
      category: "DISCIPLINARY",
      confidentialityLevel: "RESTRICTED",
      note: "Devamsızlık durumu: {{tarih}} itibarıyla artış gözlendi.\n\nÖğrenciden alınan gerekçe:\n- \n\nVeliye bilgi verildi mi: \n\nAlınan karar:\n- ",
    },
  },
  {
    id: "hazir:rehberlik-tercih",
    module: "GUIDANCE_NOTE",
    name: "Tercih Danışmanlığı",
    description: "Sınav sonrası tercih görüşmesi.",
    payload: {
      category: "ACADEMIC",
      confidentialityLevel: "RESTRICTED",
      note: "Sınav sonucu / sıralama: \n\nÖğrencinin hedefleri:\n- \n\nAilenin yaklaşımı:\n- \n\nÖnerilen bölüm/şehir seçenekleri:\n- \n\nBir sonraki görüşme: {{tarih}}",
    },
  },

  // ——— Mesaj (toplu SMS) ———
  {
    id: "hazir:mesaj-devamsizlik",
    module: "MESSAGE",
    name: "Devamsızlık Bilgilendirmesi",
    description: "Derse gelmeyen öğrencinin velisine.",
    payload: {
      content:
        "Sayın velimiz, öğrencimiz {{tarih}} tarihinde derse katılmamıştır. Bilginize sunarız. {{kurum}}",
    },
  },
  {
    id: "hazir:mesaj-deneme-sonuc",
    module: "MESSAGE",
    name: "Deneme Sonucu Hazır",
    description: "Sonuç paylaşımı bildirimi.",
    payload: {
      content:
        "Sayın velimiz, {{sinav}} sonuçları veli panelinde yayınlanmıştır. Detaylı karneye panelden ulaşabilirsiniz. {{kurum}}",
    },
  },
  {
    id: "hazir:mesaj-odeme",
    module: "MESSAGE",
    name: "Ödeme Hatırlatma",
    description: "Vadesi yaklaşan taksit için.",
    payload: {
      content:
        "Sayın velimiz, {{tarih}} tarihli taksit ödemenizi hatırlatmak isteriz. Ödemesini yapan velilerimiz dikkate almayabilir. {{kurum}}",
    },
  },

  // ——— Ödev ———
  {
    id: "hazir:odev-deneme-analizi",
    module: "HOMEWORK",
    name: "Deneme Analizi",
    description: "Sınav sonrası yanlış analizi ödevi.",
    payload: {
      title: "Deneme Analizi",
      description:
        "Son denemede yanlış ve boş bıraktığınız soruları defterinize çözünüz. Her soru için:\n1) Konusunu yazın\n2) Neden yapamadığınızı yazın (bilgi eksiği / dikkat / süre)\n3) Doğru çözümü adım adım yazın",
    },
  },
  {
    id: "hazir:odev-konu-tekrari",
    module: "HOMEWORK",
    name: "Konu Tekrarı",
    description: "Haftalık tekrar ödevi.",
    payload: {
      title: "Haftalık Konu Tekrarı",
      description:
        "Bu hafta işlenen konuların özetini çıkarınız ve kitabınızdaki ilgili test bölümünü çözünüz. Çözemediğiniz soruları işaretleyip derse getiriniz.",
    },
  },
];

// Yer tutucuları doldurur. Karşılığı OLMAYAN yer tutucu OLDUĞU GİBİ
// kalır — bilerek: boş bırakılmış bir cümleyle duyuru yayınlamaktansa
// müdürün "{{tarih}}" görüp elle doldurması iyidir.
export function fillPlaceholders(text: string, values: Record<string, string | undefined>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => values[key] ?? whole);
}

// Bir metindeki doldurulmamış yer tutucular — arayüz "şunları doldurun"
// diye uyarabilsin diye.
export function missingPlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
}

export function builtInsFor(module: TemplateModule): BuiltInTemplate[] {
  return BUILT_IN_TEMPLATES.filter((t) => t.module === module);
}
