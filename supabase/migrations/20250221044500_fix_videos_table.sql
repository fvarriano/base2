-- Drop existing triggers first
DROP TRIGGER IF EXISTS videos_updated_at ON public.videos;
DROP TRIGGER IF EXISTS handle_updated_at ON public.videos;

-- Make sure updated_at exists and has the right type
ALTER TABLE public.videos 
    ALTER COLUMN updated_at SET DATA TYPE TIMESTAMPTZ,
    ALTER COLUMN updated_at SET DEFAULT now(),
    ALTER COLUMN updated_at SET NOT NULL;

-- Create the moddatetime trigger properly
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