'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
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
}

export default function ProjectPage() {
  const params = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
      } finally {
        setLoading(false)
      }
    }

    fetchProjectAndVideos()
  }, [params.id])

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900">Project not found</h2>
        <p className="mt-2 text-gray-600">The project you're looking for doesn't exist or has been deleted.</p>
        <Link 
          href="/"
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Return to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <Link 
          href="/" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <svg 
            className="w-4 h-4 mr-1" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
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
        <VideoUpload 
          projectId={project.id} 
          onVideoProcessed={(videoId) => {
            // Refresh videos list when a new video is processed
            supabase
              .from('videos')
              .select('id, display_name, status, created_at')
              .eq('project_id', project.id)
              .order('created_at', { ascending: false })
              .then(({ data }) => {
                if (data) setVideos(data as Video[])
              })
          }} 
        />

        {/* Add VideoUrlImport component with callback */}
        <VideoUrlImport 
          projectId={project.id} 
          onVideoImported={(videoId) => {
            // Refresh videos list when a new video is imported
            supabase
              .from('videos')
              .select('id, display_name, status, created_at')
              .eq('project_id', project.id)
              .order('created_at', { ascending: false })
              .then(({ data }) => {
                if (data) setVideos(data as Video[])
              })
          }}
        />

        {/* Display all videos */}
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
  )
} 