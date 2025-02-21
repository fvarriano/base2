-- Update storage policies to ensure persistence
CREATE POLICY "Allow public read access to frames forever"
ON storage.objects FOR SELECT
USING (bucket_id = 'frames');

CREATE POLICY "Allow authenticated uploads to frames forever"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'frames');

-- Ensure frames table has RLS enabled
ALTER TABLE public.frames ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for frames
CREATE POLICY "Enable read access for all users" ON public.frames
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.frames
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add cascade delete for frames when video is deleted
ALTER TABLE public.frames
    DROP CONSTRAINT IF EXISTS frames_video_id_fkey,
    ADD CONSTRAINT frames_video_id_fkey
        FOREIGN KEY (video_id)
        REFERENCES public.videos(id)
        ON DELETE CASCADE;

-- Add cascade delete for annotations when frame is deleted
ALTER TABLE public.annotations
    DROP CONSTRAINT IF EXISTS annotations_frame_id_fkey,
    ADD CONSTRAINT annotations_frame_id_fkey
        FOREIGN KEY (frame_id)
        REFERENCES public.frames(id)
        ON DELETE CASCADE; 