import { useEffect, useState, useCallback } from 'react'
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

interface Annotation {
  id: string
  frame_id: string
  number: number
  x: number
  y: number
  text: string | null
  created_at: string
  updated_at: string
}

interface FrameAnnotations {
  [frameId: string]: Annotation[]
}

type VideoStatus = 'processing' | 'completed' | 'error';

interface Video {
  id: string
  display_name: string
  status: VideoStatus
  created_at: string
}

interface VideoUpdate {
  display_name?: string
  status?: VideoStatus
  updated_at?: string
}

export function VideoFrames({ videoId }: VideoFramesProps) {
  const [frames, setFrames] = useState<Frame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null)
  const [annotations, setAnnotations] = useState<FrameAnnotations>({})
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [frameGroupTitle, setFrameGroupTitle] = useState('Extracted Frames')
  const [videoStatus, setVideoStatus] = useState<VideoStatus>('processing')
  const [videoDetails, setVideoDetails] = useState<Video | null>(null)
  const [processingStartTime, setProcessingStartTime] = useState<Date | null>(null)
  const [processingDuration, setProcessingDuration] = useState<string>('')
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

  // Load annotations for all frames
  const loadAnnotations = useCallback(async (frames: Frame[]) => {
    if (!frames.length) return

    try {
      const { data, error } = await supabase
        .from('annotations')
        .select('*')
        .in('frame_id', frames.map(f => f.id))
        .order('frame_id, number')

      if (error) {
        console.error('Error loading annotations:', error)
        throw error
      }

      // Group annotations by frame_id
      const annotationsByFrame = (data || []).reduce((acc: FrameAnnotations, annotation) => {
        if (!acc[annotation.frame_id]) {
          acc[annotation.frame_id] = []
        }
        acc[annotation.frame_id].push(annotation)
        return acc
      }, {})

      setAnnotations(annotationsByFrame)
    } catch (err) {
      console.error('Error loading annotations:', err)
    }
  }, [])

  // Handle click on frame to add annotation
  const handleFrameClick = useCallback(async (frameId: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const frameAnnotations = annotations[frameId] || []
    const number = frameAnnotations.length + 1

    try {
      // Insert new annotation into Supabase
      const { data: newAnnotation, error } = await supabase
        .from('annotations')
        .insert({
          frame_id: frameId,
          number,
          x,
          y,
          text: ''
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating annotation:', error)
        throw error
      }

      if (!newAnnotation) {
        throw new Error('No annotation data returned')
      }

      // Update local state
      setAnnotations(prev => ({
        ...prev,
        [frameId]: [...(prev[frameId] || []), newAnnotation]
      }))
    } catch (err) {
      console.error('Error creating annotation:', err)
    }
  }, [annotations])

  // Handle annotation text update
  const handleAnnotationTextUpdate = useCallback(async (frameId: string, annotationId: string, text: string) => {
    try {
      const { error } = await supabase
        .from('annotations')
        .update({ text })
        .eq('id', annotationId)

      if (error) throw error

      // Update local state
      setAnnotations(prev => ({
        ...prev,
        [frameId]: prev[frameId].map(annotation =>
          annotation.id === annotationId ? { ...annotation, text } : annotation
        )
      }))
    } catch (err) {
      console.error('Error updating annotation:', err)
    }
  }, [])

  // Handle annotation delete
  const handleDeleteAnnotation = useCallback(async (frameId: string, annotationId: string) => {
    try {
      // Delete annotation from Supabase
      const { error } = await supabase
        .from('annotations')
        .delete()
        .eq('id', annotationId)

      if (error) throw error

      // Update local state and reorder remaining annotations
      setAnnotations(prev => {
        const updatedAnnotations = prev[frameId]
          .filter(a => a.id !== annotationId)
          .map((a, i) => ({ ...a, number: i + 1 }))

        // Update annotation numbers in Supabase
        updatedAnnotations.forEach(async (annotation) => {
          const { error: updateError } = await supabase
            .from('annotations')
            .update({ number: annotation.number })
            .eq('id', annotation.id)

          if (updateError) {
            console.error('Error updating annotation number:', updateError)
          }
        })

        return {
          ...prev,
          [frameId]: updatedAnnotations
        }
      })
    } catch (err) {
      console.error('Error deleting annotation:', err)
    }
  }, [])

  // Add handleDeleteFrame function
  const handleDeleteFrame = useCallback(async (frame: Frame) => {
    try {
      // Delete frame from storage
      const { error: storageError } = await supabase
        .storage
        .from('frames')
        .remove([frame.storage_path])

      if (storageError) throw storageError

      // Delete frame from database (this will cascade delete annotations)
      const { error: dbError } = await supabase
        .from('frames')
        .delete()
        .eq('id', frame.id)

      if (dbError) throw dbError

      // Update local state
      setFrames(prev => prev.filter(f => f.id !== frame.id))
      
      // Remove annotations for this frame
      setAnnotations(prev => {
        const newAnnotations = { ...prev }
        delete newAnnotations[frame.id]
        return newAnnotations
      })
    } catch (err) {
      console.error('Error deleting frame:', err)
      // You might want to show an error message to the user here
    }
  }, [])

  // Update handleTitleUpdate to store the title in the video record
  const handleTitleUpdate = async (newTitle: string) => {
    try {
      const updates: VideoUpdate = {
        display_name: newTitle,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('videos')
        .update(updates)
        .eq('id', videoId)

      if (error) throw error

      setFrameGroupTitle(newTitle)
      setVideoDetails(prev => prev ? { ...prev, display_name: newTitle } : null)
      setIsEditingTitle(false)
    } catch (err) {
      console.error('Error updating title:', err)
    }
  }

  // Add a function to format the processing duration
  const formatDuration = (startTime: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    
    if (diffMins > 0) {
      return `${diffMins} min ${diffSecs} sec`;
    } else {
      return `${diffSecs} sec`;
    }
  };

  // Update the useEffect to include polling for status updates
  useEffect(() => {
    let isSubscribed = true;
    
    async function loadFramesAndStatus() {
      try {
        // Get video details
        const { data: videoData, error: videoError } = await supabase
          .from('videos')
          .select('id, display_name, status, created_at')
          .eq('id', videoId)
          .single()

        if (videoError) throw videoError
        if (!isSubscribed) return
        
        // Type guard to ensure status is valid
        const isValidStatus = (status: string): status is VideoStatus =>
          ['processing', 'completed', 'error'].includes(status)

        const status = isValidStatus(videoData.status) ? videoData.status : 'processing'
        
        setVideoStatus(status)
        setVideoDetails({
          id: videoData.id,
          display_name: videoData.display_name,
          status,
          created_at: videoData.created_at
        })
        
        // Set processing start time if it's processing
        if (status === 'processing' && !processingStartTime) {
          // Use created_at as the start time since updated_at might not exist yet
          const startTime = new Date(videoData.created_at);
          setProcessingStartTime(startTime);
        }
        
        // Set the frame group title from the video's display name
        setFrameGroupTitle(videoData.display_name || 'Extracted Frames')

        // Get frames from database
        const { data: frameData, error: frameError } = await supabase
          .from('frames')
          .select('*')
          .eq('video_id', videoId)
          .order('frame_number')

        if (frameError) throw frameError
        if (!isSubscribed) return
        
        const frames = (frameData || []).filter(frame => frame.video_id !== null) as Frame[]
        setFrames(frames)

        // Load annotations if we have frames
        if (frames.length > 0) {
          await loadAnnotations(frames)
        }
      } catch (err) {
        console.error('Error loading frames:', err)
        if (isSubscribed) {
          setError(err instanceof Error ? err.message : 'Failed to load frames')
        }
      } finally {
        if (isSubscribed) {
          setLoading(false)
        }
      }
    }

    // Load immediately
    loadFramesAndStatus()

    // Set up polling for status updates if video is processing
    if (videoStatus === 'processing') {
      const interval = setInterval(() => {
        loadFramesAndStatus();
        
        // Update processing duration if we have a start time
        if (processingStartTime) {
          setProcessingDuration(formatDuration(processingStartTime));
        }
      }, 5000); // Check every 5 seconds
      
      setPollingInterval(interval);
    } else if (pollingInterval) {
      // Clear polling if video is no longer processing
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    // Set up real-time subscription for annotations
    const annotationsSubscription = supabase
      .channel('annotations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'annotations'
        },
        (payload) => {
          // Reload annotations when changes occur
          loadFramesAndStatus()
        }
      )
      .subscribe()

    // Cleanup
    return () => {
      isSubscribed = false;
      annotationsSubscription.unsubscribe();
      
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    }
  }, [videoId, loadAnnotations, videoStatus, processingStartTime]);

  if (loading) return <div>Loading frames...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="space-y-6">
      {/* Only show video details section while processing */}
      {(videoStatus as string) === 'processing' && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {videoDetails?.display_name || 'Video Processing'}
              </h2>
              <p className="text-sm text-gray-500">
                {videoDetails?.created_at && 
                  `Uploaded ${new Date(videoDetails.created_at).toLocaleString()}`
                }
              </p>
            </div>
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
              processing
            </div>
          </div>
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">Processing video on the server</p>
                {processingStartTime && (
                  <p className="text-xs text-gray-500">
                    Processing time: {processingDuration || formatDuration(processingStartTime)}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  This may take several minutes depending on the video size. You can leave and come back later.
                </p>
                
                {/* Fix Stuck Processing button - update to avoid full page reload */}
                {processingStartTime && 
                  new Date().getTime() - processingStartTime.getTime() > 5 * 60 * 1000 && (
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/fix-stuck-videos', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ videoId }),
                        });
                        
                        if (response.ok) {
                          // Instead of reloading the page, update the state
                          const result = await response.json();
                          console.log('Fix result:', result);
                          
                          // Show success message
                          alert(`Video processing fixed! Generated ${result.framesGenerated} frames.`);
                          
                          // Update video status and reload frames
                          setVideoStatus('completed');
                          
                          // Reload frames without page refresh
                          const { data: frameData } = await supabase
                            .from('frames')
                            .select('*')
                            .eq('video_id', videoId)
                            .order('frame_number');
                            
                          if (frameData) {
                            setFrames(frameData as Frame[]);
                            await loadAnnotations(frameData as Frame[]);
                          }
                        } else {
                          const errorData = await response.json();
                          console.error('Failed to fix video:', errorData);
                          alert(`Failed to fix video: ${errorData.error || 'Unknown error'}`);
                        }
                      } catch (error) {
                        console.error('Error fixing video:', error);
                        alert('Error fixing video. Please try again.');
                      }
                    }}
                    className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Fix Stuck Processing
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show frames section if we have frames or if processing is complete */}
      {(frames.length > 0 || videoStatus === 'completed') && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            {isEditingTitle ? (
              <div className="flex items-center">
                <input
                  type="text"
                  value={frameGroupTitle}
                  onChange={(e) => setFrameGroupTitle(e.target.value)}
                  className="border-gray-300 rounded-md shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  autoFocus
                  onBlur={() => {
                    setIsEditingTitle(false);
                    handleTitleUpdate(frameGroupTitle);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingTitle(false);
                      handleTitleUpdate(frameGroupTitle);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    setIsEditingTitle(false);
                    handleTitleUpdate(frameGroupTitle);
                  }}
                  className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center">
                <h2 className="text-lg font-semibold text-gray-900">{frameGroupTitle}</h2>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Show message if completed but no frames */}
          {frames.length === 0 && videoStatus === 'completed' && (
            <div className="text-center py-8 text-gray-500">
              No frames were extracted from this video.
            </div>
          )}

          <div className="relative">
            {/* Remove the gradient divs */}
            
            {/* Scrollable container */}
            <div className="overflow-x-auto pb-4 -mx-4 px-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <div className="flex gap-6" style={{ width: 'max-content' }}>
                {frames.map((frame) => (
                  <div key={frame.id} className="flex-none space-y-4">
                    {/* Frame Container */}
                    <div className="relative w-[640px] group">
                      <div 
                        className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 shadow-lg cursor-crosshair"
                        onClick={(e) => handleFrameClick(frame.id, e)}
                      >
                        <Image
                          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/frames/${frame.storage_path}`}
                          alt={`Frame ${frame.frame_number + 1}`}
                          width={640}
                          height={360}
                          className="object-contain w-full h-full"
                          crossOrigin="anonymous"
                          priority
                          unoptimized={true}
                          onError={(e) => {
                            console.error('Error loading image:', frame.storage_path);
                            const imgElement = e.target as HTMLImageElement;
                            // Create a fallback placeholder with frame number
                            imgElement.src = `https://via.placeholder.com/640x360/f3f4f6/9ca3af?text=Frame+${frame.frame_number + 1}`;
                            imgElement.style.objectFit = 'cover';
                          }}
                        />
                        {/* Delete Button - Visible on hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent frame click
                            handleDeleteFrame(frame);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        {/* Annotation Markers */}
                        {annotations[frame.id]?.map((annotation) => (
                          <div
                            key={annotation.id}
                            className="absolute w-6 h-6 -ml-3 -mt-3 flex items-center justify-center"
                            style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
                          >
                            <div className="w-6 h-6 bg-blue-500 rounded-full text-white text-sm flex items-center justify-center">
                              {annotation.number}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Frame Title and Annotations */}
                    <div className="w-[640px] space-y-4">
                      <div className="text-sm font-medium text-gray-900 px-1">
                        Frame {frame.frame_number + 1}
                      </div>

                      {/* Annotations List */}
                      {annotations[frame.id]?.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                          <h3 className="font-medium text-gray-900">Annotations</h3>
                          <div className="space-y-2">
                            {annotations[frame.id].map((annotation) => (
                              <div key={annotation.id} className="flex items-start gap-3">
                                <div className="flex-none w-6 h-6 bg-blue-500 rounded-full text-white text-sm flex items-center justify-center">
                                  {annotation.number}
                                </div>
                                <div className="flex-1">
                                  <textarea
                                    value={annotation.text || ''}
                                    onChange={(e) => handleAnnotationTextUpdate(frame.id, annotation.id, e.target.value)}
                                    placeholder="Add annotation note..."
                                    className="w-full min-h-[60px] px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <button
                                  onClick={() => handleDeleteAnnotation(frame.id, annotation.id)}
                                  className="flex-none p-1 text-gray-400 hover:text-red-500"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show error message if processing failed */}
      {videoStatus === 'error' && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-start mb-4">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error processing video
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>There was an error processing this video. Please try uploading it again.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 