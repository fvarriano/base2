-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.frames;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.frames;

-- Create new policies that allow all operations for now
CREATE POLICY "Allow all operations for now" ON public.frames
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Update storage policies to ensure frames can be uploaded
DROP POLICY IF EXISTS "Allow authenticated uploads to frames forever" ON storage.objects;
CREATE POLICY "Allow all uploads to frames" ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'frames');

-- Ensure the frames table exists and has RLS enabled
ALTER TABLE public.frames ENABLE ROW LEVEL SECURITY; 