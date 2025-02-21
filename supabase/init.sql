-- Create the projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    title TEXT NOT NULL,
    description TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for now
-- You can make this more restrictive later when adding authentication
CREATE POLICY "Allow all operations for now" ON projects
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Enable storage
CREATE EXTENSION IF NOT EXISTS "storage" SCHEMA "extensions";

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('frames', 'frames', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Allow public read access to videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

CREATE POLICY "Allow authenticated uploads to videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Allow public read access to frames"
ON storage.objects FOR SELECT
USING (bucket_id = 'frames');

CREATE POLICY "Allow authenticated uploads to frames"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'frames');

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; 