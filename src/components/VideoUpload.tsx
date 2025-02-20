import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { VideoFrames } from './VideoFrames'

interface VideoUploadProps {
  projectId: string
}

export function VideoUpload({ projectId }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    
    setUploading(true)
    setStatus('Uploading video...')
    setCurrentVideoId(null)
    
    try {
      for (const file of e.target.files) {
        // Create a unique filename with timestamp
        const timestamp = new Date().getTime()
        const fileExtension = file.name.split('.').pop()
        const uniqueFilename = `${file.name.split('.')[0]}_${timestamp}.${fileExtension}`
        
        // Upload to Supabase
        const { data, error } = await supabase
          .storage
          .from('videos')
          .upload(`${projectId}/${uniqueFilename}`, file)
          
        if (error) throw error

        // Create video record
        const { data: videoData, error: videoError } = await supabase
          .from('videos')
          .insert({
            project_id: projectId,
            filename: uniqueFilename,
            storage_path: data.path,
            status: 'uploaded'
          })
          .select()
          .single()

        if (videoError) throw videoError

        // Store the video ID for showing frames later
        setCurrentVideoId(videoData.id)

        // Trigger processing in Cloudflare Worker
        const workerUrl = process.env.NEXT_PUBLIC_VIDEO_PROCESSOR_URL
        if (!workerUrl) {
          console.warn('Video processor URL not configured')
          setStatus('Video uploaded successfully!')
          return
        }

        setStatus('Initiating video processing...')
        
        const response = await fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoId: videoData.id,
            projectId: projectId,
            storagePath: data.path
          })
        })

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Worker error details:', errorData);
          throw new Error(errorData.error || 'Failed to initiate video processing');
        }

        setStatus('Video uploaded and processing initiated!')
      }
    } catch (error) {
      console.error('Error:', error)
      setStatus(error instanceof Error ? error.message : 'Error uploading video')
      setCurrentVideoId(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="mt-4">
        <input
          type="file"
          accept="video/mp4"
          multiple
          onChange={handleUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
        {status && (
          <p className="mt-2 text-sm text-gray-500">{status}</p>
        )}
      </div>
      
      {currentVideoId && (
        <VideoFrames videoId={currentVideoId} />
      )}
    </div>
  )
} 