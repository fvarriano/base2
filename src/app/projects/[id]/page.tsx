'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { VideoUpload } from '@/components/VideoUpload'

interface Project {
  id: string
  title: string
  description: string | null
  created_at: string | null
}

export default function ProjectPage() {
  const params = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProject = async () => {
      if (!params.id) return

      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', params.id.toString())
          .single()

        if (error) throw error
        setProject(data as Project)
      } catch (error) {
        console.error('Error fetching project:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [params.id])

  if (loading) return <div className="p-4">Loading...</div>
  if (!project) return <div className="p-4">Project not found</div>

  return (
    <div>
      <div className="mb-6">
        <Link 
          href="/projects" 
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
          Back to Projects
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h1 className="text-2xl font-bold">{project.title}</h1>
        {project.description && (
          <p className="mt-2 text-gray-600">{project.description}</p>
        )}
        {project.created_at && (
          <p className="mt-2 text-sm text-gray-500">
            Created: {new Date(project.created_at).toLocaleDateString()}
          </p>
        )}
      </div>

      <VideoUpload projectId={project.id} />
    </div>
  )
} 