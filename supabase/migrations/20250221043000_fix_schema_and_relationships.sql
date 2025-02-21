-- Ensure videos table exists with correct schema
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure frames table exists with correct schema
CREATE TABLE IF NOT EXISTS public.frames (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    frame_number INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure annotations table exists with correct schema
CREATE TABLE IF NOT EXISTS public.annotations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    frame_id UUID REFERENCES public.frames(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    x NUMERIC NOT NULL,
    y NUMERIC NOT NULL,
    text TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_frames_video_id ON public.frames(video_id);
CREATE INDEX IF NOT EXISTS idx_annotations_frame_id ON public.annotations(frame_id);

-- Update storage policies
DROP POLICY IF EXISTS "Allow public read access to frames" ON storage.objects;
CREATE POLICY "Allow public read access to frames"
ON storage.objects FOR SELECT
USING (bucket_id = 'frames');

DROP POLICY IF EXISTS "Allow all uploads to frames" ON storage.objects;
CREATE POLICY "Allow all uploads to frames"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'frames');

-- Enable RLS on all tables
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for now
CREATE POLICY "Allow all operations" ON public.videos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.frames FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.annotations FOR ALL USING (true) WITH CHECK (true);

-- Create extension for updated_at functionality
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS videos_updated_at ON public.videos;
CREATE TRIGGER videos_updated_at
    BEFORE UPDATE ON public.videos
    FOR EACH ROW
    EXECUTE PROCEDURE moddatetime(updated_at);

DROP TRIGGER IF EXISTS annotations_updated_at ON public.annotations;
CREATE TRIGGER annotations_updated_at
    BEFORE UPDATE ON public.annotations
    FOR EACH ROW
    EXECUTE PROCEDURE moddatetime(updated_at); 