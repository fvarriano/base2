import '../styles/globals.css'
import '../styles/scrollbar.css'
import type { Metadata } from 'next'
import { Inter } from "next/font/google"
import Link from 'next/link'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: 'Video Frame Extractor',
  description: 'Extract frames from videos using FFmpeg',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full antialiased`}>
        <div className="flex h-full">
          {/* Sidebar */}
          <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
            <div className="h-full flex flex-col">
              {/* Sidebar Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <h1 className="text-xl font-semibold text-gray-900">
                  <Link href="/" className="hover:text-gray-600">
                    Frame Extractor
                  </Link>
                </h1>
              </div>
              
              {/* Sidebar Navigation */}
              <nav className="flex-1 px-4 py-4">
                <div className="space-y-1">
                  <Link 
                    href="/projects" 
                    className="flex items-center px-2 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 hover:text-gray-900"
                  >
                    Projects
                  </Link>
                </div>
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 bg-gray-50">
            <div className="py-8 px-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
