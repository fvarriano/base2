import Link from 'next/link'

interface ProjectCardProps {
  project: {
    id: string
    title: string
    description: string | null
    created_at: string | null
  }
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="p-4 border rounded-lg shadow hover:shadow-md transition-shadow">
      <Link href={`/projects/${project.id}`}>
        <h3 className="text-lg font-semibold">{project.title}</h3>
        {project.description && (
          <p className="mt-2 text-gray-600">{project.description}</p>
        )}
        {project.created_at && (
          <p className="mt-2 text-sm text-gray-500">
            Created: {new Date(project.created_at).toLocaleDateString()}
          </p>
        )}
      </Link>
    </div>
  )
} 