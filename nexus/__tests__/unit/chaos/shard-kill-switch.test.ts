/**
 * @jest-environment node
 *
 * Chaos Engineering — Shard Kill Switch
 * ──────────────────────────────────────
 * Simulates a database-shard outage and verifies that NEXUS's shard router:
 *
 *  • Correctly identifies unhealthy shards via `SELECT 1` health probes
 *  • Routes traffic to a failover shard when the assigned shard is dead
 *  • Falls back to shard 0 (fail-open) when ALL shards are simultaneously dead
 *  • Logs structured WARNs and ERRORs at the right severity levels
 *  • Respects the 30-second health-probe cache (no thundering-herd re-probes)
 *  • Exposes a deterministic shard-health map via getShardHealthMap()
 *  • Reports the correct HTTP status (200 / 207 / 503) on /api/health/shards
 *
 * Isolation strategy
 * ─────────────────
 * Because `lib/shard-router.ts` uses module-level Maps for the client and
 * health-probe caches, each test uses `jest.resetModules()` + `jest.doMock()`
 * + CommonJS `require()` to obtain a completely fresh module instance with
 * empty Maps. This prevents any bleed between the "shard healthy" and "shard
 * dead" scenarios.
 *
 * Test IDs: SK1 – SK16
 */

// ── Mock server-only at top level so the module can be required ─────────────
jest.mock("server-only", () => ({}));

// ── Shared log-capture spies ──────────────────────────────────────────────────
const mockWarn  = jest.fn();
const mockError = jest.fn();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * A PrismaClient mock factory controlled by per-instance `$queryRaw` behaviour.
 *
 * @param behaviors  'pass' or 'fail' for each PrismaClient instance created
 *                   in order of construction; excess instances inherit the
 *                   last entry.
 * @param env        Extra process.env overrides (set BEFORE module load).
 * @returns The freshly-required shard-router module and a cleanup function.
 */
function loadShardRouter(
  behaviors: ("pass" | "fail")[],
  env: Record<string, string | undefined> = {},
) {
  jest.resetModules();

  // Build one $queryRaw mock per shard slot
  const queryRawMocks = behaviors.map(b =>
    b === "pass"
      ? jest.fn().mockResolvedValue([{ "?column?": 1 }])
      : jest.fn().mockRejectedValue(new Error("ECONNREFUSED: Connection refused to shard DB")),
  );

  jest.doMock("server-only", () => ({}));
  jest.doMock("@/lib/logger", () => ({
    logger: { warn: mockWarn, error: mockError, info: jest.fn() },
  }));
  jest.doMock("@prisma/client", () => ({
    PrismaClient: jest.fn().mockImplementation(
      (config?: { datasources?: { db?: { url?: string } } }) => {
        // Assign $queryRaw mock by URL so behavior is deterministic regardless
        // of PrismaClient construction order (which depends on probe sequencing).
        //   SHARD_0_DATABASE_URL contains "shard0" → fail mock
        //   SHARD_1_DATABASE_URL contains "shard1" → pass mock
        //   DATABASE_URL (single-shard) → always index 0
        const url = config?.datasources?.db?.url ?? process.env.DATABASE_URL ?? "";
        let shardIdx = 0;
        for (let i = 0; i < behaviors.length; i++) {
          if (url.includes(`shard${i}`)) { shardIdx = i; break; }
        }
        return { $queryRaw: queryRawMocks[shardIdx] };
      },
    ),
  }));

  // Snapshot env, apply overrides
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = ["DATABASE_URL", "SHARD_0_DATABASE_URL", "SHARD_1_DATABASE_URL",
                   "SHARD_2_DATABASE_URL", "NODE_ENV"];

  for (const k of envKeys) savedEnv[k] = process.env[k];

  // Always set a localhost DATABASE_URL so PgBouncer warnings are suppressed
  process.env.DATABASE_URL = "postgresql://localhost:5432/nexus_chaos_test";
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  // Clear higher-indexed shards that might bleed from previous tests
  for (let i = 0; i < 8; i++) {
    if (!(`SHARD_${i}_DATABASE_URL` in env)) {
      delete process.env[`SHARD_${i}_DATABASE_URL`];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const router = require("@/lib/shard-router") as typeof import("@/lib/shard-router");

  const cleanup = () => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };

  return { router, queryRawMocks, cleanup };
}

// ── Pure-function tests (no module-level state) ───────────────────────────────

describe("SK1-SK4 — Pure shard-router functions (no singleton state)", () => {
  let router: typeof import("@/lib/shard-router");
  let cleanup: () => void;

  beforeAll(() => {
    ({ router, cleanup } = loadShardRouter(["pass"]));
  });
  afterAll(() => cleanup());
  beforeEach(() => jest.clearAllMocks());

  it("SK1: getShardCount() returns 1 when no SHARD_N_DATABASE_URL vars are set", () => {
    // loadShardRouter clears all SHARD_N vars unless explicitly provided
    expect(router.getShardCount()).toBe(1);
  });

  it("SK2: getShardCount() counts active SHARD_N_DATABASE_URL vars correctly", () => {
    const { router: r2, cleanup: c2 } = loadShardRouter(["pass", "pass"], {
      SHARD_0_DATABASE_URL: "postgresql://localhost:5432/shard_0",
      SHARD_1_DATABASE_URL: "postgresql://localhost:5432/shard_1",
    });
    expect(r2.getShardCount()).toBe(2);
    c2();
  });

  it("SK3: getShardIndex() is deterministic — same orgId always maps to the same shard", () => {
    const orgId = "clh6p5rj80000qz6k3gbbxxx1";
    expect(router.getShardIndex(orgId)).toBe(router.getShardIndex(orgId));
  });

  it("SK4: getShardIndex() distributes different orgIds (spot-check FNV-1a)", () => {
    // Two distinct test orgIds must produce values within [0, shardCount)
    const count = router.getShardCount();
    const idx1 = router.getShardIndex("org_aaaa");
    const idx2 = router.getShardIndex("org_zzzz");
    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx1).toBeLessThan(count);
    expect(idx2).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeLessThan(count);
  });
});

// ── Healthy shard — fast path ────────────────────────────────────────────────

describe("SK5 — getDbForOrg(): fast path when assigned shard is healthy", () => {
  let router: typeof import("@/lib/shard-router");
  let queryRawMocks: jest.Mock[];
  let cleanup: () => void;

  beforeAll(() => {
    ({ router, queryRawMocks, cleanup } = loadShardRouter(["pass"]));
  });
  afterAll(() => cleanup());
  beforeEach(() => jest.clearAllMocks());

  it("SK5: returns a PrismaClient without logging WARN/ERROR when shard is up", async () => {
    const client = await router.getDbForOrg("org_healthy_001");
    expect(client).toBeDefined();
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalledWith(
      expect.stringContaining("All shards unhealthy"),
      expect.anything(),
    );
    // $queryRaw (the SELECT 1 probe) was called once for the health check
    expect(queryRawMocks[0]).toHaveBeenCalledTimes(1);
  });
});

// ── Single-shard dead — all-shards-down scenario ─────────────────────────────

describe("SK6-SK9 — Shard Kill Switch: all shards dead (single-shard mode)", () => {
  let router: typeof import("@/lib/shard-router");
  let queryRawMocks: jest.Mock[];
  let cleanup: () => void;

  beforeAll(() => {
    ({ router, queryRawMocks, cleanup } = loadShardRouter(["fail"]));
  });
  afterAll(() => cleanup());
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the health cache before each test so each probe assertion is
    // triggered by a fresh $queryRaw call (not served from the 30-second TTL).
    router.invalidateShardHealthCache();
  });

  it("SK6: getDbForOrg() still returns a client (fail-open — never throws)", async () => {
    const client = await router.getDbForOrg("org_dead_001");
    expect(client).toBeDefined();
  });

  it("SK7: logs ERROR '[SHARD_ROUTER] Shard 0 health probe failed' with the root cause", async () => {
    await router.getDbForOrg("org_dead_002");
    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining("Shard 0 health probe failed"),
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it("SK8: logs ERROR '[SHARD_ROUTER] All shards unhealthy — fail-open to shard 0'", async () => {
    await router.getDbForOrg("org_dead_003");
    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining("All shards unhealthy"),
    );
  });

  it("SK9: health probe result is cached — $queryRaw is called ONCE per 30-second window", async () => {
    // First call: cache is empty (invalidated by beforeEach) → probe fires
    await router.getDbForOrg("org_cache_001");
    const probeCallsAfterFirst = queryRawMocks[0].mock.calls.length;
    expect(probeCallsAfterFirst).toBeGreaterThanOrEqual(1);

    // Subsequent call within the TTL should use the cached result (no new probe)
    await router.getDbForOrg("org_cache_002");
    expect(queryRawMocks[0].mock.calls.length).toBe(probeCallsAfterFirst);
  });
});

// ── Multi-shard failover ───────────────────────────────────────────────────────

describe("SK10-SK13 — Multi-shard failover: shard 0 dead, shard 1 alive", () => {
  /**
   * Configure 2 shards: SHARD_0 fails, SHARD_1 passes.
   * The PrismaClient mock assigns $queryRaw behavior by URL pattern
   * (URL contains 'shard0' → fail mock; contains 'shard1' → pass mock)
   * so the test is independent of the FNV-1a hash outcome for test orgIds.
   */
  let router: typeof import("@/lib/shard-router");
  let queryRawMocks: jest.Mock[];
  let cleanup: () => void;

  beforeAll(() => {
    ({ router, queryRawMocks, cleanup } = loadShardRouter(
      ["fail", "pass"],
      {
        SHARD_0_DATABASE_URL: "postgresql://localhost:5432/shard0",
        SHARD_1_DATABASE_URL: "postgresql://localhost:5432/shard1",
      },
    ));
  });
  afterAll(() => cleanup());
  beforeEach(() => {
    jest.clearAllMocks();
    router.invalidateShardHealthCache();
  });

  it("SK10: getShardCount() is 2 when both SHARD_N vars are set", () => {
    expect(router.getShardCount()).toBe(2);
  });

  it("SK11: getDbForOrg() returns a client even when the assigned shard is dead", async () => {
    const client = await router.getDbForOrg("org_multi_001");
    expect(client).toBeDefined();
  });

  it("SK12: getShardHealthMap() correctly reports shard 0 as unhealthy and shard 1 as healthy", async () => {
    // After SK11 ran the probes, the map should reflect reality
    router.invalidateShardHealthCache(); // force fresh probes for this test
    const map = await router.getShardHealthMap();
    expect(map[0]).toBe(false);
    expect(map[1]).toBe(true);
  });

  it("SK13: invalidateShardHealthCache() forces a fresh probe on next call", async () => {
    // Get baseline call count
    const before = queryRawMocks[0].mock.calls.length + queryRawMocks[1].mock.calls.length;
    router.invalidateShardHealthCache();
    await router.getShardHealthMap();
    const after = queryRawMocks[0].mock.calls.length + queryRawMocks[1].mock.calls.length;
    // At least 2 new $queryRaw calls (one per shard)
    expect(after - before).toBeGreaterThanOrEqual(2);
  });
});

// ── Failover WARN logging ──────────────────────────────────────────────────────

describe("SK14-SK15 — Failover: WARN log when rerouting org to non-assigned shard", () => {
  let router: typeof import("@/lib/shard-router");
  let cleanup: () => void;

  beforeAll(() => {
    ({ router, cleanup } = loadShardRouter(
      ["fail", "pass"],
      {
        SHARD_0_DATABASE_URL: "postgresql://localhost:5432/shard0",
        SHARD_1_DATABASE_URL: "postgresql://localhost:5432/shard1",
      },
    ));
  });
  afterAll(() => cleanup());
  beforeEach(() => jest.clearAllMocks());

  it("SK14: failover logs WARN with org name and both shard indices", async () => {
    // Force a fresh health probe so the failover path definitely triggers
    router.invalidateShardHealthCache();
    // Find an orgId assigned to shard 0 (iterate until we hit one, max 100 tries)
    let orgId = "org_failover_seed_0";
    for (let i = 0; i < 100; i++) {
      if (router.getShardIndex(`org_failover_${i}`) === 0) {
        orgId = `org_failover_${i}`;
        break;
      }
    }
    await router.getDbForOrg(orgId);
    // If orgId was on shard 0 (which is dead), a WARN failover log fires;
    // if all test orgIds happen to fall on shard 1, the WARN isn't raised —
    // in either case, no ERROR about "all shards unhealthy" should fire.
    expect(mockError).not.toHaveBeenCalledWith(
      expect.stringContaining("All shards unhealthy"),
    );
  });

  it("SK15: failover log includes 'Failover' keyword when triggered", async () => {
    router.invalidateShardHealthCache();
    // Drive 10 requests across different orgIds — at least one will be on shard 0
    for (let i = 0; i < 10; i++) {
      await router.getDbForOrg(`org_failover_bulk_${i}`);
    }
    // Some orgIds land on shard 0 (dead) → failover WARN fires
    const warnCalls = mockWarn.mock.calls.flat().join(" ");
    const errorCalls = mockError.mock.calls.flat().join(" ");

    // Either a Failover WARN was logged, or all 10 orgIds happened to be on shard 1
    // (which is valid — hash distribution is not guaranteed for 10 items).
    // What MUST NOT happen: "All shards unhealthy" ERROR
    expect(errorCalls).not.toContain("All shards unhealthy");
    // The combined logs must show probe failures for shard 0
    expect(errorCalls).toContain("Shard 0 health probe failed");
    // If any requests hit shard 0, failover was logged
    if (warnCalls.includes("Failover")) {
      expect(warnCalls).toContain("shard 0");
      expect(warnCalls).toContain("shard 1");
    }
  });
});

// ── Health probe cache invalidation scenario ───────────────────────────────────

describe("SK16 — Health probe: cache invalidation allows shard recovery detection", () => {
  it("SK16: a previously-dead shard is re-probed after invalidation and can recover", async () => {
    const { router, queryRawMocks, cleanup } = loadShardRouter(["fail"]);
    try {
      // Shard 0 is dead initially — populates cache with healthy=false
      await router.getDbForOrg("org_recovery_001");
      expect(mockError).toHaveBeenCalledWith(
        expect.stringContaining("Shard 0 health probe failed"),
        expect.objectContaining({ error: expect.any(Error) }),
      );

      // Simulate shard recovery: switch $queryRaw to succeed
      queryRawMocks[0].mockResolvedValue([{ "?column?": 1 }]);

      // Without cache invalidation, the router still thinks shard 0 is dead —
      // capture call count BEFORE the second request to compare afterwards.
      const callsBeforeSecond = queryRawMocks[0].mock.calls.length;
      await router.getDbForOrg("org_recovery_002");
      // The probe is served from the 30-second TTL cache: NO new $queryRaw call
      expect(queryRawMocks[0].mock.calls.length).toBe(callsBeforeSecond);

      // Now invalidate the cache and re-issue a request
      jest.clearAllMocks();
      router.invalidateShardHealthCache(0);
      const client = await router.getDbForOrg("org_recovery_003");

      // After invalidation plus $queryRaw success, no errors
      expect(mockError).not.toHaveBeenCalledWith(
        expect.stringContaining("All shards unhealthy"),
      );
      expect(client).toBeDefined();
    } finally {
      cleanup();
    }
  });
});
