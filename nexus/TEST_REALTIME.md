# 🧪 Real-Time Testing Guide - Quick Start

## ✅ Prerequisites Complete
- ✅ Supabase credentials added to `.env.local`
- ✅ Dev server running on http://localhost:3000
- ✅ All real-time code implemented

## 🚀 Step 1: Enable Replication (5 minutes)

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**: wgtpbkmptkddqvjghabz
3. **Navigate to**: SQL Editor (left sidebar)
4. **Run this SQL**:

```sql
-- Enable realtime for Card table
ALTER PUBLICATION supabase_realtime ADD TABLE "Card";

-- Enable realtime for List table  
ALTER PUBLICATION supabase_realtime ADD TABLE "List";

-- Verify (should return 2 rows)
SELECT schemaname, tablename, pubname 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('Card', 'List');
```

5. **Expected output**:
```
schemaname | tablename | pubname
-----------+-----------+------------------
public     | Card      | supabase_realtime
public     | List      | supabase_realtime
```

## 🧪 Step 2: Test Real-Time Updates (10 minutes)

### Test 1: Card Creation
1. Open board: http://localhost:3000/board/[your-board-id]
2. Open same board in incognito window (Ctrl+Shift+N)
3. In window 1: Click "+ Add a card" in any list
4. Enter "Test Card" and submit
5. **Expected**: Window 2 shows card appear instantly + toast notification

### Test 2: Card Drag & Drop
1. Keep both windows open
2. In window 1: Drag a card to another list
3. **Expected**: Window 2 shows card move instantly

### Test 3: Card Deletion
1. Keep both windows open
2. In window 1: Click "..." on a card → Delete
3. **Expected**: Window 2 shows card disappear + toast notification

### Test 4: Presence Tracking
1. Open board in window 1
2. Look at top-right corner
3. **Expected**: "🟢 Live" indicator with "1 viewer"
4. Open same board in window 2
5. **Expected**: Both show "2 viewers" with avatar circles

### Test 5: Demo Mode (Already Working)
1. Navigate to: http://localhost:3000/sign-in
2. Click "View Demo (No Signup Required)"
3. Try to create/delete cards
4. **Expected**: Error toast: "Cannot modify demo data"

## 🔍 Troubleshooting

### Issue: No real-time updates
**Check browser console (F12) for:**
- ✅ "Real-time connected to board: [id]" - Connection successful
- ❌ "Real-time connection failed" - Check replication enabled
- ❌ WebSocket error - Check Supabase URL/key

### Issue: "CHANNEL_ERROR" in console
**Solution:**
1. Verify replication SQL ran successfully
2. Check `.env.local` has correct SUPABASE_URL and ANON_KEY
3. Restart dev server: `npm run dev`

### Issue: Presence not showing
**Solution:**
1. Ensure you're signed in (not in demo mode)
2. Check both windows are on exact same board URL
3. Look for "Presence tracking started" in console

### Issue: Cards not updating in real-time
**Solution:**
1. Check Network tab (F12) → Look for WebSocket connection
2. Status should be "101 Switching Protocols"
3. If status is 403/500, replication may not be enabled

## 📊 Success Criteria

- ✅ Console shows: "Real-time connected to board: [id]"
- ✅ Console shows: "Presence tracking started for board: [id]"
- ✅ Top-right shows: "🟢 Live" indicator
- ✅ Creating card in one window → Appears in other window instantly
- ✅ Toast notifications appear for remote changes
- ✅ Presence count updates when opening in multiple windows

## 🎯 Next Steps After Testing

Once real-time is working:

### Priority 3: Optimistic UI (6 hours)
- Install `sonner` ✅ (already done)
- Create `hooks/use-optimistic-action.ts`
- Apply to drag & drop for instant feedback
- Rollback on server errors

### Priority 4: RBAC Enforcement (12 hours)
- Create `lib/rbac.ts` with permissions
- Define roles: OWNER, ADMIN, MEMBER, GUEST
- Update middleware to check roles
- Apply permission checks to all actions

## 📝 Testing Checklist

- [ ] SQL replication enabled (2 tables)
- [ ] Console shows real-time connection
- [ ] Card creation syncs across windows
- [ ] Card drag & drop syncs instantly
- [ ] Card deletion syncs with toast
- [ ] Presence shows online count
- [ ] Avatars visible at top-right
- [ ] Demo mode blocks mutations

**Current Status:** Real-time implementation complete, ready for testing! 🚀
