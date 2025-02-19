import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface VideoUploadProps {
  projectId: string
}

export function VideoUpload({ projectId }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<string>('')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    
    setUploading(true)
    setStatus('Uploading video...')
    
    try {
      for (const file of e.target.files) {
        // Upload to Supabase
        const { data, error } = await supabase
          .storage
          .from('videos')
          .upload(`${projectId}/${file.name}`, file)
          
        if (error) throw error

        // Create video record
        const { data: videoData, error: videoError } = await supabase
          .from('videos')
          .insert({
            project_id: projectId,
            filename: file.name,
            storage_path: data.path,
            status: 'processing'
          })
          .select()
          .single()

        if (videoError) throw videoError

        setStatus('Processing video...')

        // Trigger worker
        const workerUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL
        if (workerUrl) {
          const response = await fetch(workerUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              videoId: videoData.id,
              storagePath: data.path
            })
          })

          if (!response.ok) {
            throw new Error('Failed to process video')
          }

          // Update video status to completed
          await supabase
            .from('videos')
            .update({ status: 'completed' })
            .eq('id', videoData.id)

          setStatus('Video processed successfully!')
        }
      }
    } catch (error) {
      console.error('Error:', error)
      setStatus('Error processing video')
    } finally {
      setUploading(false)
    }
  }

  return (
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
  )
} 