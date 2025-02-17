'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Project {
  id: string
  title: string
  description: string | null
  created_at: string
}

export default function ProjectPage() {
  const { id } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error
        setProject(data)
      } catch (error) {
        console.error('Error fetching project:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [id])

  if (loading) {
    return <div className="text-center text-secondary">Loading project...</div>
  }

  if (!project) {
    return (
      <div className="text-center">
        <p className="text-secondary">Project not found</p>
        <Link href="/" className="text-accent-color hover:text-accent-hover mt-4 inline-block">
          Back to Projects
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="mb-6">
        <Link href="/" className="text-accent-color hover:text-accent-hover inline-flex items-center">
          <span className="mr-2">←</span>
          Back to Projects
        </Link>
      </div>

      <div className="card p-8 rounded-lg">
        <h1 className="text-3xl font-bold mb-4 text-primary">{project.title}</h1>
        {project.description && (
          <p className="text-secondary mb-6 text-lg">{project.description}</p>
        )}
        <div className="text-sm text-secondary border-t border-border-color pt-4">
          Created on {new Date(project.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  )
} 