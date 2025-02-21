-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Set up video storage policies
CREATE POLICY "Allow public read access to videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

CREATE POLICY "Allow authenticated uploads to videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'videos');

-- Set up frame storage policies
CREATE POLICY "Allow public read access to frames"
ON storage.objects FOR SELECT
USING (bucket_id = 'frames');

CREATE POLICY "Allow authenticated uploads to frames"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'frames'); 