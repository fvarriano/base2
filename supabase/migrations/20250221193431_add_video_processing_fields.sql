-- Add error_message and processing fields to videos table
ALTER TABLE public.videos 
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS processing_progress INTEGER,
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add index for better querying
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status); 