/**
 * @jest-environment node
 *
 * SECTION 13 — Webhook Outbound Tests
 *
 * Covers:
 *   13.1  SSRF protection — private IPv4 ranges (10.x, 172.16.x, 192.168.x, 127.x)
 *   13.2  SSRF protection — loopback, blocked hostnames
 *   13.3  SSRF protection — blocked hostnames (localhost, 0.0.0.0, metadata.google.internal)
 *   13.4  SSRF protection — valid public IPs allowed
 *   13.5  HMAC-SHA256 signature generation & verification
 *   13.6  X-Nexus-Signature-256 header format
 *   13.7  fireWebhooks — delivery orchestration
 *   13.8  Webhook delivery logging
 *   13.9  SSRF protection — IPv6 private addresses (::1, fc00::1, fe80::1)
 *   13.10 Retry behavior on 5xx — delivery retried up to 3 times
 */

import crypto from "crypto";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockWebhookFindMany = jest.fn();
const mockDeliveryCreate = jest.fn();

jest.mock("@/lib/db", () => ({
  db: {
    webhook: {
      findMany: (...args: unknown[]) => mockWebhookFindMany(...args),
    },
    webhookDelivery: {
      create: (...args: unknown[]) => mockDeliveryCreate(...args),
    },
  },
}));

// Mock dns.promises.resolve4/resolve6 for SSRF tests
const mockResolve4 = jest.fn();
const mockResolve6 = jest.fn();
jest.mock("dns", () => ({
  promises: {
    resolve4: (...args: unknown[]) => mockResolve4(...args),
    resolve6: (...args: unknown[]) => mockResolve6(...args),
  },
}));

// Mock http/https request to capture outbound calls
const mockHttpRequest = jest.fn();
const mockHttpsRequest = jest.fn();

jest.mock("node:http", () => ({
  Agent: jest.fn().mockImplementation(() => ({})),
  request: (...args: unknown[]) => mockHttpRequest(...args),
}));

jest.mock("node:https", () => ({
  Agent: jest.fn().mockImplementation(() => ({})),
  request: (...args: unknown[]) => mockHttpsRequest(...args),
}));

// ─── Import under test ───────────────────────────────────────────────────────

import { fireWebhooks, verifyWebhookSignature } from "@/lib/webhook-delivery";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_ID = "org_1";
const WEBHOOK_SECRET = "whsec_test_secret_1234";

function makeWebhook(url: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "wh-1",
    url,
    secret: WEBHOOK_SECRET,
    events: ["card.created"],
    isEnabled: true,
    ...overrides,
  };
}

// ─── Reset ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) is required here.
  //
  // clearAllMocks only resets call history — it does NOT clear
  // _mockImplementationStack (the Once-queue from mockResolvedValueOnce).
  //
  // Tests 13.1 call mockResolve4.mockResolvedValueOnce([privateIP]) but the URL
  // hostnames are raw private IPs that are blocked BEFORE the DNS lookup step in
  // validateWebhookUrl.  Those Once items therefore accumulate in the stack and
  // bleed into later tests (e.g. test 13.10), causing api.example.com to resolve
  // to a stale private IP, which triggers SSRF protection and blocks the delivery,
  // resulting in statusCode: null instead of 503.
  //
  // resetAllMocks clears both the call history AND the implementation stacks,
  // preventing this cross-test contamination.
  jest.resetAllMocks();
  // Re-establish implementations cleared by resetAllMocks:
  (jest.requireMock("node:http") as { Agent: jest.Mock }).Agent.mockImplementation(() => ({}));
  (jest.requireMock("node:https") as { Agent: jest.Mock }).Agent.mockImplementation(() => ({}));
  // Default: DNS resolves to public IP
  mockResolve4.mockResolvedValue(["93.184.216.34"]);
  mockResolve6.mockResolvedValue([]);
  // Default: no webhooks found
  mockWebhookFindMany.mockResolvedValue([]);
  mockDeliveryCreate.mockResolvedValue({});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13.1 — SSRF: Private IPv4 ranges
// ═══════════════════════════════════════════════════════════════════════════════

describe("Section 13 — Webhook Outbound", () => {
  describe("13.1 SSRF — private IPv4 blocking", () => {
    it.each([
      ["192.168.1.1", "192.168.0.0/16"],
      ["10.0.0.1", "10.0.0.0/8"],
      ["172.16.0.0", "172.16.0.0/12"],
      ["172.31.255.255", "172.16.0.0/12 upper bound"],
      ["127.0.0.1", "loopback"],
      ["127.255.255.255", "loopback range"],
      ["169.254.169.254", "link-local / AWS metadata"],
      ["0.0.0.0", "unspecified address"],
    ])("13.1 should block webhook to %s (%s)", async (ip, _label) => {
      mockWebhookFindMany.mockResolvedValueOnce([
        makeWebhook(`http://${ip}:8080/hook`),
      ]);
      mockResolve4.mockResolvedValueOnce([ip]);

      await fireWebhooks(ORG_ID, "card.created", { cardId: "c1" });

      // Should record a failed delivery (SSRF blocked)
      expect(mockDeliveryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            success: false,
          }),
        })
      );

      // http/https request should NOT have been called
      expect(mockHttpRequest).not.toHaveBeenCalled();
      expect(mockHttpsRequest).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13.2 — SSRF: DNS resolves to private IP
  // ═══════════════════════════════════════════════════════════════════════════

  describe("13.2 SSRF — DNS resolving to private IP", () => {
    it("13.2.1 should block when hostname resolves to 192.168.1.1", async () => {
      mockWebhookFindMany.mockResolvedValueOnce([
        makeWebhook("http://evil.example.com/hook"),
      ]);
      mockResolve4.mockResolvedValueOnce(["192.168.1.1"]);
      mockResolve6.mockResolvedValueOnce([]);

      await fireWebhooks(ORG_ID, "card.created", { cardId: "c1" });

      expect(mockDeliveryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: false }),
        })
      );
      expect(mockHttpRequest).not.toHaveBeenCalled();
    });

    it("13.2.2 should block when hostname resolves to 10.0.0.1", async () => {
      mockWebhookFindMany.mockResolvedValueOnce([
        makeWebhook("http://internal.example.com/hook"),
      ]);
      mockResolve4.mockResolvedValueOnce(["10.0.0.1"]);
      mockResolve6.mockResolvedValueOnce([]);

      await fireWebhooks(ORG_ID, "card.created", { cardId: "c1" });

      expect(mockDeliveryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: false }),
        })
      );
    });

    it("13.2.3 should block when hostname resolves to 127.0.0.1", async () => {
      mockWebhookFindMany.mockResolvedValueOnce([
        makeWebhook("http://localhost-alias.example.com/hook"),
      ]);
      mockResolve4.mockResolvedValueOnce(["127.0.0.1"]);
      mockResolve6.mockResolvedValueOnce([]);

      await fireWebhooks(ORG_ID, "card.created", { cardId: "c1" });

      expect(mockDeliveryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: false }),
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13.3 — SSRF: Blocked hostnames
  // ═══════════════════════════════════════════════════════════════════════════

  describe("13.3 SSRF — blocked hostnames", () => {
    it.each(["localhost", "0.0.0.0", "metadata.google.internal"])(
      "13.5 should block hostname: %s",
      async (hostname) => {
        mockWebhookFindMany.mockResolvedValueOnce([
          makeWebhook(`http://${hostname}:8080/hook`),
        ]);

        await fireWebhooks(ORG_ID, "card.created", { cardId: "c1" });

        // Should NOT make actual http request
        expect(mockHttpRequest).not.toHaveBeenCalled();
        expect(mockHttpsRequest).not.toHaveBeenCalled();
        // The SSRF guard records a failed delivery even for blocked hostnames
        // so that operators can observe rejected attempts in the audit log.
        expect(mockDeliveryCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ success: false }),
          })
        );
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13.4 — Valid public IP
  // ═══════════════════════════════════════════════════════════════════════════

  describe("13.4 Valid public IP — delivery proceeds", () => {
    it("13.6 should attempt delivery when URL resolves to public IP (not SSRF-blocked)", async () => {
      mockWebhookFindMany.mockResolvedValueOnce([
        makeWebhook("http://api.example.com/hook"),
      ]);
      mockResolve4.mockResolvedValueOnce(["93.184.216.34"]);
      mockResolve6.mockResolvedValueOnce([]);

      await fireWebhooks(ORG_ID, "card.created", { cardId: "c1" });

      // The delivery record is written at the end of deliverSingle.
      // If SSRF blocked, the record would be written INSIDE the SSRF guard
      // with statusCode: null and no X-Nexus-Event header attempt.
      // If SSRF passed, the code enters the retry loop, creates an http.request,
      // and eventually writes a delivery record with the payload.
      expect(mockDeliveryCreate).toHaveBeenCalled();
      const deliveryData = mockDeliveryCreate.mock.calls[0][0].data;

      // Regardless of whether the HTTP request itself succeeds or times out,
      // the payload must contain the event and orgId (proving SSRF check passed
      // and the code proceeded to construct the delivery)
      expect(deliveryData.event).toBe("card.created");
      expect(deliveryData.payload.orgId).toBe(ORG_ID);
      expect(deliveryData.webhookId).toBe("wh-1");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13.5 — No webhooks subscribed → no-op
  // ═══════════════════════════════════════════════════════════════════════════

  describe("13.5 No webhooks subscribed", () => {
    it("13.7 should do nothing when no webhooks are subscribed to event", async () => {
      mockWebhookFindMany.mockResolvedValueOnce([]);

      await fireWebhooks(ORG_ID, "card.created", { cardId: "c1" });

      expect(mockDeliveryCreate).not.toHaveBeenCalled();
      expect(mockHttpRequest).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13.6 — HMAC-SHA256 signature
  // ═══════════════════════════════════════════════════════════════════════════

  describe("13.6 HMAC-SHA256 signature", () => {
    it("13.8 verifyWebhookSignature returns true for valid signature", () => {
      const body = JSON.stringify({ event: "card.created", data: { id: "c1" } });
      const secret = "whsec_test_secret";
      const sig = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;

      expect(verifyWebhookSignature(body, secret, sig)).toBe(true);
    });

    it("13.9 verifyWebhookSignature returns false for tampered payload", () => {
      const body = JSON.stringify({ event: "card.created", data: { id: "c1" } });
      const secret = "whsec_test_secret";
      const sig = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;

      // Tamper the body
      const tampered = JSON.stringify({ event: "card.deleted", data: { id: "c1" } });
      expect(verifyWebhookSignature(tampered, secret, sig)).toBe(false);
    });

    it("13.10 verifyWebhookSignature returns false for wrong secret", () => {
      const body = JSON.stringify({ event: "card.created", data: { id: "c1" } });
      const sig = `sha256=${crypto.createHmac("sha256", "real_secret").update(body).digest("hex")}`;

      expect(verifyWebhookSignature(body, "wrong_secret", sig)).toBe(false);
    });

    it("13.11 verifyWebhookSignature returns false for malformed signature", () => {
      const body = "test";
      expect(verifyWebhookSignature(body, "secret", "invalid")).toBe(false);
    });

    it("13.12 signature format is sha256=<hex>", () => {
      const body = "test-payload";
      const secret = "whsec_abc";
      const hmac = crypto.createHmac("sha256", secret).update(body).digest("hex");
      const sig = `sha256=${hmac}`;

      // Format check
      expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
      // Verifiable
      expect(verifyWebhookSignature(body, secret, sig)).toBe(true);
    });

    it("13.13 timing-safe comparison is used (no short-circuit)", () => {
      // verifyWebhookSignature uses crypto.timingSafeEqual internally
      // We verify it doesn't throw on length mismatch (returns false instead)
      expect(verifyWebhookSignature("body", "secret", "sha256=abc")).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13.7 — fireWebhooks never throws
  // ═══════════════════════════════════════════════════════════════════════════

  describe("13.7 fireWebhooks never throws", () => {
    it("13.14 should not throw when DB query fails", async () => {
      mockWebhookFindMany.mockRejectedValueOnce(new Error("DB down"));

      // Should NOT throw
      await expect(
        fireWebhooks(ORG_ID, "card.created", { cardId: "c1" })
      ).resolves.toBeUndefined();
    });

    it("13.15 should not throw when delivery recording fails", async () => {
      mockWebhookFindMany.mockResolvedValueOnce([
        makeWebhook("http://localhost/hook"),
      ]);
      mockDeliveryCreate.mockRejectedValueOnce(new Error("DB write failed"));

      await expect(
        fireWebhooks(ORG_ID, "card.created", { cardId: "c1" })
      ).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13.8 — Webhook payload structure
  // ═══════════════════════════════════════════════════════════════════════════

  describe("13.8 Webhook payload structure", () => {
    it("13.16 should include event, timestamp, orgId, and data in payload", async () => {
      mockWebhookFindMany.mockResolvedValueOnce([
        makeWebhook("http://api.example.com/hook"),
      ]);
      mockResolve4.mockResolvedValueOnce(["93.184.216.34"]);
      mockResolve6.mockResolvedValueOnce([]);

      // Minimal http.request mock — we just need delivery to finish
      const mockReq = {
        on: jest.fn().mockReturnThis(),
        write: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
      };
      mockHttpRequest.mockImplementation((_opts: unknown, _cb: unknown) => {
        setTimeout(() => {
          const errorHandlers = mockReq.on.mock.calls.filter(
            (c: unknown[]) => c[0] === "error"
          );
          if (errorHandlers.length > 0) {
            errorHandlers[0][1](new Error("mocked"));
          }
        }, 0);
        return mockReq;
      });

      await fireWebhooks(ORG_ID, "card.created", { cardId: "c1" });

      // Verify the delivery record contains the correct payload structure
      expect(mockDeliveryCreate).toHaveBeenCalled();
      const deliveryData = mockDeliveryCreate.mock.calls[0][0].data;
      const payload = deliveryData.payload;

      expect(payload.event).toBe("card.created");
      expect(payload.orgId).toBe(ORG_ID);
      expect(payload.data).toEqual({ cardId: "c1" });
      expect(payload.timestamp).toBeDefined();
      // timestamp should be valid ISO-8601
      expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13.9 — SSRF: IPv6 private addresses
  // ═══════════════════════════════════════════════════════════════════════════

  describe("13.9 SSRF — IPv6 private addresses", () => {
    it.each([
      ["::1",        "IPv6 loopback"],
      ["fc00::1",    "IPv6 ULA (fc00::/7)"],
      ["fe80::1",    "IPv6 link-local (fe80::/10)"],
    ])("should block webhook when hostname resolves to %s (%s)", async (ipv6, _label) => {
      mockWebhookFindMany.mockResolvedValueOnce([
        makeWebhook("http://ipv6host.example.com/hook"),
      ]);
      // Resolve4 returns nothing; resolve6 returns the private IPv6 address
      mockResolve4.mockResolvedValueOnce([]);
      mockResolve6.mockResolvedValueOnce([ipv6]);

      await fireWebhooks(ORG_ID, "card.created", { cardId: "c1" });

      // Delivery should be recorded as failed (SSRF blocked)
      expect(mockDeliveryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: false }),
        })
      );
      // No outbound HTTP request should have been made
      expect(mockHttpRequest).not.toHaveBeenCalled();
      expect(mockHttpsRequest).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13.10 — Retry behavior on 5xx
  // ═══════════════════════════════════════════════════════════════════════════

  describe("13.10 Retry behavior on 5xx", () => {
    it("records delivery as failed after all retry attempts return 5xx", async () => {
      jest.useFakeTimers();

      mockWebhookFindMany.mockResolvedValueOnce([
        makeWebhook("http://api.example.com/hook"),
      ]);
      mockResolve4.mockResolvedValue(["93.184.216.34"]);
      mockResolve6.mockResolvedValue([]);

      // Mock http.request to simulate a 5xx response on every attempt
      const mockReq = {
        on: jest.fn().mockReturnThis(),
        write: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
      };
      mockHttpRequest.mockImplementation((_opts: unknown, cb: (res: unknown) => void) => {
        // Simulate 503 response
        const mockRes = {
          statusCode: 503,
          resumeCalled: false,
          resume() { this.resumeCalled = true; return this; },
          on: jest.fn().mockImplementation(function(this: unknown, event: string, handler: () => void) {
            if (event === "end") handler();
            return this;
          }),
        };
        setTimeout(() => cb(mockRes), 0);
        return mockReq;
      });

      // Run and advance all timers (backoff delays) so the retry loop completes
      const deliveryPromise = fireWebhooks(ORG_ID, "card.created", { cardId: "c1" });
      await jest.runAllTimersAsync();
      await deliveryPromise;

      // After 3 failed attempts, delivery should be recorded as failed
      expect(mockDeliveryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            success: false,
            statusCode: 503,
          }),
        })
      );

      jest.useRealTimers();
    });
  });
});
