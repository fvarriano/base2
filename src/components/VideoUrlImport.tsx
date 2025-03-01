import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface VideoUrlImportProps {
  projectId: string;
  onVideoImported?: (videoId: string) => void;
}

export function VideoUrlImport({ projectId, onVideoImported }: VideoUrlImportProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const isValidUrl = (url: string) => {
    // First try with the URL constructor
    try {
      new URL(url);
      return true;
    } catch (e) {
      // If that fails, check if it's a valid URL without protocol
      // and prepend https:// to it
      if (url.includes('loom.com/')) {
        try {
          new URL(`https://${url}`);
          return true;
        } catch (e) {
          return false;
        }
      }
      return false;
    }
  };

  const isLoomUrl = (url: string) => {
    // Use regex to check if it's a valid Loom URL and extract the video ID
    // Updated to be more permissive with the video ID format
    const loomRegex = /loom\.com\/(share|v)\/([a-zA-Z0-9_-]+)/i;
    const match = url.match(loomRegex);
    
    // If regex fails, try a more manual approach
    if (!match || !match[2]) {
      if (url.includes('loom.com/share/')) {
        const parts = url.split('loom.com/share/');
        if (parts.length > 1) {
          const manualVideoId = parts[1].split('?')[0].split('#')[0];
          return manualVideoId && manualVideoId.length >= 5;
        }
      }
      return false;
    }
    
    return match[2].length >= 5;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    let trimmedUrl = videoUrl.trim();
    
    if (!trimmedUrl) {
      setError('Please enter a video URL');
      return;
    }

    // If URL doesn't have a protocol, add https://
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      trimmedUrl = `https://${trimmedUrl}`;
    }

    if (!isValidUrl(trimmedUrl)) {
      setError('Please enter a valid URL');
      return;
    }

    if (!isLoomUrl(trimmedUrl)) {
      setError('Currently only Loom URLs are supported (e.g., https://www.loom.com/share/abcdef123456)');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/import-video-from-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl: trimmedUrl,
          projectId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import video');
      }

      const data = await response.json();
      
      // Show success message
      setSuccess('Video import started successfully! Processing in the background...');
      
      // Call the callback if provided
      if (onVideoImported && data.videoId) {
        onVideoImported(data.videoId);
      }
      
      // Refresh the page data
      router.refresh();
      
      // Clear the input
      setVideoUrl('');
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (err) {
      console.error('Error importing video:', err);
      setError(err instanceof Error ? err.message : 'Failed to import video');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Import Video from URL</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-700 mb-1">
            Video URL (Loom)
          </label>
          <input
            type="url"
            id="videoUrl"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.loom.com/share/..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
          <p className="mt-1 text-sm text-gray-500">
            Currently supports Loom share links (e.g., https://www.loom.com/share/abcdef123456)
          </p>
        </div>

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}
        
        {success && (
          <div className="text-green-500 text-sm">{success}</div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Importing...
            </>
          ) : (
            'Import Video'
          )}
        </button>
      </form>
    </div>
  );
} 