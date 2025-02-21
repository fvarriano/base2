import '../styles/globals.css'
import type { Metadata } from 'next'
import { Inter } from "next/font/google"
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: 'App Audits',
  description: 'Extract and analyze frames from app recordings',
}

async function getProjects() {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, title')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching projects:', error)
    return []
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const projects = await getProjects()

  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full antialiased`}>
        <div className="min-h-full">
          <div className="flex min-h-full">
            {/* Sidebar */}
            <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-gray-200 lg:bg-white lg:pt-5">
              <div className="flex flex-col flex-grow">
                {/* Sidebar Header */}
                <div className="flex-shrink-0 px-6 pb-4">
                  <h1 className="text-xl font-semibold text-gray-900">
                    <Link href="/" className="hover:text-gray-600 transition-colors">
                      App Audits
                    </Link>
                  </h1>
                </div>
                
                {/* Sidebar Navigation */}
                <nav className="flex-1 px-4 space-y-1">
                  <Link 
                    href="/" 
                    className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    Dashboard
                  </Link>

                  {/* Projects List */}
                  <div className="mt-6">
                    <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Projects
                    </h3>
                    <div className="mt-2 space-y-1">
                      {projects.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          No projects yet
                        </div>
                      ) : (
                        projects.map((project) => (
                          <Link
                            key={project.id}
                            href={`/projects/${project.id}`}
                            className="flex items-center px-3 py-2 text-sm text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
                          >
                            {project.title}
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                </nav>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:pl-64 flex flex-col flex-1">
              <main className="flex-1 pb-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 lg:pt-12">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
