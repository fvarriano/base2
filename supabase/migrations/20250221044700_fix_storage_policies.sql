-- Drop existing storage policies
DROP POLICY IF EXISTS "Allow public read access to frames" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to frames" ON storage.objects;
DROP POLICY IF EXISTS "Allow all uploads to frames" ON storage.objects;

-- Create new storage policies with proper access
CREATE POLICY "Enable public read access to frames"
ON storage.objects FOR SELECT
USING (bucket_id = 'frames');

CREATE POLICY "Enable all operations on frames"
ON storage.objects FOR ALL
USING (bucket_id = 'frames')
WITH CHECK (bucket_id = 'frames');

-- Ensure frames bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('frames', 'frames', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Ensure proper indexes exist on the frames table
CREATE INDEX IF NOT EXISTS idx_frames_video_id ON public.frames(video_id);
CREATE INDEX IF NOT EXISTS idx_frames_storage_path ON public.frames(storage_path);

-- Update existing frame records to ensure consistent paths
UPDATE public.frames
SET storage_path = CONCAT(
    (SELECT project_id FROM public.videos WHERE videos.id = frames.video_id),
    '/',
    frames.video_id,
    '/frame_',
    frames.frame_number,
    '.jpg'
)
WHERE storage_path NOT LIKE '%/frame_%.jpg'; 