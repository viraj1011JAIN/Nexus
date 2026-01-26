# 🧪 Demo Mode Testing Guide

## ✅ What's Been Implemented

### 1. **Production-Grade Seed Script** (`scripts/seed-demo.ts`)
- ✅ Transaction-based (all-or-nothing with automatic rollback)
- ✅ Idempotent operations (can run multiple times safely)
- ✅ Demo organization with PRO plan
- ✅ Sample board: "Product Roadmap Q1 2026"
- ✅ 3 lists: Backlog, In Progress, Done
- ✅ 10 realistic cards with labels, priorities, descriptions
- ✅ Comprehensive audit logs
- ✅ Console logging with emojis for debugging

### 2. **Demo Mode Hook** (`hooks/use-demo-mode.ts`)
- ✅ Client-side demo detection via pathname
- ✅ Session storage management
- ✅ Analytics tracking integration
- ✅ Toast notification helpers
- ✅ Server-side helpers: `isDemoOrganization()`, `assertNotDemoMode()`

### 3. **Enhanced Sign-In Page** (`app/sign-in/[[...sign-in]]/page.tsx`)
- ✅ Client component with loading states
- ✅ Demo button with gradient styling
- ✅ Loading spinner animation
- ✅ Session storage integration
- ✅ Analytics tracking on demo start
- ✅ Info box explaining demo mode

### 4. **Middleware Protection** (`proxy.ts`)
- ✅ Demo org added to public routes (unauthenticated access)
- ✅ Mutation blocking for non-GET/HEAD requests
- ✅ Returns 403 JSON response with error message
- ✅ Covers all board/list/card/stripe routes

### 5. **Server Action Protection** (`lib/action-protection.ts`)
- ✅ `protectDemoMode<T>()` - Returns ActionState error if demo org
- ✅ `protectAction()` - Combined auth + demo check
- ✅ TypeScript generics for type safety
- ✅ Consistent error format across all actions

### 6. **Protected Actions** (Applied to all mutation actions)
- ✅ `actions/create-board.ts`
- ✅ `actions/create-list.ts`
- ✅ `actions/create-card.ts`
- ✅ `actions/update-list.ts`
- ✅ `actions/update-card.ts`
- ✅ `actions/update-card-order.ts`
- ✅ `actions/update-list-order.ts`
- ✅ `actions/delete-list.ts`
- ✅ `actions/delete-card.ts`

---

## 🧪 Testing Steps

### Phase 1: Verify Seed Data (Already Done ✅)
```bash
cd C:\Nexus\nexus
npx tsx scripts/seed-demo.ts
```

**Expected Output:**
```
🚀 Starting demo organization seed...
✅ Demo user created: demo@nexus-demo.com
✅ Organization created: Demo Company (Guest Mode)
✅ Board created: Product Roadmap Q1 2026
✅ Created 10 cards with labels
✅ Created audit logs
🎉 Demo organization seeded successfully!
```

### Phase 2: Start Development Server
```bash
cd C:\Nexus\nexus
npm run dev
```

### Phase 3: Test Demo Button
1. Navigate to: http://localhost:3000/sign-in
2. Click "View Demo (No Signup Required)" button
3. **Expected:** Redirects to `/organization/demo-org-id`
4. **Expected:** See "Product Roadmap Q1 2026" board
5. **Expected:** See 3 lists: Backlog (5 cards), In Progress (3 cards), Done (2 cards)

### Phase 4: Test Read-Only Enforcement
Try to perform mutations (should all fail gracefully):

#### Test 1: Create New Card
1. Click "+ Add a card" in any list
2. Enter title and submit
3. **Expected:** Error toast: "Cannot modify demo data"
4. **Expected:** Card NOT created

#### Test 2: Delete Card
1. Click "..." on any card
2. Click "Delete"
3. **Expected:** Error toast: "Cannot modify demo data"
4. **Expected:** Card NOT deleted

#### Test 3: Drag & Drop Card
1. Drag a card to another list
2. **Expected:** UI updates optimistically (temporary)
3. **Expected:** Reverts back with error message
4. **Expected:** Card stays in original position

#### Test 4: Create New List
1. Click "+ Add a list"
2. Enter title and submit
3. **Expected:** Error toast: "Cannot modify demo data"
4. **Expected:** List NOT created

#### Test 5: Update Card Description
1. Click on a card to open modal
2. Try to edit description
3. **Expected:** Error toast: "Cannot modify demo data"
4. **Expected:** Description NOT updated

### Phase 5: Verify Session Storage
1. Open DevTools → Application → Session Storage
2. **Expected keys:**
   - `demo-mode`: "true"
   - `demo-start-time`: timestamp

### Phase 6: Verify Analytics (if enabled)
1. Open DevTools → Console
2. Look for analytics event
3. **Expected:** `Guest Demo Started` event with timestamp

### Phase 7: Test Sign-Up Flow
1. Go back to sign-in page
2. Click "Sign up" to register
3. Create real account
4. **Expected:** Can create/modify boards without restrictions

---

## 🐛 Troubleshooting

### Issue: Seed script fails with "Prisma client not found"
**Solution:**
```bash
cd C:\Nexus\nexus
npx prisma generate
npx tsx scripts/seed-demo.ts
```

### Issue: Demo button doesn't navigate
**Solution:** Check console for errors, verify DEMO_ORG_ID matches database

### Issue: Can still modify demo data
**Solution:** Check middleware is running, verify demo-org-id in URL

### Issue: 403 errors on demo board
**Solution:** Verify demo org is added to `isPublicRoute` in `proxy.ts`

---

## 📊 Success Criteria

- ✅ Seed script runs without errors
- ✅ Demo button navigates to demo board
- ✅ Demo board displays 10 cards across 3 lists
- ✅ All mutation attempts return error messages
- ✅ Data remains unchanged after mutation attempts
- ✅ Session storage flags are set correctly
- ✅ No console errors during demo session
- ✅ Regular sign-up flow works normally

---

## 🚀 Next Steps After Testing

### Priority 2: Real-Time Collaboration (8 hours)
1. Configure Supabase Realtime on `cards` and `lists` tables
2. Create `lib/supabase/client.ts` with `createClient()`
3. Create `hooks/use-realtime-board.ts` with `postgres_changes` subscription
4. Create `hooks/use-presence.ts` for online users
5. Add presence indicators to board UI

### Priority 3: Optimistic UI (6 hours)
1. Install `sonner`: `npm install sonner`
2. Create `hooks/use-optimistic-action.ts` with `experimental_useOptimistic`
3. Apply to card operations in `card-item.tsx`
4. Add toast notifications for success/error
5. Implement rollback on server error

### Priority 4: RBAC Enforcement (12 hours)
1. Create `lib/rbac.ts` with PERMISSIONS object
2. Define permissions: BOARD_DELETE, CARD_EDIT, MEMBER_MANAGE, etc.
3. Create `hasPermission(role, action)` helper
4. Update `proxy.ts` to check roles
5. Add permission checks to all Server Actions

---

## 📝 Testing Checklist

- [ ] Seed script executed successfully
- [ ] Dev server running on port 3000
- [ ] Demo button visible on sign-in page
- [ ] Clicking demo button navigates to demo board
- [ ] Board displays all 10 cards correctly
- [ ] Create card mutation blocked
- [ ] Delete card mutation blocked
- [ ] Drag & drop mutation blocked
- [ ] Create list mutation blocked
- [ ] Update description mutation blocked
- [ ] Session storage flags set
- [ ] No console errors
- [ ] Regular sign-up flow works

**Status:** Ready for testing! 🚀
