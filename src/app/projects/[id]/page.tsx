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
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', params.id)
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

  if (loading) return <div>Loading...</div>
  if (!project) return <div>Project not found</div>

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Link href="/" className="text-blue-500 hover:text-blue-600">
        ← Back to Projects
      </Link>
      <h1 className="text-2xl font-bold mt-4">{project.title}</h1>
      {project.description && (
        <p className="mt-2 text-gray-600">{project.description}</p>
      )}
      {project.created_at && (
        <p className="mt-2 text-sm text-gray-500">
          Created: {new Date(project.created_at).toLocaleDateString()}
        </p>
      )}
      <VideoUpload projectId={project.id} />
    </div>
  )
} 