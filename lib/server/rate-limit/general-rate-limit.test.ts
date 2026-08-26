import { describe, it, expect } from "vitest";
import { checkGeneralRateLimit, extractClientIp } from "./general-rate-limit";

// Her test benzersiz bir anahtar üretir — aynı process içinde çalışan
// diğer testlerin (ve modül-seviyesi Map'in) sayaçlarına karışmasın diye.
let counter = 0;
function uniqueKey() {
  counter += 1;
  return `test-key-${counter}-${Date.now()}`;
}

describe("checkGeneralRateLimit", () => {
  it("limitin altındaki istekleri geçirir", () => {
    const key = uniqueKey();
    for (let i = 0; i < 5; i++) {
      expect(checkGeneralRateLimit(key, 10).allowed).toBe(true);
    }
  });

  it("limiti aşan isteği retryAfterSeconds ile reddeder", () => {
    const key = uniqueKey();
    const max = 3;
    for (let i = 0; i < max; i++) {
      expect(checkGeneralRateLimit(key, max).allowed).toBe(true);
    }
    const result = checkGeneralRateLimit(key, max);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("farklı anahtarların sayaçları birbirinden bağımsızdır (aynı okul IP'si arkasındaki farklı kullanıcılar gibi)", () => {
    const keyA = uniqueKey();
    const keyB = uniqueKey();
    const max = 2;
    expect(checkGeneralRateLimit(keyA, max).allowed).toBe(true);
    expect(checkGeneralRateLimit(keyA, max).allowed).toBe(true);
    // keyA artık limitte — ama keyB'nin bundan hiç etkilenmemesi gerekir.
    expect(checkGeneralRateLimit(keyA, max).allowed).toBe(false);
    expect(checkGeneralRateLimit(keyB, max).allowed).toBe(true);
  });
});

describe("extractClientIp", () => {
  function requestWithHeaders(headers: Record<string, string>): Request {
    return new Request("http://localhost/api/test", { headers });
  }

  it("x-forwarded-for varsa ilk IP'yi kullanır", () => {
    const req = requestWithHeaders({ "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178" });
    expect(extractClientIp(req)).toBe("203.0.113.5");
  });

  it("x-forwarded-for yoksa x-real-ip'e düşer", () => {
    const req = requestWithHeaders({ "x-real-ip": "203.0.113.9" });
    expect(extractClientIp(req)).toBe("203.0.113.9");
  });

  it("hiçbir proxy header'ı yoksa 'unknown' döner", () => {
    const req = requestWithHeaders({});
    expect(extractClientIp(req)).toBe("unknown");
  });

  it("request tanımsızsa (SSR olmayan bir çağrı) çökmeden 'unknown' döner", () => {
    expect(extractClientIp(undefined)).toBe("unknown");
  });
});
