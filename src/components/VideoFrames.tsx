import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import { RefreshCw } from 'lucide-react'

interface VideoFramesProps {
  videoId: string
}

interface Frame {
  id: string
  video_id: string
  frame_number: number
  storage_path: string
  created_at: string | null
  public_url?: string
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
  source_url?: string
  storage_path?: string
  project_id?: string
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
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

  // Helper function to get frame URL
  const getFrameUrl = useCallback((storagePath: string) => {
    return `https://storage.googleapis.com/appaudits-frames/${storagePath}`
  }, [])

  // Add error handler for image loading
  const handleImageError = useCallback((frameId: string, error: any) => {
    console.error(`Error loading frame ${frameId}:`, error)
    setImageErrors(prev => ({ ...prev, [frameId]: true }))
  }, [])

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

  // Fix the type issues in the handleRefresh function
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch the video details again
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();
      
      if (videoError) throw videoError;
      
      if (videoData) {
        // Cast the status to VideoStatus to fix type error
        setVideoDetails(videoData as Video);
        setVideoStatus(videoData.status as VideoStatus);
        setFrameGroupTitle(videoData.display_name || 'Extracted Frames');
      }
      
      // Fetch the frames again
      const { data: framesData, error: framesError } = await supabase
        .from('frames')
        .select('*')
        .eq('video_id', videoId)
        .order('frame_number');
      
      if (framesError) throw framesError;
      
      if (framesData) {
        // Cast the frames data to Frame[] to fix type error
        setFrames(framesData as Frame[]);
        // Reset image errors on refresh
        setImageErrors({});
        
        // Load annotations for the frames
        await loadAnnotations(framesData as Frame[]);
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('Failed to refresh data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [videoId, loadAnnotations]);

  // Render the frames section
  const renderFrames = () => {
    if (frames.length === 0) {
      if (videoStatus === 'error') {
        return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <div className="text-red-600 font-medium mb-2">Error processing video</div>
            <p className="text-sm text-red-500">
              There was an error processing this video. Please try uploading it again.
            </p>
          </div>
        );
      }
      
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-gray-500">No frames available yet.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Frames section */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold">
                {isEditingTitle ? (
                  <input
                    type="text"
                    value={frameGroupTitle}
                    onChange={(e) => setFrameGroupTitle(e.target.value)}
                    onBlur={() => {
                      setIsEditingTitle(false)
                      handleTitleUpdate(frameGroupTitle)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setIsEditingTitle(false)
                        handleTitleUpdate(frameGroupTitle)
                      }
                    }}
                    className="border rounded px-2 py-1"
                    autoFocus
                  />
                ) : (
                  <span onClick={() => setIsEditingTitle(true)}>{frameGroupTitle}</span>
                )}
              </h2>
              <span className="text-sm text-gray-500">({frames.length} frames)</span>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Frames</span>
            </button>
          </div>

          {/* Horizontal scroll container */}
          <div className="relative">
            {/* Shadow indicators for scroll */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>
            
            {/* Scrollable container */}
            <div className="overflow-x-auto pb-4 -mx-4 px-4" style={{ scrollbarWidth: 'thin' }}>
              <div className="flex space-x-4">
                {frames.map((frame) => {
                  const frameAnnotations = annotations[frame.id] || [];
                  const hasError = imageErrors[frame.id] || false;
                  
                  return (
                    <div 
                      key={frame.id} 
                      className={`flex-none w-[300px] relative border rounded-lg overflow-hidden ${selectedFrame?.id === frame.id ? 'ring-2 ring-blue-500' : ''}`}
                      onClick={(e) => handleFrameClick(frame.id, e)}
                    >
                      <div className="relative aspect-video bg-gray-100">
                        {!hasError ? (
                          <img
                            src={getFrameUrl(frame.storage_path)}
                            alt={`Frame ${frame.frame_number}`}
                            className="absolute inset-0 w-full h-full object-contain"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              console.error(`Error loading frame ${frame.frame_number}:`, {
                                frameId: frame.id,
                                storagePath: frame.storage_path,
                                fullUrl: getFrameUrl(frame.storage_path)
                              });
                              handleImageError(frame.id, e);
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                            <div className="text-center p-4">
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                className="h-10 w-10 mx-auto text-gray-400" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round" 
                                  strokeWidth={1.5} 
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                                />
                              </svg>
                              <p className="mt-2 text-sm text-gray-500">Image failed to load</p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setImageErrors(prev => ({ ...prev, [frame.id]: false }));
                                }}
                                className="mt-2 text-xs text-blue-500 hover:text-blue-700"
                              >
                                Retry
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Annotations */}
                        {frameAnnotations.map((annotation) => (
                          <div
                            key={annotation.id}
                            className="absolute w-6 h-6 -ml-3 -mt-3 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer z-10"
                            style={{
                              left: `${annotation.x}%`,
                              top: `${annotation.y}%`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle annotation click if needed
                            }}
                          >
                            {annotation.number}
                          </div>
                        ))}
                      </div>
                      
                      <div className="p-3 bg-white">
                        <div className="flex justify-between items-center">
                          <h3 className="text-sm font-medium text-gray-900">
                            Frame {frame.frame_number + 1}
                          </h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Are you sure you want to delete this frame?')) {
                                handleDeleteFrame(frame);
                              }
                            }}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                        
                        {/* Annotation list */}
                        {frameAnnotations.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {frameAnnotations.map((annotation) => (
                              <div key={annotation.id} className="flex items-start space-x-2 text-sm">
                                <div className="flex-shrink-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                  {annotation.number}
                                </div>
                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={annotation.text || ''}
                                    onChange={(e) => handleAnnotationTextUpdate(frame.id, annotation.id, e.target.value)}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                    placeholder="Add annotation text..."
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAnnotation(frame.id, annotation.id);
                                  }}
                                  className="text-red-500 hover:text-red-700 text-xs"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div>Loading frames...</div>;
  if (error) return <div>Error: {error}</div>;

  return renderFrames();
} 