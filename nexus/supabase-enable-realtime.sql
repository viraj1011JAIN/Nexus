-- ============================================
-- Enable Supabase Realtime for NEXUS Tables
-- ============================================
-- Run this in Supabase Dashboard > SQL Editor
-- This enables real-time broadcasts for table changes

-- Enable realtime for Card table
ALTER PUBLICATION supabase_realtime ADD TABLE "Card";

-- Enable realtime for List table  
ALTER PUBLICATION supabase_realtime ADD TABLE "List";

-- Verify replication is enabled (should return 2 rows)
SELECT 
  schemaname, 
  tablename, 
  pubname 
FROM 
  pg_publication_tables 
WHERE 
  pubname = 'supabase_realtime' 
  AND tablename IN ('Card', 'List');

-- ============================================
-- Expected Output:
-- schemaname | tablename | pubname
-- -----------+-----------+------------------
-- public     | Card      | supabase_realtime
-- public     | List      | supabase_realtime
-- ============================================
