import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { VideoFrames } from './VideoFrames'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

interface VideoUploadProps {
  projectId: string
  onVideoProcessed?: (videoId: string) => void
}

interface FFmpegFileInfo {
  name: string;
  size?: number;
  isDir?: boolean;
}

interface ProcessingOptions {
  maxFrames: number
  frameInterval: number
  quality: number
}

export function VideoUpload({ projectId, onVideoProcessed }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [detailedStatus, setDetailedStatus] = useState<string>('')
  const [progress, setProgress] = useState<{current: number, total: number} | null>(null)
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const [ffmpeg] = useState(() => new FFmpeg())
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({
    maxFrames: 60,      // Doubled from 30
    frameInterval: 2,   // Extract a frame every N seconds
    quality: 80        // JPEG quality (0-100)
  })

  // Add navigation warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploading) {
        e.preventDefault()
        e.returnValue = 'Video processing is in progress. Are you sure you want to leave? Processing will be interrupted.'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [uploading])

  const generateDefaultDisplayName = (filename: string) => {
    const date = new Date()
    const formattedDate = date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    return `${filename.split('.')[0]} - ${formattedDate}`
  }

  const compressVideo = async (file: File): Promise<Blob> => {
    setDetailedStatus('Compressing video for faster processing...')
    
    await ffmpeg.writeFile('input.mp4', await fetchFile(file))
    
    // Compress video with reasonable quality
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-c:v', 'libx264',
      '-crf', '28',        // Compression quality (23-28 is good)
      '-preset', 'faster', // Faster encoding
      '-y',
      'compressed.mp4'
    ])
    
    const compressedData = await ffmpeg.readFile('compressed.mp4')
    return new Blob([compressedData], { type: 'video/mp4' })
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    
    const file = e.target.files[0]
    const fileSizeMB = file.size / (1024 * 1024)
    
    // Add size warning for larger videos
    if (fileSizeMB > 100) {
      if (!window.confirm(
        `This video is ${fileSizeMB.toFixed(1)} MB. Would you like to:\n\n` +
        `1. Process with reduced quality (faster)\n` +
        `2. Process in full quality (slower)\n\n` +
        `Choose OK for reduced quality, Cancel for full quality.`
      )) {
        setProcessingOptions({
          maxFrames: 120,          // Doubled from 60
          frameInterval: 1,
          quality: 100
        })
      } else {
        setProcessingOptions({
          maxFrames: 60,           // Doubled from 30
          frameInterval: 2,
          quality: 80
        })
      }
    }
    
    setUploading(true)
    setStatus('Initializing...')
    setDetailedStatus('Setting up FFmpeg for video processing')
    setProgress(null)
    setCurrentVideoId(null)
    
    try {
      // Initialize FFmpeg
      if (!ffmpeg.loaded) {
        setStatus('Loading FFmpeg...')
        setDetailedStatus('This might take a few moments on first upload')
        try {
          await ffmpeg.load({
            coreURL: '/ffmpeg-core.js',
            wasmURL: '/ffmpeg-core.wasm',
            workerURL: '/ffmpeg-core.worker.js',
            log: true
          })
          setDetailedStatus('FFmpeg loaded successfully')

          // Test FFmpeg is working
          try {
            await ffmpeg.exec(['-version'])
            setDetailedStatus('FFmpeg is ready and working')
          } catch (versionError) {
            console.error('FFmpeg version check failed:', versionError)
            throw new Error('FFmpeg initialization failed')
          }
        } catch (loadError) {
          console.error('FFmpeg load error:', loadError)
          setStatus('Failed to load FFmpeg: ' + (loadError instanceof Error ? loadError.message : 'Unknown error'))
          throw new Error('Failed to load FFmpeg')
        }
      }

      // Compress video if it's large
      let processFile = file
      if (fileSizeMB > 50) {
        const compressedVideo = await compressVideo(file)
        processFile = new File([compressedVideo], file.name, { type: 'video/mp4' })
        setDetailedStatus('Video compressed successfully')
      }

      // Upload to Supabase
      setStatus('Uploading video to storage...')
      setDetailedStatus(`Uploading ${processFile.name} to cloud storage`)
      console.log('Uploading to Supabase...')
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('videos')
        .upload(`${projectId}/${processFile.name}`, processFile)
        
      if (uploadError) throw uploadError
      setDetailedStatus('Video upload successful')

      // Create video record
      setDetailedStatus('Creating video record in database')
      console.log('Creating video record...')
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert({
          project_id: projectId,
          filename: processFile.name,
          storage_path: uploadData.path,
          status: 'processing',
          display_name: generateDefaultDisplayName(processFile.name)
        })
        .select()
        .single()

      if (videoError) throw videoError
      setDetailedStatus('Video record created successfully')

      // Store the video ID for showing frames later
      setCurrentVideoId(videoData.id)

      // Process video with FFmpeg
      setStatus('Processing video frames...')
      setDetailedStatus('Loading video into FFmpeg for frame extraction')
      console.log('Writing video to FFmpeg filesystem...')
      
      try {
        // Extract frames with optimized settings
        setDetailedStatus('Starting optimized frame extraction')
        await ffmpeg.exec([
          '-i', 'input.mp4',
          '-vf', `fps=1/${processingOptions.frameInterval}`,  // Extract frames at interval
          '-vframes', processingOptions.maxFrames.toString(),
          '-q:v', Math.floor((100 - processingOptions.quality) / 5).toString(),  // Convert quality to FFmpeg scale
          '-f', 'image2',
          '-y',
          'frame-%03d.jpg'
        ])
        setDetailedStatus('Frame extraction completed')

        // Verify the frames were created
        const files = await ffmpeg.listDir('/')
        console.log('Files in FFmpeg filesystem:', files)

        // Get list of generated frames
        console.log('Getting frame list...')
        const frames = await ffmpeg.listDir('/') as FFmpegFileInfo[]
        const frameFiles = frames.filter(f => f.name.startsWith('frame-') && f.name.endsWith('.jpg'))
        console.log(`Found ${frameFiles.length} frames:`, frameFiles)

        if (frameFiles.length === 0) {
          throw new Error('No frames were extracted from the video')
        }

        // Upload frames
        setStatus(`Uploading frames...`)
        setProgress({ current: 0, total: frameFiles.length })
        
        for (let i = 0; i < frameFiles.length; i++) {
          const frameFile = frameFiles[i]
          setDetailedStatus(`Processing frame ${i + 1} of ${frameFiles.length}`)
          setProgress({ current: i + 1, total: frameFiles.length })
          
          const frameData = await ffmpeg.readFile(frameFile.name)
          const frameBlob = new Blob([frameData], { type: 'image/jpeg' })

          // Upload frame with retries
          let retryCount = 0;
          const maxRetries = 3;
          let frameUploadError: Error | null = null;

          while (retryCount < maxRetries) {
            try {
              // Construct a consistent frame path that matches the database structure
              const framePath = `${projectId}/${videoData.id}/frame_${i}.jpg`
              const { error: uploadError } = await supabase
                .storage
                .from('frames')
                .upload(framePath, frameBlob, {
                  contentType: 'image/jpeg',
                  cacheControl: '3600',
                  upsert: true
                });

              if (!uploadError) {
                // Get the public URL for the frame
                const { data: publicUrlData } = supabase
                  .storage
                  .from('frames')
                  .getPublicUrl(framePath);

                // Create frame record with complete path
                const { error: frameRecordError } = await supabase
                  .from('frames')
                  .insert({
                    video_id: videoData.id,
                    frame_number: i,
                    storage_path: framePath
                  })
                  .select()
                  .single();

                if (frameRecordError) {
                  console.error('Failed to create frame record:', frameRecordError);
                  throw new Error(`Failed to create frame record: ${frameRecordError.message}`);
                }

                frameUploadError = null;
                break;
              } else {
                frameUploadError = uploadError;
                console.error(`Upload error for frame ${i}:`, uploadError);
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount))); // Exponential backoff
              }
            } catch (err) {
              frameUploadError = err as Error;
              retryCount++;
              console.error(`Upload attempt ${retryCount} failed:`, err);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          }

          if (frameUploadError) {
            throw new Error(`Failed to upload frame ${i + 1} after ${maxRetries} attempts: ${frameUploadError.message}`);
          }
          
          console.log(`Frame ${i + 1} processed successfully`);
        }

        // Update video status to completed
        setStatus('Finalizing...')
        setDetailedStatus('Updating video status')
        console.log('Updating video status to completed...')
        const { error: updateError } = await supabase
          .from('videos')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', videoData.id)

        if (updateError) {
          console.error('Error updating video status:', updateError)
          throw updateError
        }
        
        setStatus('Processing completed!')
        setDetailedStatus('Video processing completed successfully')
        setProgress(null)
        
        // Notify parent component that processing is complete
        onVideoProcessed?.(videoData.id)

      } catch (ffmpegError) {
        console.error('FFmpeg processing error:', ffmpegError)
        throw new Error('Failed to process video: ' + (ffmpegError instanceof Error ? ffmpegError.message : 'Unknown error'))
      }
    } catch (error) {
      console.error('Error:', error)
      setStatus(error instanceof Error ? error.message : 'Error processing video')
      setDetailedStatus('An error occurred during processing')
      setProgress(null)
      
      // Update video status to error if we have a video ID
      if (currentVideoId) {
        await supabase
          .from('videos')
          .update({ 
            status: 'error',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', currentVideoId)
      }
      
      setCurrentVideoId(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="mt-4">
        <input
          type="file"
          accept="video/mp4"
          onChange={handleUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
        <div className="mt-2 space-y-2">
          <p className="text-xs text-gray-500">
            Recommendations for faster processing:
          </p>
          <ul className="text-xs text-gray-500 list-disc list-inside">
            <li>Videos under 100MB process faster</li>
            <li>Longer videos will extract frames at larger intervals</li>
            <li>Keep this tab open during processing or check back later</li>
          </ul>
        </div>
        {status && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center">
              {uploading && (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <p className="text-sm font-medium text-gray-900">{status}</p>
            </div>
            {detailedStatus && (
              <p className="text-sm text-gray-500">{detailedStatus}</p>
            )}
            {progress && (
              <div className="relative pt-1">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-blue-100">
                  <div 
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-300"
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {progress.current} of {progress.total} frames processed
                </div>
              </div>
            )}
            {uploading && (
              <div className="mt-2 p-4 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-700">
                  ⚠️ Please keep this tab open while processing. Closing or navigating away will interrupt the video processing.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {currentVideoId && (
        <VideoFrames videoId={currentVideoId} />
      )}
    </div>
  )
} 