-- ============================================
-- Enable Supabase Realtime for NEXUS Tables
-- ============================================
-- Run this in Supabase Dashboard > SQL Editor
-- This enables real-time broadcasts for table changes

-- Enable realtime for boards table
ALTER PUBLICATION supabase_realtime ADD TABLE "boards";

-- Enable realtime for cards table
ALTER PUBLICATION supabase_realtime ADD TABLE "cards";

-- Enable realtime for lists table  
ALTER PUBLICATION supabase_realtime ADD TABLE "lists";

-- Verify replication is enabled (should return 3 rows)
SELECT 
  schemaname, 
  tablename, 
  pubname 
FROM 
  pg_publication_tables 
WHERE 
  pubname = 'supabase_realtime' 
  AND tablename IN ('boards', 'cards', 'lists');

-- If no rows returned, check if publication exists:
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- Alternative: Check all tables in the publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- ============================================
-- Expected Output:
-- schemaname | tablename | pubname
-- -----------+-----------+------------------
-- public     | boards    | supabase_realtime
-- public     | cards     | supabase_realtime
-- public     | lists     | supabase_realtime
-- ============================================
