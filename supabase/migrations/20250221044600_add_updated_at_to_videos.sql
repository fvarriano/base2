-- First, make sure the moddatetime extension exists
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS videos_updated_at ON public.videos;
DROP TRIGGER IF EXISTS handle_updated_at ON public.videos;

-- Add updated_at column if it doesn't exist
ALTER TABLE public.videos
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Make updated_at not null
ALTER TABLE public.videos
    ALTER COLUMN updated_at SET NOT NULL;

-- Create the trigger for automatic updates
CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON public.videos
    FOR EACH ROW
    EXECUTE FUNCTION moddatetime('updated_at');

-- Update the video status update policy
DROP POLICY IF EXISTS "Allow all operations" ON public.videos;
CREATE POLICY "Allow all operations" ON public.videos
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Make sure storage policies are correct for videos
DROP POLICY IF EXISTS "Allow public read access to videos" ON storage.objects;
CREATE POLICY "Allow public read access to videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "Allow all uploads to videos" ON storage.objects;
CREATE POLICY "Allow all uploads to videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'videos'); 