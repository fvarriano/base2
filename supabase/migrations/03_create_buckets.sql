-- Create videos bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Create frames bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('frames', 'frames', true)
ON CONFLICT (id) DO NOTHING; 