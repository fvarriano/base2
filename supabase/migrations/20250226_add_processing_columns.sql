-- Add processing-related columns to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE videos ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add index on status for faster queries
CREATE INDEX IF NOT EXISTS videos_status_idx ON videos(status); 