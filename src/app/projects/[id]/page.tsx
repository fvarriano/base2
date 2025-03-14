'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { VideoUpload } from '@/components/VideoUpload'
import { VideoFrames } from '@/components/VideoFrames'
import { VideoUrlImport } from '@/components/VideoUrlImport'

interface Project {
  id: string
  title: string
  description: string | null
  created_at: string | null
}

interface Video {
  id: string
  display_name: string
  status: string
  created_at: string
  source_url?: string
  storage_path?: string
  project_id?: string
}

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const fetchProjectAndVideos = async () => {
    if (!params.id) return

    try {
      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', params.id.toString())
        .single()

      if (projectError) throw projectError
      setProject(projectData as Project)
      setNewTitle(projectData.title) // Initialize edit title field

      // Fetch videos for this project
      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select('id, display_name, status, created_at')
        .eq('project_id', params.id.toString())
        .order('created_at', { ascending: false })

      if (videosError) throw videosError
      setVideos(videosData as Video[])
    } catch (error) {
      console.error('Error fetching project data:', error)
      setError('Error fetching project data. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTitle = async () => {
    if (!project || !newTitle.trim()) return

    try {
      const { error } = await supabase
        .from('projects')
        .update({ title: newTitle.trim() })
        .eq('id', project.id)

      if (error) throw error

      setProject({ ...project, title: newTitle.trim() })
      setIsEditingTitle(false)
    } catch (error) {
      console.error('Error updating project title:', error)
      alert('Failed to update project title. Please try again.')
    }
  }

  useEffect(() => {
    fetchProjectAndVideos()
  }, [params.id])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!project) return <div>Project not found</div>

  const refreshVideos = () => {
    supabase
      .from('videos')
      .select('id, display_name, status, created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setVideos(data as Video[])
      })
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        {/* Header with back button, title, and edit button */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.push('/')}
            className="p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100"
            aria-label="Back to dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          <div className="flex-1 flex items-center gap-3">
            {isEditingTitle ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="flex-1 text-2xl font-bold text-gray-900 border-b-2 border-blue-500 focus:outline-none bg-transparent"
                  autoFocus
                />
                <button
                  onClick={handleUpdateTitle}
                  className="p-1 text-green-600 hover:text-green-700"
                  aria-label="Save title"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setIsEditingTitle(false)
                    setNewTitle(project.title)
                  }}
                  className="p-1 text-red-600 hover:text-red-700"
                  aria-label="Cancel editing"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  aria-label="Edit title"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {project.description && (
          <p className="mt-2 text-gray-600">{project.description}</p>
        )}
        {project.created_at && (
          <p className="mt-2 text-sm text-gray-500">
            Created: {new Date(project.created_at).toLocaleDateString()}
          </p>
        )}
      </div>

      <div className="space-y-8">
        {/* Video Upload Options Container */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add a Video</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* File Upload Option */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-md font-medium text-gray-900 mb-3">Upload from Computer</h3>
              <VideoUpload projectId={project.id} onVideoProcessed={refreshVideos} />
            </div>

            {/* URL Import Option */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-md font-medium text-gray-900 mb-3">Import from Loom</h3>
              <VideoUrlImport projectId={project.id} onVideoImported={refreshVideos} />
            </div>
          </div>
        </div>

        {/* Display all videos */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Processed Videos</h2>
          {videos.map((video) => (
            <VideoFrames key={video.id} videoId={video.id} />
          ))}

          {videos.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
              No videos uploaded yet. Upload a video or import from URL to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 