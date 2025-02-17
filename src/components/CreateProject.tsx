import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface CreateProjectProps {
  onProjectCreated: () => void
}

export function CreateProject({ onProjectCreated }: CreateProjectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('projects')
        .insert([{ title, description }])

      if (error) throw error

      setTitle('')
      setDescription('')
      setIsOpen(false)
      onProjectCreated()
    } catch (error) {
      console.error('Error creating project:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <button onClick={() => setIsOpen(true)} className="btn-primary">
        Create Project
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Create New Project</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
} 