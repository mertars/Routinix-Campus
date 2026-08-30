import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";
import { parseSlotRange } from "@/lib/schedule-time";

ensurePdfFontsRegistered();

// bkz. pdf-report-card.tsx (sertifika), pdf-exam-document.tsx (bilet/
// manifesto), pdf-guidance-program.tsx (kişisel günlük) — BİLEREK
// DÖRDÜNCÜ bir dil: bu belge yöneticiye/veliye/öğrenciye değil
// ÖĞRETMENİN KENDİSİNE, masasına yapıştıracağı/sınıfa götüreceği bir
// "çalışma masası referansı" — dekoratif değil, TARANABİLİR bir IZGARA
// (gerçek okul karneleri/ders programları gibi gün×saat tablosu).
const COLORS = {
  pageBg: "#FFFFFF",
  text: "#2C221E",
  textMuted: "#8A7C74",
  accent: "#FF6B00",
  accentDark: "#B34B00",
  hairline: "#E2DCD0",
  cellFilled: "#FFF1E4",
  cellEmpty: "#FAFAF7",
  headBg: "#2C221E",
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: COLORS.pageBg, color: COLORS.text, padding: 36, fontSize: 9 },

  topAccent: { height: 4, backgroundColor: COLORS.accent, borderRadius: 2, marginBottom: 18 },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logoImage: { width: 34, height: 34, borderRadius: 9, objectFit: "contain" },
  logoFallback: { width: 34, height: 34, borderRadius: 9, backgroundColor: COLORS.text, alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 14, fontWeight: "bold" },
  teacherName: { fontSize: 16, fontWeight: "bold", marginLeft: 10 },
  subjectLabel: { fontSize: 9, color: COLORS.textMuted, marginLeft: 10, marginTop: 1 },
  titleTag: { fontSize: 8.5, fontWeight: "bold", color: COLORS.accentDark, letterSpacing: 1.4, textAlign: "right" },
  institutionNameSmall: { fontSize: 8, color: COLORS.textMuted, textAlign: "right", marginTop: 2 },

  grid: { borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 10, overflow: "hidden" },
  gridHeaderRow: { flexDirection: "row", backgroundColor: COLORS.headBg },
  gridHeadTimeCol: { width: 62, paddingVertical: 8 },
  gridHeadDayCol: { flex: 1, paddingVertical: 8, alignItems: "center" },
  gridHeadText: { fontSize: 8, fontWeight: "bold", color: "#FFFFFF", letterSpacing: 0.6 },

  gridBodyRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.hairline },
  gridTimeCell: { width: 62, paddingVertical: 10, paddingLeft: 10, justifyContent: "center" },
  gridTimeText: { fontSize: 8, fontWeight: "bold", color: COLORS.textMuted },
  gridDayCell: { flex: 1, borderLeftWidth: 1, borderLeftColor: COLORS.hairline, padding: 6, alignItems: "center", justifyContent: "center", minHeight: 40 },
  gridCellFilled: { backgroundColor: COLORS.cellFilled },
  gridCellEmpty: { backgroundColor: COLORS.cellEmpty },
  gridCellBranch: { fontSize: 8.5, fontWeight: "bold", color: COLORS.accentDark, textAlign: "center" },
  gridCellEmptyDash: { fontSize: 8, color: "#D8D0C2" },

  emptyState: { padding: 40, alignItems: "center" },
  emptyStateText: { fontSize: 9, color: COLORS.textMuted },

  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: { width: 9, height: 9, borderRadius: 2, backgroundColor: COLORS.cellFilled, borderWidth: 1, borderColor: COLORS.accent },
  legendText: { fontSize: 7.5, color: COLORS.textMuted },
  watermark: { fontSize: 7, color: COLORS.textMuted, opacity: 0.6 },
});

export type PdfScheduleRow = { day: string; slot: string; branchName: string };

export type PdfTeacherScheduleProps = {
  institutionName: string;
  logoUrl?: string | null;
  teacherName: string;
  subject: string;
  days: readonly string[];
  schedule: PdfScheduleRow[];
};

function t(value: string): string {
  return turkishSafe(value);
}

// Kampüs V2 — Haftalık Ders Programı artık gün-bazlı liste değil, GERÇEK
// bir okul karnesi/ders programı gibi gün × saat IZGARASI. Saat satırları
// programdaki mevcut slot'lardan türetilir (kurumun ScheduleSlotDefinition
// listesini yeniden çekmeye gerek yok — öğretmenin ZATEN dolu olduğu
// saatler tabloyu belirler, boş saatler zaten "Boş" görünecek).
export function PdfTeacherSchedule({ institutionName, logoUrl, teacherName, subject, days, schedule }: PdfTeacherScheduleProps) {
  const slots = Array.from(new Set(schedule.map((row) => row.slot))).sort((a, b) => parseSlotRange(a)[0] - parseSlotRange(b)[0]);

  return (
    <Document title={t(`${teacherName} - Haftalik Ders Programi`)}>
      <Page size="A4" style={styles.page}>
        <View style={styles.topAccent} />

        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf'in Image bileşeni (PDF çizim primitifi, next/image DEĞİL) alt kabul etmiyor
              <Image src={logoUrl} style={styles.logoImage} />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={styles.logoFallbackText}>{t(teacherName).charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View>
              <Text style={styles.teacherName}>{t(teacherName)}</Text>
              <Text style={styles.subjectLabel}>{t(subject)}</Text>
            </View>
          </View>
          <View>
            <Text style={styles.titleTag}>{t("HAFTALIK DERS PROGRAMI")}</Text>
            <Text style={styles.institutionNameSmall}>{t(institutionName)}</Text>
          </View>
        </View>

        {slots.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t("Programda henüz atanmış bir ders saati yok.")}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            <View style={styles.gridHeaderRow}>
              <View style={styles.gridHeadTimeCol} />
              {days.map((day) => (
                <View key={day} style={styles.gridHeadDayCol}>
                  <Text style={styles.gridHeadText}>{t(day).toUpperCase()}</Text>
                </View>
              ))}
            </View>
            {slots.map((slot) => (
              <View key={slot} style={styles.gridBodyRow} wrap={false}>
                <View style={styles.gridTimeCell}>
                  <Text style={styles.gridTimeText}>{slot}</Text>
                </View>
                {days.map((day) => {
                  const match = schedule.find((row) => row.day === day && row.slot === slot);
                  return (
                    <View key={day} style={[styles.gridDayCell, match ? styles.gridCellFilled : styles.gridCellEmpty]}>
                      {match ? <Text style={styles.gridCellBranch}>{t(match.branchName)}</Text> : <Text style={styles.gridCellEmptyDash}>—</Text>}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        <View style={styles.footerRow}>
          <View style={styles.legendRow}>
            <View style={styles.legendSwatch} />
            <Text style={styles.legendText}>{t("Ders var")}</Text>
          </View>
          <Text style={styles.watermark}>{t("Powered by Routinix Kampüs")}</Text>
        </View>
      </Page>
    </Document>
  );
}
