import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

interface VideoFramesProps {
  videoId: string
}

interface Frame {
  id: string
  video_id: string
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
        setFrames(frameData as Frame[]);

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
    <div className="space-y-6">
      {/* Status Section */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Video Status</h2>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
          videoStatus === 'completed' ? 'bg-green-100 text-green-800' :
          videoStatus === 'error' ? 'bg-red-100 text-red-800' :
          videoStatus === 'processing' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {videoStatus}
        </span>
      </div>

      {/* Frames Section */}
      {frames.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-4">
          {videoStatus === 'processing' ? 
            <div className="text-blue-600">Processing video...</div> : 
            <div className="text-gray-500">No frames available</div>
          }
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Extracted Frames</h2>
          <div className="relative">
            {/* Left shadow gradient */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10" />
            
            {/* Right shadow gradient */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />
            
            {/* Scrollable container */}
            <div className="overflow-x-auto pb-4 -mx-4 px-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <div className="flex gap-4" style={{ width: 'max-content' }}>
                {frames.map((frame) => (
                  <div 
                    key={frame.id} 
                    className="relative w-[320px] flex-none"
                  >
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 shadow-sm">
                      <Image
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/frames/${frame.storage_path}`}
                        alt={`Frame ${frame.frame_number}`}
                        fill
                        sizes="320px"
                        className="object-cover"
                        crossOrigin="anonymous"
                      />
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                      Frame {frame.frame_number + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 