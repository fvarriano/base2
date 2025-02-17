'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ProjectCard } from '@/components/ProjectCard'
import { CreateProject } from '@/components/CreateProject'

interface Project {
  id: string
  title: string
  description: string | null
  created_at: string
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Projects</h1>
        <CreateProject onProjectCreated={fetchProjects} />
      </div>

      {loading ? (
        <div className="text-center text-gray-600">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center text-gray-600">
          No projects yet. Create your first project!
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              title={project.title}
              description={project.description}
              createdAt={project.created_at}
            />
          ))}
        </div>
      )}
    </div>
  )
}
