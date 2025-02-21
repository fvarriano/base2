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
  const [videoStatus, setVideoStatus] = useState<VideoStatus>('processing')
  const [videoDetails, setVideoDetails] = useState<Video | null>(null)
  const [annotations, setAnnotations] = useState<FrameAnnotations>({})
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [frameGroupTitle, setFrameGroupTitle] = useState('Extracted Frames')

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

  // Add function to handle title update
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

      // Update local state
      setVideoDetails(prev => prev ? { ...prev, display_name: newTitle } : null)
      setIsEditingTitle(false)
    } catch (err) {
      console.error('Error updating title:', err)
    }
  }

  useEffect(() => {
    let isSubscribed = true

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
      isSubscribed = false
      annotationsSubscription.unsubscribe()
    }
  }, [videoId, loadAnnotations])

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
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
              (videoStatus as string) === 'completed' ? 'bg-green-100 text-green-800' :
              (videoStatus as string) === 'error' ? 'bg-red-100 text-red-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {videoStatus}
            </span>
          </div>
        </div>
      )}

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
          {/* Editable Title */}
          <div className="flex items-center justify-between mb-4">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={frameGroupTitle}
                  onChange={(e) => setFrameGroupTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTitleUpdate(frameGroupTitle)
                    } else if (e.key === 'Escape') {
                      setIsEditingTitle(false)
                      setFrameGroupTitle('Extracted Frames') // Reset to default if cancelled
                    }
                  }}
                  className="text-lg font-semibold px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={() => handleTitleUpdate(frameGroupTitle)}
                  className="p-1 text-blue-600 hover:text-blue-800"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setIsEditingTitle(false)
                    setFrameGroupTitle('Extracted Frames') // Reset to default if cancelled
                  }}
                  className="p-1 text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{frameGroupTitle}</h2>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            {/* Left shadow gradient */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10" />
            
            {/* Right shadow gradient */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />
            
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
                            const fallbackDiv = document.createElement('div');
                            fallbackDiv.className = 'absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500';
                            fallbackDiv.textContent = `Frame ${frame.frame_number + 1} (Failed to load)`;
                            imgElement.parentElement?.appendChild(fallbackDiv);
                            imgElement.style.display = 'none';
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
    </div>
  )
} 