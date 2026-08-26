// Birim testleri gerçek bir DB'ye/gizli anahtara BAĞLANMAZ ama import
// zincirindeki bazı modüller (örn. lib/server/env.ts > getEnv()) bu ortam
// değişkenlerinin varlığını doğruluyor — burada sadece doğrulamayı
// geçecek, hiçbir yere bağlanmayan sahte değerler tanımlanır.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/routinix_test_placeholder";
process.env.AUTH_SECRET ??= "vitest-unit-test-secret-not-for-real-use-000000000000";
process.env.SMS_PROVIDER ??= "mock";
