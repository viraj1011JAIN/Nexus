# Real-Time Connection Troubleshooting

## Problem
Your real-time WebSocket connection is timing out with these errors:
```
⏱️ Real-time connection timed out for board: ea0e0448-e957-4833-9179-d1c3c13eecba
❌ Presence tracking failed for board: ea0e0448-e957-4833-9179-d1c3c13eecba
```

## Root Cause
**Supabase Realtime is not properly enabled**. You enabled Publications for replication, but didn't enable the **Realtime API** itself.

---

## Fix: Enable Supabase Realtime API

### Step 1: Go to Supabase Database Settings
1. Go to: https://supabase.com/dashboard/project/wgtpbkmptkddqvjghabz/settings/api
2. Look for **"Realtime"** section (NOT Database → Publications)

### Step 2: Enable Realtime for Tables
You need to enable Realtime API at the **API level**, not just Publications:

1. **Option A: Via Supabase Dashboard**
   - Go to: **Database** → **Replication** → **Enable Realtime**
   - Enable for tables: `Card` and `List`
   - Toggle **"Enable Realtime"** (not just "Enable Replication")

2. **Option B: Via SQL (RECOMMENDED)**
   Run this SQL in your Supabase SQL Editor:

```sql
-- Enable Realtime for Card table
ALTER TABLE "Card" REPLICA IDENTITY FULL;

-- Enable Realtime for List table  
ALTER TABLE "List" REPLICA IDENTITY FULL;

-- Verify Realtime is enabled
SELECT 
    schemaname, 
    tablename, 
    attrelid::regclass AS table_name,
    case relreplident
        when 'd' then 'default'
        when 'f' then 'full'
        when 'i' then 'index'
        when 'n' then 'nothing'
    end as replica_identity
FROM pg_attribute
JOIN pg_class ON pg_attribute.attrelid = pg_class.oid
WHERE pg_class.relname IN ('Card', 'List')
AND pg_attribute.attnum > 0
AND NOT pg_attribute.attisdropped
GROUP BY schemaname, tablename, attrelid, relreplident;
```

### Step 3: Verify Realtime Extension
Run this in SQL Editor to confirm Realtime extension is enabled:

```sql
-- Check if realtime extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_logical_emitter_adapter';

-- If not found, enable it (usually already enabled by Supabase)
-- CREATE EXTENSION IF NOT EXISTS pg_logical_emitter_adapter;
```

---

## Step 4: Check Realtime API Endpoint

1. Go to **Settings** → **API** in Supabase Dashboard
2. Verify the **Realtime URL** is shown (should be `wss://wgtpbkmptkddqvjghabz.supabase.co/realtime/v1`)
3. If missing, contact Supabase support to enable Realtime for your project

---

## Step 5: Test WebSocket Connection

After enabling Realtime, refresh your browser (Ctrl+Shift+R) and check console:

### ✅ Expected Success Output:
```
🔌 Attempting to connect to board: ea0e0448-e957-4833-9179-d1c3c13eecba
✅ Real-time connected to board: ea0e0448-e957-4833-9179-d1c3c13eecba
👁️ Presence tracking started for board: ea0e0448-e957-4833-9179-d1c3c13eecba
```

### ❌ Still Seeing Timeout?
If you still see timeout errors after enabling Realtime:

1. **Check Supabase Project Status**
   - Go to: https://status.supabase.com
   - Verify no outages in EU-WEST-2 region

2. **Verify Anon Key Permissions**
   - Your anon key needs `realtime` permissions
   - Check: **Settings** → **API** → **Project API keys**
   - Anon key should have `realtime.*` scope

3. **Check RLS Policies**
   - Realtime requires Row Level Security (RLS) to be disabled OR proper policies set
   - Run this SQL to check:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename IN ('Card', 'List');
   ```
   - If `rowsecurity` is `true`, you need RLS policies or disable it:
   ```sql
   ALTER TABLE "Card" DISABLE ROW LEVEL SECURITY;
   ALTER TABLE "List" DISABLE ROW LEVEL SECURITY;
   ```

---

## Step 6: Verify Browser DevTools

Open DevTools (F12) → **Network** tab → **WS** filter:

### ✅ Success Signs:
- WebSocket connection to `wss://wgtpbkmptkddqvjghabz.supabase.co/realtime/v1`
- Status: **101 Switching Protocols**
- Messages: `{"type":"system","event":"phx_reply","payload":{"status":"ok"}}`

### ❌ Failure Signs:
- No WebSocket connection listed
- Status: **400 Bad Request** or **403 Forbidden**
- Connection immediately closes

---

## Alternative: Check if Realtime is Enabled on Your Plan

Some Supabase plans don't include Realtime by default:

1. Go to: **Settings** → **Billing**
2. Check your plan includes **Realtime** feature
3. If using Free plan, Realtime should be included (up to 200 concurrent connections)
4. If missing, upgrade to Pro plan ($25/month)

---

## Quick Debug Test

Run this test in your browser console (F12):

```javascript
// Test direct Supabase connection
const { createClient } = window.supabase;
const supabase = createClient(
  'https://wgtpbkmptkddqvjghabz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndndHBia21wdGtkZHF2amdoYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyODE3NjcsImV4cCI6MjA4NDg1Nzc2N30.7y9sqsXFr4S8qOFdjiciGKbUeNIjWYmbpU_HwWgpHNc'
);

const channel = supabase
  .channel('test-channel')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'Card' }, (payload) => {
    console.log('✅ Realtime working!', payload);
  })
  .subscribe((status) => {
    console.log('Channel status:', status);
  });

// Wait 5 seconds, then check
setTimeout(() => {
  console.log('Channel state:', channel.state);
  // Should show: "joined" if working
}, 5000);
```

If it shows `"joined"` → Realtime is working, issue is in your code
If it shows `"errored"` or `"closed"` → Realtime not enabled on Supabase

---

## Next Steps After Fix

Once Realtime is working:

1. **Refresh both browser windows** (normal + incognito)
2. **Create a card** in one window
3. **Watch it appear instantly** in the other window
4. **Check top-right** for "🟢 Live" indicator with "2 viewers"
5. **Open console** to verify:
   ```
   ✅ Real-time connected to board: [id]
   👁️ Presence tracking started for board: [id]
   ```

---

## Summary: What You Need To Do

1. ✅ **Enable REPLICA IDENTITY FULL** for Card and List tables (SQL above)
2. ✅ **Verify Realtime extension** is installed (`pg_logical_emitter_adapter`)
3. ✅ **Check Realtime API endpoint** is available in Settings → API
4. ✅ **Disable RLS** or add proper policies for Card and List tables
5. ✅ **Refresh browser** and test again

The most common issue is **forgetting to run `ALTER TABLE REPLICA IDENTITY FULL`** - this is different from enabling Publications.
