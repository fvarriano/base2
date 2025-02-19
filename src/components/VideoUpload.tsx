import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface VideoUploadProps {
  projectId: string
}

export function VideoUpload({ projectId }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    
    setUploading(true)
    
    try {
      for (const file of e.target.files) {
        const { data, error } = await supabase
          .storage
          .from('videos')
          .upload(`${projectId}/${file.name}`, file)
          
        if (error) throw error

        const { error: videoError } = await supabase
          .from('videos')
          .insert({
            project_id: projectId,
            filename: file.name,
            storage_path: data.path,
            status: 'uploaded'
          })

        if (videoError) throw videoError
      }
    } catch (error) {
      console.error('Error uploading video:', error)
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
      {uploading && <p className="mt-2 text-sm text-gray-500">Uploading...</p>}
    </div>
  )
} 