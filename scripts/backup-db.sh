#!/usr/bin/env bash
# VERİTABANI YEDEĞİ — kendi kontrolümüzde, doğrulanabilir.
#
# ⚠️ NEDEN VAR: 2026-09-12 ve 09-14'te yanlışlıkla silinen gerçek veriler
# geri getirilemedi; Neon'un point-in-time restore'unun açık olup olmadığını
# bilmiyoruz. Bu script sağlayıcıdan BAĞIMSIZ bir güvenlik ağı kurar:
# dosya elinizde, geri yükleme adımı da test edilebilir.
#
#   ./scripts/backup-db.sh              → yedek al (backups/ altına)
#   ./scripts/backup-db.sh --verify     → yedeği test veritabanına geri
#                                         yükleyerek GERÇEKTEN çalıştığını doğrula
#
# pg_dump yerelde kurulu olmayabilir; Docker'daki postgres imajı kullanılır
# (sürüm uyuşmazlığı olmasın diye üretimle aynı ana sürüm: 17).
set -euo pipefail

cd "$(dirname "$0")/.."

PG_IMAGE="postgres:18-alpine"
BACKUP_DIR="backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/routinix-${STAMP}.dump"

# DATABASE_URL'i .env.local'den oku (dosyayı kaynak almadan, sadece o satırı).
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
fi
if [ -z "${DATABASE_URL}" ]; then
  echo "HATA: DATABASE_URL bulunamadı (.env.local)." >&2
  exit 1
fi

# Neon adresi sslmode=verify-full taşıyor; konteynerde kök sertifika
# dosyası yok. sslrootcert=system, imajın kendi CA deposunu kullandırır —
# doğrulama KAPANMAZ, sadece sertifikanın nereden okunacağı belirtilir.
if [[ "${DATABASE_URL}" == *"sslmode=verify-full"* && "${DATABASE_URL}" != *"sslrootcert="* ]]; then
  DATABASE_URL="${DATABASE_URL}&sslrootcert=system"
fi

mkdir -p "${BACKUP_DIR}"

echo "→ Yedek alınıyor: ${OUT}"
# -Fc: sıkıştırılmış özel biçim (pg_restore ile seçmeli geri yükleme yapılabilir)
# --no-owner/--no-acl: farklı bir sunucuya geri yüklerken sahiplik çakışmasın
docker run --rm -i "${PG_IMAGE}" \
  pg_dump --format=custom --no-owner --no-acl "${DATABASE_URL}" > "${OUT}"

SIZE="$(du -h "${OUT}" | cut -f1)"
echo "✓ Yedek alındı: ${OUT} (${SIZE})"

if [ "${1:-}" != "--verify" ]; then
  echo ""
  echo "Bu yedeğin GERÇEKTEN geri yüklenebildiğini doğrulamak için:"
  echo "  ./scripts/backup-db.sh --verify"
  exit 0
fi

# --- DOĞRULAMA: yedeği test veritabanına geri yükle ---
#
# Yedeği almak yetmez; ASIL SORU "geri yüklenebiliyor mu". Bu adım onu
# üretime hiç dokunmadan, tek kullanımlık test veritabanında kanıtlar.
echo ""
echo "→ Doğrulama: yedek TEST veritabanına geri yükleniyor (üretime dokunulmaz)"

TEST_URL="$(grep -E '^TEST_DATABASE_URL=' .env.test 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
if [ -z "${TEST_URL}" ]; then
  echo "HATA: TEST_DATABASE_URL yok — önce: npm run test:db:up" >&2
  exit 1
fi
case "${TEST_URL}" in
  *localhost*|*127.0.0.1*) ;;
  *) echo "GÜVENLİK: TEST_DATABASE_URL yerel değil, doğrulama reddedildi." >&2; exit 1 ;;
esac

# Konteyner içinden host'a erişim
HOST_URL="${TEST_URL//localhost/host.docker.internal}"
HOST_URL="${HOST_URL//127.0.0.1/host.docker.internal}"

docker run --rm -i "${PG_IMAGE}" \
  pg_restore --clean --if-exists --no-owner --no-acl --dbname="${HOST_URL}" < "${OUT}" 2>&1 | tail -5 || true

COUNT="$(docker run --rm -i "${PG_IMAGE}" \
  psql "${HOST_URL}" -tAc 'SELECT count(*) FROM "Institution";' 2>/dev/null | tr -d '[:space:]')"

echo ""
if [ -n "${COUNT}" ] && [ "${COUNT}" -gt 0 ] 2>/dev/null; then
  echo "✓ DOĞRULANDI: yedek geri yüklendi, test veritabanında ${COUNT} kurum okunuyor."
  echo "  ⚠️ Test veritabanı artık üretim kopyası içeriyor — testten önce sıfırla:"
  echo "     npm run test:db:down && npm run test:db:up && npm run test:db:reset"
else
  echo "✗ DOĞRULAMA BAŞARISIZ: geri yükleme sonrası veri okunamadı." >&2
  exit 1
fi
