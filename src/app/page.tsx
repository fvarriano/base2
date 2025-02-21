import { ProjectCard } from '@/components/ProjectCard'
import { CreateProject } from '@/components/CreateProject'
import { supabase } from '@/lib/supabase'

interface Project {
  id: string
  title: string
  description: string | null
  created_at: string | null
}

async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Home() {
  const projects = await getProjects()

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <CreateProject />
      </div>
      
      {projects.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-500">Create your first project to get started.</p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
            />
          ))}
        </div>
      )}
    </div>
  )
}
