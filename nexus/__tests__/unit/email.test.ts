/**
 * Unit Tests: Email Delivery (lib/email.ts)
 *
 * Tests the sendEmail helper and notification formatters
 * without calling external APIs — all Resend calls are mocked.
 */

// Mock the Resend SDK before importing the module under test
jest.mock("resend", () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn().mockResolvedValue({ data: { id: "test-email-id" }, error: null }),
      },
    })),
  };
});

// Provide a fake API key so the lazy-init guard passes
process.env.RESEND_API_KEY = "re_test_key";
process.env.EMAIL_FROM = "Test <test@example.com>";

// Reset module registry before each test so the singleton is re-created
beforeEach(() => {
  jest.resetModules();
});

describe("sendEmail", () => {
  it("returns id on success", async () => {
    const { sendEmail } = await import("@/lib/email");
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });
    expect(result.id).toBe("test-email-id");
    expect(result.error).toBeUndefined();
  });

  it("accepts array of recipients", async () => {
    const { Resend } = await import("resend");
    const { sendEmail } = await import("@/lib/email");
    const mockSend = jest.fn().mockResolvedValue({ data: { id: "abc" }, error: null });
    (Resend as jest.Mock).mockImplementation(() => ({ emails: { send: mockSend } }));

    await sendEmail({ to: ["a@x.com", "b@x.com"], subject: "Multi", html: "<p>Hi</p>" });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["a@x.com", "b@x.com"] })
    );
  });

  it("returns error when Resend reports error", async () => {
    const { Resend } = await import("resend");
    (Resend as jest.Mock).mockImplementation(() => ({
      emails: {
        send: jest.fn().mockResolvedValue({ data: null, error: { message: "Invalid key" } }),
      },
    }));
    const { sendEmail } = await import("@/lib/email");
    const result = await sendEmail({ to: "x@x.com", subject: "Fail", html: "<p>X</p>" });
    expect(result.error).toBe("Invalid key");
  });

  it("throws when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import("@/lib/email");
    const result = await sendEmail({ to: "x@x.com", subject: "x", html: "<p>x</p>" });
    expect(result.error).toMatch(/RESEND_API_KEY/);
    process.env.RESEND_API_KEY = "re_test_key";
  });
});

describe("sendMentionEmail", () => {
  it("uses correct subject and recipient", async () => {
    const { Resend } = await import("resend");
    const mockSend = jest.fn().mockResolvedValue({ data: { id: "mention-1" }, error: null });
    (Resend as jest.Mock).mockImplementation(() => ({ emails: { send: mockSend } }));
    const { sendMentionEmail } = await import("@/lib/email");

    await sendMentionEmail({
      mentionedUserEmail: "mentioned@example.com",
      mentionedUserName: "Alice",
      mentionerName: "Bob",
      cardTitle: "Fix the bug",
      boardTitle: "Sprint 1",
      cardUrl: "https://app.example.com/board/123",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["mentioned@example.com"],
        subject: 'Bob mentioned you in "Fix the bug"',
      })
    );
  });
});

describe("sendDueDateReminderEmail", () => {
  it("sends reminder with correct subject", async () => {
    const { Resend } = await import("resend");
    const mockSend = jest.fn().mockResolvedValue({ data: { id: "due-1" }, error: null });
    (Resend as jest.Mock).mockImplementation(() => ({ emails: { send: mockSend } }));
    const { sendDueDateReminderEmail } = await import("@/lib/email");

    await sendDueDateReminderEmail({
      userEmail: "dev@example.com",
      userName: "Charlie",
      cardTitle: "Deploy to production",
      boardTitle: "Q1 Roadmap",
      dueDate: new Date("2026-03-01T10:00:00Z"),
      cardUrl: "https://app.example.com/board/x",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["dev@example.com"],
        subject: 'Reminder: "Deploy to production" is due soon',
      })
    );
  });
});

describe("sendWeeklyDigestEmail", () => {
  it("sends weekly digest with stats", async () => {
    const { Resend } = await import("resend");
    const mockSend = jest.fn().mockResolvedValue({ data: { id: "digest-1" }, error: null });
    (Resend as jest.Mock).mockImplementation(() => ({ emails: { send: mockSend } }));
    const { sendWeeklyDigestEmail } = await import("@/lib/email");

    await sendWeeklyDigestEmail({
      userEmail: "pm@example.com",
      userName: "Dave",
      stats: { cardsCreated: 10, cardsCompleted: 8, overdueCards: 2, activeBoards: 3 },
      appUrl: "https://app.example.com",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["pm@example.com"],
        subject: "Your Nexus weekly summary",
      })
    );
  });
});
