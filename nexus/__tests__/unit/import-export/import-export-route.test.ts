/**
 * @jest-environment node
 */

/**
 * Section 10B — Import / Export: Route-Handler Tests
 *
 * Tests the HTTP layer of:
 *   POST /api/import  (app/api/import/route.ts)
 *   GET  /api/export/[boardId] (app/api/export/[boardId]/route.ts)
 *
 * The action functions are mocked; this suite verifies:
 *   - Authentication guards (401)
 *   - Zod schema validation (422 for unsupported format)
 *   - Body-parse failures (400)
 *   - Action-layer errors bubbling to 400 / 404
 *   - Happy-path status codes (201, 200)
 *   - Response headers (Content-Type, Content-Disposition)
 *
 * Covers:
 *   10.19 POST /api/import — unauthorized → 401
 *   10.20 POST /api/import — malformed JSON body → 400
 *   10.21 POST /api/import — format="csv" rejected by Zod → 422
 *   10.22 POST /api/import — format="nexus" valid → 201 with boardId
 *   10.23 POST /api/import — format="trello" valid → 201 with boardId
 *   10.24 POST /api/import — format="jira" valid XML string → 201 with boardId
 *   10.25 POST /api/import — action returns { error } → 400
 *   10.26 POST /api/import — jira format with non-string data rejected by Zod → 422
 *   10.27 GET  /api/export/[boardId] — unauthorized → 401
 *   10.28 GET  /api/export/[boardId] — default JSON format → 200 + json headers
 *   10.29 GET  /api/export/[boardId] — format=csv → 200 + text/csv headers
 *   10.30 GET  /api/export/[boardId] — board not found → 404
 *   10.31 GET  /api/export/[boardId] — Content-Disposition filename includes boardId
 *   10.32 GET  /api/export/[boardId] — CSV format Content-Disposition ends with .csv
 *   10.33 GET  /api/export/[boardId] — response body is valid JSON string for json format
 *   10.34 GET  /api/export/[boardId] — response body is CSV text for csv format
 */

import { NextRequest } from "next/server";
import { POST }        from "@/app/api/import/route";
import { GET }         from "@/app/api/export/[boardId]/route";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BOARD_ID   = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NEW_BOARD  = "11111111-1111-4111-8111-111111111111";

const JSON_SNAPSHOT = {
  __nexusExport: "v1",
  exportedAt:    "2026-01-01T00:00:00.000Z",
  board: {
    title: "Test Board",
    lists: [],
  },
};

const CSV_CONTENT = "List,Card Title,Priority,Due Date\nTodo,Fix bug,HIGH,\n";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "user_clerk_0001", orgId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
}));

jest.mock("@/actions/import-export-actions", () => ({
  importFromJSON:    jest.fn(),
  importFromTrello:  jest.fn(),
  importFromJira:    jest.fn(),
  exportBoardAsJSON: jest.fn(),
  exportBoardAsCSV:  jest.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeImportReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/import", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

function makeMalformedReq(): NextRequest {
  return new NextRequest("http://localhost/api/import", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    "{ this is not : valid json }",
  });
}

function makeExportReq(boardId: string, format?: string): NextRequest {
  const url = new URL(`http://localhost/api/export/${boardId}`);
  if (format) url.searchParams.set("format", format);
  return new NextRequest(url.toString());
}

function mockImportActions() {
  const actions = jest.requireMock("@/actions/import-export-actions") as {
    importFromJSON:   jest.Mock;
    importFromTrello: jest.Mock;
    importFromJira:   jest.Mock;
  };
  actions.importFromJSON.mockResolvedValue({ data: { boardId: NEW_BOARD } });
  actions.importFromTrello.mockResolvedValue({ data: { boardId: NEW_BOARD } });
  actions.importFromJira.mockResolvedValue({ data: { boardId: NEW_BOARD } });
}

function mockExportActions() {
  const actions = jest.requireMock("@/actions/import-export-actions") as {
    exportBoardAsJSON: jest.Mock;
    exportBoardAsCSV:  jest.Mock;
  };
  actions.exportBoardAsJSON.mockResolvedValue({ data: JSON_SNAPSHOT });
  actions.exportBoardAsCSV.mockResolvedValue({
    data:     CSV_CONTENT,
    filename: `nexus-board-${BOARD_ID}.csv`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Section 10B — Import / Export Route Handlers", () => {
  beforeEach(() => {
    jest.resetAllMocks();

    const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
    auth.mockResolvedValue({ userId: "user_clerk_0001", orgId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });

    mockImportActions();
    mockExportActions();
  });

  // ─── 10.19 POST /api/import — unauthorized ───────────────────────────────────

  describe("10.19 POST /api/import — unauthorized", () => {
    it("returns 401 when no session", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValueOnce({ userId: null });

      const res = await POST(makeImportReq({ format: "nexus", data: {} }));
      expect(res.status).toBe(401);
    });

    it("returns { error: 'Unauthorized' } in the body", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValueOnce({ userId: null });

      const res  = await POST(makeImportReq({ format: "nexus", data: {} }));
      const body = await res.json() as { error: string };
      expect(body.error).toBe("Unauthorized");
    });

    it("does not call any import action when unauthorized", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValueOnce({ userId: null });

      await POST(makeImportReq({ format: "nexus", data: {} }));

      const { importFromJSON } = jest.requireMock("@/actions/import-export-actions") as {
        importFromJSON: jest.Mock;
      };
      expect(importFromJSON).not.toHaveBeenCalled();
    });
  });

  // ─── 10.20 POST /api/import — malformed JSON body ────────────────────────────

  describe("10.20 POST /api/import — malformed JSON body → 400", () => {
    it("returns HTTP 400", async () => {
      const res = await POST(makeMalformedReq());
      expect(res.status).toBe(400);
    });

    it("returns { error: 'Invalid JSON' }", async () => {
      const res  = await POST(makeMalformedReq());
      const body = await res.json() as { error: string };
      expect(body.error).toBe("Invalid JSON");
    });
  });

  // ─── 10.21 POST /api/import — format="csv" rejected → 422 ───────────────────

  describe("10.21 POST /api/import — format='csv' rejected by Zod → 422", () => {
    it("returns HTTP 422", async () => {
      const res = await POST(makeImportReq({ format: "csv", data: "..." }));
      expect(res.status).toBe(422);
    });

    it("body contains an error message", async () => {
      const res  = await POST(makeImportReq({ format: "csv", data: "..." }));
      const body = await res.json() as { error: string };
      expect(typeof body.error).toBe("string");
      expect(body.error.length).toBeGreaterThan(0);
    });

    it("does not call any action function", async () => {
      await POST(makeImportReq({ format: "csv", data: "..." }));
      const { importFromJSON } = jest.requireMock("@/actions/import-export-actions") as {
        importFromJSON: jest.Mock;
      };
      expect(importFromJSON).not.toHaveBeenCalled();
    });
  });

  // ─── 10.22 POST /api/import — format="nexus" happy path → 201 ───────────────

  describe("10.22 POST /api/import — format='nexus' valid → 201", () => {
    it("returns HTTP 201", async () => {
      const res = await POST(makeImportReq({ format: "nexus", data: {} }));
      expect(res.status).toBe(201);
    });

    it("returns { boardId } in the response body", async () => {
      const res  = await POST(makeImportReq({ format: "nexus", data: {} }));
      const body = await res.json() as { boardId: string };
      expect(body.boardId).toBe(NEW_BOARD);
    });

    it("calls importFromJSON with the data payload", async () => {
      const payload = { format: "nexus", data: { __nexusExport: "v1", board: { title: "T", lists: [] } } };
      await POST(makeImportReq(payload));
      const { importFromJSON } = jest.requireMock("@/actions/import-export-actions") as {
        importFromJSON: jest.Mock;
      };
      expect(importFromJSON).toHaveBeenCalledWith(payload.data);
    });
  });

  // ─── 10.23 POST /api/import — format="trello" happy path → 201 ──────────────

  describe("10.23 POST /api/import — format='trello' valid → 201", () => {
    it("returns HTTP 201", async () => {
      const res = await POST(makeImportReq({ format: "trello", data: {} }));
      expect(res.status).toBe(201);
    });

    it("calls importFromTrello with the data payload", async () => {
      const trelloData = { name: "Board", lists: [], cards: [] };
      await POST(makeImportReq({ format: "trello", data: trelloData }));
      const { importFromTrello } = jest.requireMock("@/actions/import-export-actions") as {
        importFromTrello: jest.Mock;
      };
      expect(importFromTrello).toHaveBeenCalledWith(trelloData);
    });
  });

  // ─── 10.24 POST /api/import — format="jira" valid XML string → 201 ──────────

  describe("10.24 POST /api/import — format='jira' valid XML string → 201", () => {
    const JIRA_XML = "<rss><channel><item><summary>Bug</summary></item></channel></rss>";

    it("returns HTTP 201", async () => {
      const res = await POST(makeImportReq({ format: "jira", data: JIRA_XML }));
      expect(res.status).toBe(201);
    });

    it("calls importFromJira with the XML string", async () => {
      await POST(makeImportReq({ format: "jira", data: JIRA_XML }));
      const { importFromJira } = jest.requireMock("@/actions/import-export-actions") as {
        importFromJira: jest.Mock;
      };
      expect(importFromJira).toHaveBeenCalledWith(JIRA_XML);
    });
  });

  // ─── 10.25 POST /api/import — action error bubbles to 400 ───────────────────

  describe("10.25 POST /api/import — action returns { error } → 400", () => {
    it("returns HTTP 400 when importFromJSON returns an error", async () => {
      const { importFromJSON } = jest.requireMock("@/actions/import-export-actions") as {
        importFromJSON: jest.Mock;
      };
      importFromJSON.mockResolvedValueOnce({ error: "Invalid Nexus export file." });

      const res = await POST(makeImportReq({ format: "nexus", data: {} }));
      expect(res.status).toBe(400);
    });

    it("error message from action appears in response body", async () => {
      const { importFromJSON } = jest.requireMock("@/actions/import-export-actions") as {
        importFromJSON: jest.Mock;
      };
      importFromJSON.mockResolvedValueOnce({ error: "Invalid Nexus export file." });

      const res  = await POST(makeImportReq({ format: "nexus", data: {} }));
      const body = await res.json() as { error: string };
      expect(body.error).toBe("Invalid Nexus export file.");
    });
  });

  // ─── 10.26 POST /api/import — jira format with non-string data → 422 ────────

  describe("10.26 POST /api/import — jira format with non-string data → 422", () => {
    it("returns 422 when jira data is an object (not a string)", async () => {
      const res = await POST(makeImportReq({ format: "jira", data: { xml: "..." } }));
      expect(res.status).toBe(422);
    });

    it("returns 422 when jira data is a number", async () => {
      const res = await POST(makeImportReq({ format: "jira", data: 12345 }));
      expect(res.status).toBe(422);
    });
  });

  // ─── 10.27 GET /api/export/[boardId] — unauthorized ─────────────────────────

  describe("10.27 GET /api/export/[boardId] — unauthorized → 401", () => {
    it("returns HTTP 401 when no session", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValueOnce({ userId: null });

      const res = await GET(makeExportReq(BOARD_ID), { params: Promise.resolve({ boardId: BOARD_ID }) });
      expect(res.status).toBe(401);
    });

    it("returns { error: 'Unauthorized' } in body", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValueOnce({ userId: null });

      const res  = await GET(makeExportReq(BOARD_ID), { params: Promise.resolve({ boardId: BOARD_ID }) });
      const body = await res.json() as { error: string };
      expect(body.error).toBe("Unauthorized");
    });
  });

  // ─── 10.28 GET /api/export/[boardId] — default JSON format ──────────────────

  describe("10.28 GET /api/export/[boardId] — default JSON format → 200", () => {
    it("returns HTTP 200", async () => {
      const res = await GET(makeExportReq(BOARD_ID), { params: Promise.resolve({ boardId: BOARD_ID }) });
      expect(res.status).toBe(200);
    });

    it("returns Content-Type: application/json", async () => {
      const res = await GET(makeExportReq(BOARD_ID), { params: Promise.resolve({ boardId: BOARD_ID }) });
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
    });

    it("calls exportBoardAsJSON with the boardId", async () => {
      await GET(makeExportReq(BOARD_ID), { params: Promise.resolve({ boardId: BOARD_ID }) });
      const { exportBoardAsJSON } = jest.requireMock("@/actions/import-export-actions") as {
        exportBoardAsJSON: jest.Mock;
      };
      expect(exportBoardAsJSON).toHaveBeenCalledWith(BOARD_ID);
    });

    it("response body is valid JSON string", async () => {
      const res  = await GET(makeExportReq(BOARD_ID), { params: Promise.resolve({ boardId: BOARD_ID }) });
      const text = await res.text();
      expect(() => JSON.parse(text)).not.toThrow();
    });
  });

  // ─── 10.29 GET /api/export/[boardId] — format=csv → text/csv ────────────────

  describe("10.29 GET /api/export/[boardId] — format=csv → 200 + text/csv", () => {
    it("returns HTTP 200", async () => {
      const res = await GET(makeExportReq(BOARD_ID, "csv"), { params: Promise.resolve({ boardId: BOARD_ID }) });
      expect(res.status).toBe(200);
    });

    it("returns Content-Type: text/csv", async () => {
      const res = await GET(makeExportReq(BOARD_ID, "csv"), { params: Promise.resolve({ boardId: BOARD_ID }) });
      expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    });

    it("calls exportBoardAsCSV with the boardId", async () => {
      await GET(makeExportReq(BOARD_ID, "csv"), { params: Promise.resolve({ boardId: BOARD_ID }) });
      const { exportBoardAsCSV } = jest.requireMock("@/actions/import-export-actions") as {
        exportBoardAsCSV: jest.Mock;
      };
      expect(exportBoardAsCSV).toHaveBeenCalledWith(BOARD_ID);
    });

    it("response body contains CSV content", async () => {
      const res  = await GET(makeExportReq(BOARD_ID, "csv"), { params: Promise.resolve({ boardId: BOARD_ID }) });
      const text = await res.text();
      expect(text).toBe(CSV_CONTENT);
    });
  });

  // ─── 10.30 GET /api/export — board not found → 404 ──────────────────────────

  describe("10.30 GET /api/export/[boardId] — board not found → 404", () => {
    it("returns 404 for JSON format when board not found", async () => {
      const { exportBoardAsJSON } = jest.requireMock("@/actions/import-export-actions") as {
        exportBoardAsJSON: jest.Mock;
      };
      exportBoardAsJSON.mockResolvedValueOnce({ error: "Board not found." });

      const res = await GET(makeExportReq(BOARD_ID), { params: Promise.resolve({ boardId: BOARD_ID }) });
      expect(res.status).toBe(404);
    });

    it("returns 404 for CSV format when board not found", async () => {
      const { exportBoardAsCSV } = jest.requireMock("@/actions/import-export-actions") as {
        exportBoardAsCSV: jest.Mock;
      };
      exportBoardAsCSV.mockResolvedValueOnce({ error: "Board not found." });

      const res = await GET(makeExportReq(BOARD_ID, "csv"), { params: Promise.resolve({ boardId: BOARD_ID }) });
      expect(res.status).toBe(404);
    });
  });

  // ─── 10.31 Content-Disposition filename includes boardId (JSON) ──────────────

  describe("10.31 GET /api/export/[boardId] — Content-Disposition filename includes boardId", () => {
    it("JSON: filename header contains the boardId", async () => {
      const res = await GET(makeExportReq(BOARD_ID), { params: Promise.resolve({ boardId: BOARD_ID }) });
      const disposition = res.headers.get("content-disposition") ?? "";
      expect(disposition).toContain(BOARD_ID);
    });

    it("JSON: Content-Disposition is an attachment", async () => {
      const res = await GET(makeExportReq(BOARD_ID), { params: Promise.resolve({ boardId: BOARD_ID }) });
      const disposition = res.headers.get("content-disposition") ?? "";
      expect(disposition).toMatch(/^attachment/);
    });
  });

  // ─── 10.32 CSV: Content-Disposition filename ends with .csv ─────────────────

  describe("10.32 GET /api/export/[boardId] — CSV Content-Disposition ends with .csv", () => {
    it("filename ends with .csv", async () => {
      const res         = await GET(makeExportReq(BOARD_ID, "csv"), { params: Promise.resolve({ boardId: BOARD_ID }) });
      const disposition = res.headers.get("content-disposition") ?? "";
      expect(disposition).toMatch(/\.csv"/);
    });
  });

  // ─── 10.33 JSON body is the serialised snapshot ──────────────────────────────

  describe("10.33 GET /api/export/[boardId] — JSON body is the serialised snapshot", () => {
    it("parsed response body matches what exportBoardAsJSON returned", async () => {
      const res  = await GET(makeExportReq(BOARD_ID), { params: Promise.resolve({ boardId: BOARD_ID }) });
      const body = await res.json() as typeof JSON_SNAPSHOT;
      expect(body.__nexusExport).toBe("v1");
      expect(body.board.title).toBe("Test Board");
    });
  });

  // ─── 10.34 CSV body is the raw CSV text ──────────────────────────────────────

  describe("10.34 GET /api/export/[boardId] — CSV body is the raw CSV string", () => {
    it("response text equals the CSV string returned by exportBoardAsCSV", async () => {
      const res  = await GET(makeExportReq(BOARD_ID, "csv"), { params: Promise.resolve({ boardId: BOARD_ID }) });
      const text = await res.text();
      expect(text).toContain("List,Card Title");
    });
  });
});
