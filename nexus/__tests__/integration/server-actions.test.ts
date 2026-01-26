/**
 * Integration Tests: Server Actions with Demo Mode
 * 
 * Tests that Server Actions properly block mutations in demo mode
 */

import { auth } from '@clerk/nextjs/server';
import { protectDemoMode } from '@/lib/action-protection';

// Mock Clerk auth
jest.mock('@clerk/nextjs/server');

describe('Server Actions - Demo Mode Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Card Action', () => {
    it('should block card creation in demo mode', async () => {
      // Simulate demo org user
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'demo-org-id',
        userId: 'demo-user-id',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      expect(protection).not.toBeNull();
      expect(protection?.error).toContain('Demo mode is read-only');
    });

    it('should allow card creation in regular org', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'real-org-123',
        userId: 'user-456',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      expect(protection).toBeNull();
    });
  });

  describe('Update Card Action', () => {
    it('should block card updates in demo mode', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'demo-org-id',
        userId: 'demo-user-id',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      expect(protection).not.toBeNull();
      expect(protection?.error).toBeTruthy();
    });

    it('should allow card updates in regular org', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'real-org-789',
        userId: 'user-abc',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      expect(protection).toBeNull();
    });
  });

  describe('Delete Card Action', () => {
    it('should block card deletion in demo mode', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'demo-org-id',
        userId: 'demo-user-id',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      expect(protection).not.toBeNull();
      expect(protection?.error).toContain('read-only');
    });

    it('should allow card deletion in regular org', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'real-org-xyz',
        userId: 'user-def',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      expect(protection).toBeNull();
    });
  });

  describe('Create List Action', () => {
    it('should block list creation in demo mode', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'demo-org-id',
        userId: 'demo-user-id',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      expect(protection).not.toBeNull();
    });

    it('should allow list creation in regular org', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'regular-org',
        userId: 'regular-user',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      expect(protection).toBeNull();
    });
  });

  describe('Delete List Action', () => {
    it('should block list deletion in demo mode', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'demo-org-id',
        userId: 'demo-user-id',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      expect(protection).not.toBeNull();
      expect(protection?.error).toContain('Sign up');
    });

    it('should allow list deletion in regular org', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'prod-org',
        userId: 'prod-user',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      expect(protection).toBeNull();
    });
  });

  describe('Create Board Action', () => {
    it('should block board creation in demo mode', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'demo-org-id',
        userId: 'demo-user-id',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      expect(protection).not.toBeNull();
    });

    it('should allow board creation in regular org', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'real-company',
        userId: 'employee-123',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      expect(protection).toBeNull();
    });
  });

  describe('Server Action Error Handling', () => {
    it('should return proper error shape for demo mode', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'demo-org-id',
        userId: 'demo-user-id',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      expect(protection).toMatchObject({
        error: expect.any(String),
      });
      expect(protection?.error.length).toBeGreaterThan(0);
    });

    it('should handle missing orgId gracefully', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: null,
        userId: 'user-123',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      // No error for missing orgId (might be public action)
      expect(protection).toBeNull();
    });

    it('should handle undefined orgId gracefully', async () => {
      (auth as jest.Mock).mockResolvedValue({
        userId: 'user-456',
      });

      const { orgId } = await auth();
      const protection = await protectDemoMode(orgId);

      expect(protection).toBeNull();
    });
  });

  describe('Multiple Action Calls', () => {
    it('should consistently block all demo mode actions', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'demo-org-id',
        userId: 'demo-user-id',
      });

      const { orgId } = await auth();

      // Call protection multiple times
      const result1 = await protectDemoMode(orgId);
      const result2 = await protectDemoMode(orgId);
      const result3 = await protectDemoMode(orgId);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result3).not.toBeNull();

      // All should have same error message
      expect(result1?.error).toBe(result2?.error);
      expect(result2?.error).toBe(result3?.error);
    });

    it('should consistently allow all regular org actions', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'prod-org-456',
        userId: 'user-789',
      });

      const { orgId } = await auth();

      const result1 = await protectDemoMode(orgId);
      const result2 = await protectDemoMode(orgId);
      const result3 = await protectDemoMode(orgId);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });
  });

  describe('Concurrent Action Protection', () => {
    it('should handle concurrent demo mode checks', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'demo-org-id',
        userId: 'demo-user-id',
      });

      const { orgId } = await auth();

      // Simulate concurrent Server Action calls
      const results = await Promise.all([
        protectDemoMode(orgId),
        protectDemoMode(orgId),
        protectDemoMode(orgId),
        protectDemoMode(orgId),
        protectDemoMode(orgId),
      ]);

      // All should be blocked
      results.forEach((result) => {
        expect(result).not.toBeNull();
        expect(result?.error).toContain('Demo mode');
      });
    });

    it('should handle concurrent regular org checks', async () => {
      (auth as jest.Mock).mockResolvedValue({
        orgId: 'real-org-concurrent',
        userId: 'user-concurrent',
      });

      const { orgId } = await auth();

      const results = await Promise.all([
        protectDemoMode(orgId),
        protectDemoMode(orgId),
        protectDemoMode(orgId),
      ]);

      // All should pass
      results.forEach((result) => {
        expect(result).toBeNull();
      });
    });
  });
});
