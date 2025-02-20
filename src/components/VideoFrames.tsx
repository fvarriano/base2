import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface VideoFramesProps {
  videoId: string
}

interface Frame {
  id: string
  video_id: string | null
  frame_number: number
  storage_path: string
  created_at: string | null
}

export function VideoFrames({ videoId }: VideoFramesProps) {
  const [frames, setFrames] = useState<Frame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [videoStatus, setVideoStatus] = useState<string>('')

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    async function loadFramesAndStatus() {
      try {
        // Get video status
        const { data: videoData, error: videoError } = await supabase
          .from('videos')
          .select('status')
          .eq('id', videoId)
          .single();

        if (videoError) throw videoError;
        setVideoStatus(videoData.status || '');

        // Get frames from database
        const { data: frameData, error: frameError } = await supabase
          .from('frames')
          .select('*')
          .eq('video_id', videoId)
          .order('frame_number');

        if (frameError) throw frameError;
        setFrames(frameData || []);

        // If video processing is complete or errored, stop polling
        if (videoData.status === 'completed' || videoData.status === 'error') {
          clearInterval(intervalId);
        }

      } catch (err) {
        console.error('Error loading frames:', err);
        setError(err instanceof Error ? err.message : 'Failed to load frames');
        clearInterval(intervalId);
      } finally {
        setLoading(false);
      }
    }

    // Load immediately
    loadFramesAndStatus();

    // Then poll every 2 seconds
    intervalId = setInterval(loadFramesAndStatus, 2000);

    // Cleanup
    return () => clearInterval(intervalId);
  }, [videoId]);

  if (loading) return <div>Loading frames...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="mt-4">
      <div className="mb-4">
        <span className="text-sm font-medium">Status: </span>
        <span className={`text-sm ${
          videoStatus === 'completed' ? 'text-green-600' :
          videoStatus === 'error' ? 'text-red-600' :
          videoStatus === 'processing' ? 'text-blue-600' :
          'text-gray-600'
        }`}>
          {videoStatus}
        </span>
      </div>

      {frames.length === 0 ? (
        <div>
          {videoStatus === 'processing' ? 'Processing video...' : 'No frames available'}
        </div>
      ) : (
        <div>
          <h3 className="text-lg font-semibold mb-2">Extracted Frames</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {frames.map((frame) => (
              <div key={frame.id} className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/frames/${frame.storage_path}`}
                  alt={`Frame ${frame.frame_number}`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
                  Frame {frame.frame_number}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 