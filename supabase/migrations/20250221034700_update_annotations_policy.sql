-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.annotations;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.annotations;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.annotations;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.annotations;

-- Create new policies that allow all operations for now
CREATE POLICY "Allow all operations for now" ON public.annotations
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Make sure RLS is enabled but with our new permissive policy
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;

-- Add indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_annotations_frame_id ON public.annotations(frame_id);
CREATE INDEX IF NOT EXISTS idx_annotations_number ON public.annotations(number);

-- Add a trigger to automatically update the updated_at timestamp
DROP TRIGGER IF EXISTS set_updated_at ON public.annotations;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.annotations
    FOR EACH ROW
    EXECUTE FUNCTION public.moddatetime(); 