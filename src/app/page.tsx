import { ProjectCard } from '@/components/ProjectCard'
import { CreateProject } from '@/components/CreateProject'

interface Project {
  id: string
  title: string
  description: string | null
  created_at: string | null
}

async function getProjects(): Promise<Project[]> {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
    
  const res = await fetch(`${baseUrl}/api/projects`, { 
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  
  if (!res.ok) throw new Error('Failed to fetch projects')
  return res.json()
}

export default async function Home() {
  const projects = await getProjects()

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <CreateProject />
      </div>
      
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
          />
        ))}
      </div>
    </div>
  )
}
