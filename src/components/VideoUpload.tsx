import { Video } from '@/lib/types'

// Now TypeScript knows exactly what a video looks like
const handleUpload = async (file: File) => {
  const video: Video = {
    id: '123',
    project_id: '456',
    filename: file.name,
    storage_path: `videos/${file.name}`,
    status: 'pending',
    created_at: new Date().toISOString()
  }
  
  // TypeScript will help you if you make a mistake!
  // For example, if you forget a required field, it will tell you
} 