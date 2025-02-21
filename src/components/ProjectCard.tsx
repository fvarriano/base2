'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface ProjectCardProps {
  project: {
    id: string
    title: string
    description: string | null
    created_at: string | null
  }
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      
      // Delete all frames associated with the project's videos
      const { data: videos } = await supabase
        .from('videos')
        .select('id')
        .eq('project_id', project.id)

      if (videos && videos.length > 0) {
        const videoIds = videos.map(v => v.id)
        
        // Delete frame records
        await supabase
          .from('frames')
          .delete()
          .in('video_id', videoIds)

        // Delete frame files from storage
        for (const videoId of videoIds) {
          const { data: frames } = await supabase
            .storage
            .from('frames')
            .list(`${project.id}/${videoId}`)

          if (frames && frames.length > 0) {
            await supabase
              .storage
              .from('frames')
              .remove(frames.map(f => `${project.id}/${videoId}/${f.name}`))
          }
        }

        // Delete video records
        await supabase
          .from('videos')
          .delete()
          .in('id', videoIds)

        // Delete video files from storage
        const { data: videoFiles } = await supabase
          .storage
          .from('videos')
          .list(project.id)

        if (videoFiles && videoFiles.length > 0) {
          await supabase
            .storage
            .from('videos')
            .remove(videoFiles.map(f => `${project.id}/${f.name}`))
        }
      }

      // Finally, delete the project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id)

      if (error) throw error

      router.refresh()
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Failed to delete project. Please try again.')
    } finally {
      setIsDeleting(false)
      setShowConfirmation(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex justify-between items-start">
          <Link 
            href={`/projects/${project.id}`}
            className="flex-1"
          >
            <h3 className="text-lg font-semibold text-gray-900 hover:text-gray-600 transition-colors">
              {project.title}
            </h3>
            {project.description && (
              <p className="mt-2 text-gray-600">{project.description}</p>
            )}
            {project.created_at && (
              <p className="mt-2 text-sm text-gray-500">
                Created: {new Date(project.created_at).toLocaleDateString()}
              </p>
            )}
          </Link>
          
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={isDeleting}
            className="ml-4 p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
          >
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900">Delete Project</h3>
            <p className="mt-2 text-gray-600">
              Are you sure you want to delete "{project.title}"? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 