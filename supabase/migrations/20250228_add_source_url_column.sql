-- Add source_url column to videos table
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Create RLS policies if they don't exist
-- First, drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for all users" ON videos;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON videos;
DROP POLICY IF EXISTS "Enable update for users based on project_id" ON videos;

-- Create new policies
CREATE POLICY "Enable read access for all users" ON videos
FOR SELECT
USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON videos
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for users based on project_id" ON videos
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema'; 