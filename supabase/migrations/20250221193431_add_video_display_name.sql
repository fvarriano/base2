-- Add display_name column to videos table
ALTER TABLE public.videos 
    ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Update existing records to have a default display name based on creation date
UPDATE public.videos
SET display_name = CONCAT('Video Upload - ', TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI'))
WHERE display_name IS NULL;

-- Make display_name not null after setting defaults
ALTER TABLE public.videos
    ALTER COLUMN display_name SET NOT NULL;

-- Add index for better querying
CREATE INDEX IF NOT EXISTS idx_videos_display_name ON public.videos(display_name);

-- No need to modify types as they are automatically handled by Supabase
