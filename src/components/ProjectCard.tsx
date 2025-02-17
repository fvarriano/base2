import Link from 'next/link'

interface ProjectCardProps {
  id: string
  title: string
  description: string | null
  createdAt: string
}

export function ProjectCard({ id, title, description, createdAt }: ProjectCardProps) {
  return (
    <Link href={`/projects/${id}`}>
      <div className="card p-6 rounded-lg hover:scale-[1.01] transition-all">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-gray-600">{description}</p>
        )}
        <div className="mt-4 text-xs text-gray-500">
          Created {new Date(createdAt).toLocaleDateString()}
        </div>
      </div>
    </Link>
  )
} 