import { Document, Page, View, Text, Image, Svg, Rect, Circle, Polygon, Defs, LinearGradient, Stop, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe, turkishSafeOrNull } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// Uygulamanın gerçek Tailwind tema renkleriyle uyumlu, ama Karne'ye özel
// olarak ZENGİNLEŞTİRİLMİŞ bir palet — sıcak turuncudan (brand-600) koyu
// kahverengiye (caramel/espresso ailesi) geçen bir gradyan, "kurumsal
// sertifika" hissi versin diye (bkz. PART: "tasarımlar çok düz" geri
// bildirimi — bu component o geri bildirimin karşılığı).
const COLORS = {
  pageBg: "#FFFFFF",
  cardBg: "#FDFBF7",
  cardBgAlt: "#F5F2EB",
  text: "#2C221E",
  textMuted: "#8A7C74",
  gradientStart: "#FF7A1A",
  gradientEnd: "#8A3B1E",
  accent: "#FF6B00",
  accentDark: "#B34B00",
  hairline: "#EDE7DC",
  trackBg: "#F0EBE1",
  positive: "#0F8A4B",
  positiveBg: "#E8F7EE",
  negative: "#D1372E",
  negativeBg: "#FCEBEA",
  commentBg: "#FDF6EC",
  commentBorder: "#F0DCB8",
  commentTitle: "#92450E",
};

const PAGE_WIDTH = 595.28;
const HEADER_HEIGHT = 100;
const CONTENT_PAD = 40;

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: COLORS.pageBg, color: COLORS.text, fontSize: 10 },
  headerBand: { height: HEADER_HEIGHT, position: "relative" },
  headerContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: CONTENT_PAD,
    paddingTop: 26,
    flexDirection: "row",
    alignItems: "center",
  },
  periodBadge: {
    position: "absolute",
    top: 22,
    right: CONTENT_PAD,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  periodBadgeText: { color: "#FFFFFF", fontSize: 8.5, fontWeight: "bold", letterSpacing: 0.3 },
  logoShadow: { position: "absolute", width: 62, height: 62, borderRadius: 16, backgroundColor: "rgba(44,34,30,0.18)", top: 4, left: 3 },
  logoCard: { width: 62, height: 62, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  logoImage: { width: 44, height: 44, borderRadius: 10, objectFit: "contain" },
  logoFallbackText: { color: COLORS.accentDark, fontSize: 24, fontWeight: "bold" },
  headerTextWrap: { marginLeft: 16 },
  institutionName: { fontSize: 21, fontWeight: "bold", color: "#FFFFFF", letterSpacing: -0.3 },
  subtitle: { fontSize: 9.5, fontWeight: "bold", color: "#FFE3CC", letterSpacing: 2.4, marginTop: 5 },

  body: { paddingHorizontal: CONTENT_PAD, paddingTop: 16, paddingBottom: 12 },

  studentRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  studentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cardBgAlt, alignItems: "center", justifyContent: "center", marginRight: 12 },
  studentAvatarText: { fontSize: 16, fontWeight: "bold", color: COLORS.accentDark },
  studentName: { fontSize: 15, fontWeight: "bold" },
  studentBranch: { fontSize: 9.5, color: COLORS.textMuted, marginTop: 2 },

  statRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 14,
    padding: 8,
    alignItems: "center",
  },
  ringWrap: { width: 64, height: 64, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  ringValueWrap: { position: "absolute", alignItems: "center" },
  ringValue: { fontSize: 15, fontWeight: "bold" },
  statBigNumber: { fontSize: 30, fontWeight: "bold", marginBottom: 8 },
  statLabel: { fontSize: 7.5, color: COLORS.textMuted, letterSpacing: 1, textAlign: "center" },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 },
  trendValue: { fontSize: 22, fontWeight: "bold" },

  sectionTitle: { fontSize: 10.5, fontWeight: "bold", marginBottom: 12, color: COLORS.text },
  sectionTitleBar: { width: 3, height: 12, backgroundColor: COLORS.accent, borderRadius: 2, marginRight: 7 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },

  subjectCard: { marginBottom: 7 },
  subjectHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 },
  subjectName: { fontSize: 10.5, fontWeight: "bold" },
  deltaPill: { borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8 },
  deltaPillText: { fontSize: 8.5, fontWeight: "bold" },
  barTrack: { height: 6, backgroundColor: COLORS.trackBg, borderRadius: 3, marginBottom: 3, flexDirection: "row" },
  barFillStudent: { height: 6, backgroundColor: COLORS.accent, borderRadius: 4 },
  barFillAverage: { height: 6, backgroundColor: "#C9BFAE", borderRadius: 4 },
  barLegendRow: { flexDirection: "row", justifyContent: "space-between" },
  barLegendText: { fontSize: 7.5, color: COLORS.textMuted },

  guidanceBox: { backgroundColor: COLORS.cardBgAlt, borderRadius: 12, padding: 10, marginTop: 2, marginBottom: 10 },
  guidanceItemRow: { flexDirection: "row", marginBottom: 4 },
  guidanceDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.accent, marginTop: 4.5, marginRight: 7 },
  guidanceItemText: { fontSize: 9.5, lineHeight: 1.4, flex: 1 },

  commentBox: { backgroundColor: COLORS.commentBg, borderWidth: 1, borderColor: COLORS.commentBorder, borderRadius: 12, padding: 11, position: "relative" },
  commentQuoteMark: { position: "absolute", top: 2, left: 14, fontSize: 44, fontWeight: "bold", color: COLORS.commentBorder },
  commentTitle: { fontSize: 8.5, fontWeight: "bold", color: COLORS.commentTitle, letterSpacing: 1, marginBottom: 8 },
  commentText: { fontSize: 9.3, lineHeight: 1.42, color: "#5C4632" },

  footerDivider: { height: 1, backgroundColor: COLORS.hairline, marginTop: 3, marginBottom: 4 },
  footerRow: { flexDirection: "row", justifyContent: "flex-end" },
  watermark: { fontSize: 7, color: COLORS.textMuted, opacity: 0.6 },
});

export type SubjectRow = { subject: string; studentNet: number; classAverageNet: number; delta: number };

export type PdfReportCardProps = {
  institutionName: string;
  logoUrl?: string | null;
  studentName: string;
  branchName: string;
  periodLabel: string;
  attendanceRate: number;
  subjectSummaries: SubjectRow[];
  guidanceNotes: string[];
  teacherComment?: string | null;
};

function t(value: string): string {
  return turkishSafe(value);
}

// Kampüs V2 Part 5 (tasarım güncellemesi) — Gelişim Karnesi'nin görsel
// dilini "düz tablo" görünümünden "kurumsal sertifika" hissine taşır:
// tam genişlik gradyanlı başlık bandı, devam oranı için dairesel ilerleme
// halkası (bkz. lib/server/pdf/... değil, SVG stroke-dasharray tekniği —
// react-pdf'te strokeDashoffset ÇALIŞMIYOR, virgüllü dasharray + rotate
// transform ile aynı sonuç elde ediliyor, ampirik olarak doğrulandı),
// branş bazlı karşılaştırma artık düz sayı tablosu değil yatay çubuk
// grafik, öğretmen yorumu editoryal alıntı kutusu. Renk paleti aynı marka
// kimliğini (brand-600 turuncu) korur, sadece daha zengin bir gradyan ve
// kart tasarımıyla sunulur.
export function PdfReportCard({
  institutionName,
  logoUrl,
  studentName,
  branchName,
  periodLabel,
  attendanceRate,
  subjectSummaries,
  guidanceNotes,
  teacherComment,
}: PdfReportCardProps) {
  const safeTeacherComment = turkishSafeOrNull(teacherComment ?? null);

  const ringSize = 64;
  const ringCenter = ringSize / 2;
  const ringRadius = ringCenter - 7;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringProgress = Math.max(0, Math.min(1, attendanceRate / 100));
  const ringArc = ringCircumference * ringProgress;

  const averageDelta =
    subjectSummaries.length > 0
      ? Math.round((subjectSummaries.reduce((sum, s) => sum + s.delta, 0) / subjectSummaries.length) * 100) / 100
      : 0;
  const isAveragePositive = averageDelta >= 0;

  const maxBarValue = Math.max(1, ...subjectSummaries.flatMap((s) => [s.studentNet, s.classAverageNet]));

  return (
    <Document title={t(`${studentName} - Gelişim Karnesi`)}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
          <Svg width={PAGE_WIDTH} height={HEADER_HEIGHT} viewBox={`0 0 ${PAGE_WIDTH} ${HEADER_HEIGHT}`}>
            <Defs>
              <LinearGradient id="headerGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={COLORS.gradientStart} />
                <Stop offset="1" stopColor={COLORS.gradientEnd} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={PAGE_WIDTH} height={HEADER_HEIGHT} fill="url(#headerGradient)" />
          </Svg>
          <View style={styles.headerContent}>
            <View style={styles.logoShadow} />
            {logoUrl ? (
              <View style={styles.logoCard}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf'in Image bileşeni (PDF çizim primitifi, next/image DEĞİL) alt kabul etmiyor */}
                <Image src={logoUrl} style={styles.logoImage} />
              </View>
            ) : (
              <View style={styles.logoCard}>
                <Text style={styles.logoFallbackText}>{t(institutionName).charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.headerTextWrap}>
              <Text style={styles.institutionName}>{t(institutionName)}</Text>
              <Text style={styles.subtitle}>{t("GELİŞİM KARNESİ")}</Text>
            </View>
          </View>
          <View style={styles.periodBadge}>
            <Text style={styles.periodBadgeText}>{t(periodLabel)}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.studentRow}>
            <View style={styles.studentAvatar}>
              <Text style={styles.studentAvatarText}>{t(studentName).charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.studentName}>{t(studentName)}</Text>
              <Text style={styles.studentBranch}>{t(branchName)}</Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <View style={styles.ringWrap}>
                <Svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
                  <Circle cx={ringCenter} cy={ringCenter} r={ringRadius} stroke={COLORS.trackBg} strokeWidth={7} fill="none" />
                  <Circle
                    cx={ringCenter}
                    cy={ringCenter}
                    r={ringRadius}
                    stroke={COLORS.accent}
                    strokeWidth={7}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${ringArc}, ${ringCircumference}`}
                    transform={`rotate(-90 ${ringCenter} ${ringCenter})`}
                  />
                </Svg>
                <View style={styles.ringValueWrap}>
                  <Text style={styles.ringValue}>{`%${attendanceRate}`}</Text>
                </View>
              </View>
              <Text style={styles.statLabel}>{t("DEVAM ORANI")}</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={[styles.statBigNumber, { marginTop: 14 }]}>{String(subjectSummaries.length)}</Text>
              <Text style={styles.statLabel}>{t("DEĞERLENDİRİLEN BRANŞ")}</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.trendRow, { marginTop: 14 }]}>
                <Svg width={11} height={11} viewBox="0 0 11 11">
                  {isAveragePositive ? (
                    <Polygon points="5.5,1 10,9.5 1,9.5" fill={COLORS.positive} />
                  ) : (
                    <Polygon points="1,1.5 10,1.5 5.5,10" fill={COLORS.negative} />
                  )}
                </Svg>
                <Text style={[styles.trendValue, { color: isAveragePositive ? COLORS.positive : COLORS.negative }]}>
                  {`${isAveragePositive ? "+" : ""}${averageDelta}`}
                </Text>
              </View>
              <Text style={styles.statLabel}>{t("ORTALAMA FARK")}</Text>
            </View>
          </View>

          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleBar} />
            <Text style={styles.sectionTitle}>{t("BRANŞ BAZLI PERFORMANS")}</Text>
          </View>

          {subjectSummaries.map((row) => {
            const isPositive = row.delta >= 0;
            const studentWidthPct = Math.max(2, (row.studentNet / maxBarValue) * 100);
            const averageWidthPct = Math.max(2, (row.classAverageNet / maxBarValue) * 100);
            return (
              <View key={row.subject} style={styles.subjectCard} wrap={false}>
                <View style={styles.subjectHeaderRow}>
                  <Text style={styles.subjectName}>{t(row.subject)}</Text>
                  <View style={[styles.deltaPill, { backgroundColor: isPositive ? COLORS.positiveBg : COLORS.negativeBg }]}>
                    <Text style={[styles.deltaPillText, { color: isPositive ? COLORS.positive : COLORS.negative }]}>
                      {`${isPositive ? "+" : ""}${row.delta}`}
                    </Text>
                  </View>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFillStudent, { width: `${studentWidthPct}%` }]} />
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFillAverage, { width: `${averageWidthPct}%` }]} />
                </View>
                <View style={styles.barLegendRow}>
                  <Text style={styles.barLegendText}>{t(`Öğrenci: ${row.studentNet}`)}</Text>
                  <Text style={styles.barLegendText}>{t(`Sınıf Ort.: ${row.classAverageNet}`)}</Text>
                </View>
              </View>
            );
          })}
          {subjectSummaries.length === 0 && (
            <Text style={{ fontSize: 9.5, color: COLORS.textMuted, marginBottom: 16 }}>{t("Bu dönem için deneme verisi yok.")}</Text>
          )}

          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleBar} />
            <Text style={styles.sectionTitle}>{t("OTOMATİK REHBERLİK DEĞERLENDİRMESİ")}</Text>
          </View>
          <View style={styles.guidanceBox}>
            {guidanceNotes.map((note, index) => (
              <View key={index} style={styles.guidanceItemRow}>
                <View style={styles.guidanceDot} />
                <Text style={styles.guidanceItemText}>{t(note)}</Text>
              </View>
            ))}
          </View>

          {safeTeacherComment && (
            <View style={styles.commentBox}>
              <Text style={styles.commentQuoteMark}>&quot;</Text>
              <Text style={styles.commentTitle}>{t("DANIŞMAN ÖĞRETMEN YORUMU")}</Text>
              <Text style={styles.commentText}>{safeTeacherComment}</Text>
            </View>
          )}

          <View style={styles.footerDivider} />
          <View style={styles.footerRow}>
            <Text style={styles.watermark}>{t("Powered by Routinix Kampüs")}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
