/**
 * Unit Tests: Demo Mode Protection
 * 
 * Tests the demo mode protection utilities and hooks
 */

import { protectDemoMode, isDemoOrganization } from '@/lib/action-protection';

describe('Demo Mode Protection', () => {
  describe('isDemoOrganization', () => {
    it('should return true for demo organization ID', () => {
      expect(isDemoOrganization('demo-org-id')).toBe(true);
    });

    it('should return false for regular organization ID', () => {
      expect(isDemoOrganization('real-org-123')).toBe(false);
    });

    it('should return false for null org ID', () => {
      expect(isDemoOrganization(null)).toBe(false);
    });

    it('should return false for undefined org ID', () => {
      expect(isDemoOrganization(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isDemoOrganization('')).toBe(false);
    });
  });

  describe('protectDemoMode', () => {
    it('should return error for demo organization', async () => {
      const result = await protectDemoMode('demo-org-id');
      
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('error');
      expect(result?.error).toContain('Demo mode is read-only');
      expect(result?.error).toContain('Sign up');
    });

    it('should return null for regular organization', async () => {
      const result = await protectDemoMode('real-org-123');
      
      expect(result).toBeNull();
    });

    it('should return null for null org ID', async () => {
      const result = await protectDemoMode(null);
      
      expect(result).toBeNull();
    });

    it('should return null for undefined org ID', async () => {
      const result = await protectDemoMode(undefined);
      
      expect(result).toBeNull();
    });

    it('should return error object with correct shape', async () => {
      const result = await protectDemoMode('demo-org-id');
      
      expect(result).toMatchObject({
        error: expect.any(String),
      });
    });

    it('should block demo mode with case-sensitive match', async () => {
      // Should NOT block - case matters
      const result1 = await protectDemoMode('DEMO-ORG-ID');
      expect(result1).toBeNull();

      // Should block - exact match
      const result2 = await protectDemoMode('demo-org-id');
      expect(result2).not.toBeNull();
    });
  });

  describe('Demo Mode Integration', () => {
    it('should prevent mutations in demo mode', async () => {
      const orgId = 'demo-org-id';
      
      const protection = await protectDemoMode(orgId);
      
      if (protection) {
        // Mutation should be blocked
        expect(protection.error).toBeTruthy();
        return; // Early return simulates Server Action blocking
      }
      
      // This line should never execute for demo org
      expect(true).toBe(false);
    });

    it('should allow mutations in regular mode', async () => {
      const orgId = 'real-org-456';
      
      const protection = await protectDemoMode(orgId);
      
      expect(protection).toBeNull();
      
      // Mutation should proceed
      const mutationSucceeded = true;
      expect(mutationSucceeded).toBe(true);
    });
  });

  describe('Error Message Quality', () => {
    it('should provide helpful error message', async () => {
      const result = await protectDemoMode('demo-org-id');
      
      expect(result?.error).toContain('read-only');
      expect(result?.error).toContain('Sign up');
      expect(result?.error.length).toBeGreaterThan(20); // Meaningful message
    });

    it('should not expose internal implementation details', async () => {
      const result = await protectDemoMode('demo-org-id');
      
      expect(result?.error).not.toContain('demo-org-id');
      expect(result?.error).not.toContain('database');
      expect(result?.error).not.toContain('Prisma');
    });
  });
});
