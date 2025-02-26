import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { VideoFrames } from './VideoFrames'

interface VideoUploadProps {
  projectId: string
  onVideoProcessed?: (videoId: string) => void
}

export function VideoUpload({ projectId, onVideoProcessed }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [detailedStatus, setDetailedStatus] = useState<string>('')
  const [progress, setProgress] = useState<{current: number, total: number} | null>(null)
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

  // Add navigation warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploading) {
        e.preventDefault()
        e.returnValue = 'Video upload is in progress. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [uploading])

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  const generateDefaultDisplayName = (filename: string) => {
    const date = new Date()
    const formattedDate = date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    return `${filename.split('.')[0]} - ${formattedDate}`
  }

  // Poll for video status updates
  const startPollingStatus = (videoId: string) => {
    // Clear any existing polling
    if (pollingInterval) {
      clearInterval(pollingInterval)
    }

    // Start polling every 3 seconds
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('videos')
          .select('*')
          .eq('id', videoId)
          .single()

        if (error) {
          console.error('Error polling status:', error)
          return
        }

        if (data) {
          // Use type assertion since we know the structure
          const videoData = data as any
          
          if (videoData.status === 'completed') {
            setStatus('Processing completed!')
            setDetailedStatus('Video processing completed successfully')
            setProgress(null)
            clearInterval(interval)
            setPollingInterval(null)
            setUploading(false)
            onVideoProcessed?.(videoId)
          } else if (videoData.status === 'error') {
            setStatus('Error processing video')
            setDetailedStatus(videoData.error_message || 'An error occurred during processing')
            setProgress(null)
            clearInterval(interval)
            setPollingInterval(null)
            setUploading(false)
          } else {
            setStatus('Processing video...')
            setDetailedStatus('Your video is being processed on the server. You can close this tab and check back later.')
          }
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 3000)

    setPollingInterval(interval)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    
    const file = e.target.files[0]
    const fileSizeMB = file.size / (1024 * 1024)
    
    // Add size warning for larger videos
    if (fileSizeMB > 100) {
      if (!window.confirm(
        `This video is ${fileSizeMB.toFixed(1)} MB. Processing may take several minutes. Continue?`
      )) {
        return
      }
    }
    
    setUploading(true)
    setStatus('Uploading...')
    setDetailedStatus(`Uploading ${file.name} to cloud storage`)
    setProgress(null)
    setCurrentVideoId(null)
    
    try {
      // Upload to Supabase
      setStatus('Uploading video to storage...')
      setDetailedStatus(`Uploading ${file.name} to cloud storage`)
      console.log('Uploading to Supabase...')
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('videos')
        .upload(`${projectId}/${file.name}`, file)
        
      if (uploadError) throw uploadError
      setDetailedStatus('Video upload successful')

      // Create video record
      setDetailedStatus('Creating video record in database')
      console.log('Creating video record...')
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert({
          project_id: projectId,
          filename: file.name,
          storage_path: uploadData.path,
          status: 'pending',
          display_name: generateDefaultDisplayName(file.name)
        })
        .select()
        .single()

      if (videoError) throw videoError
      setDetailedStatus('Video record created successfully')

      // Store the video ID for showing frames later
      setCurrentVideoId(videoData.id)

      // Send to server for processing
      setStatus('Starting server-side processing...')
      setDetailedStatus('Sending video for processing on the server')
      
      const response = await fetch('/api/process-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: videoData.id,
          projectId
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start processing')
      }

      setStatus('Processing video...')
      setDetailedStatus('Your video is being processed on the server. You can close this tab and check back later.')
      
      // Start polling for status updates
      startPollingStatus(videoData.id)
      
    } catch (error) {
      console.error('Error:', error)
      setStatus(error instanceof Error ? error.message : 'Error processing video')
      setDetailedStatus('An error occurred during upload or processing')
      setProgress(null)
      
      // Update video status to error if we have a video ID
      if (currentVideoId) {
        await supabase
          .from('videos')
          .update({ 
            status: 'error',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', currentVideoId)
      }
      
      setCurrentVideoId(null)
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="mt-4">
        <input
          type="file"
          accept="video/mp4"
          onChange={handleUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
        <div className="mt-2 space-y-2">
          <p className="text-xs text-gray-500">
            Server-side processing enabled:
          </p>
          <ul className="text-xs text-gray-500 list-disc list-inside">
            <li>Videos of any size can be processed</li>
            <li>You can close this tab after upload completes</li>
            <li>Processing continues in the background</li>
          </ul>
        </div>
        {status && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center">
              {uploading && (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <p className="text-sm font-medium text-gray-900">{status}</p>
            </div>
            {detailedStatus && (
              <p className="text-sm text-gray-500">{detailedStatus}</p>
            )}
            {progress && (
              <div className="relative pt-1">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-blue-100">
                  <div 
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-300"
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {progress.current} of {progress.total} frames processed
                </div>
              </div>
            )}
            {uploading && (
              <div className="mt-2 p-4 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-700">
                  ✅ Server-side processing: You can close this tab after upload completes. Processing will continue in the background.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {currentVideoId && (
        <VideoFrames videoId={currentVideoId} />
      )}
    </div>
  )
} 