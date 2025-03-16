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
    try {
      new URL(url);
      return true;
    } catch (e) {
      console.error('URL validation error:', e);
      return false;
    }
  };

  const isLoomUrl = (url: string) => {
    // More permissive regex for Loom URLs
    const loomRegex = /loom\.com\/(share|v)\/([a-zA-Z0-9_-]+)/i;
    const match = url.match(loomRegex);
    
    if (!match || !match[2]) {
      console.error('Loom URL validation failed:', { url, match });
      return false;
    }
    
    return true;
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

    console.log('Processing URL:', trimmedUrl);

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
      console.log('Sending request to import video:', trimmedUrl);
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
        console.error('Import video error:', errorData);
        throw new Error(errorData.error || 'Failed to import video');
      }

      const data = await response.json();
      console.log('Import video success:', data);
      
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
    <div>
      <form onSubmit={handleSubmit}>
        <div>
          <input
            type="url"
            id="videoUrl"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.loom.com/share/..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
          <p className="mt-2 text-xs text-gray-500">
            Currently supports Loom share links
          </p>
        </div>

        {error && (
          <div className="mt-2 text-sm text-red-500">{error}</div>
        )}
        
        {success && (
          <div className="mt-2 text-sm text-green-500">{success}</div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
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