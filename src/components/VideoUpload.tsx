import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { VideoFrames } from './VideoFrames'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

interface VideoUploadProps {
  projectId: string
}

interface FFmpegFileInfo {
  name: string;
  size?: number;
  isDir?: boolean;
}

export function VideoUpload({ projectId }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const [ffmpeg] = useState(() => new FFmpeg())

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    
    setUploading(true)
    setStatus('Initializing FFmpeg...')
    setCurrentVideoId(null)
    
    try {
      // Initialize FFmpeg
      if (!ffmpeg.loaded) {
        console.log('Loading FFmpeg...')
        try {
          await ffmpeg.load({
            coreURL: '/ffmpeg-core.js',
            wasmURL: '/ffmpeg-core.wasm',
            log: true
          })
          console.log('FFmpeg loaded successfully')

          // Log FFmpeg version
          await ffmpeg.exec(['-version'])
          console.log('FFmpeg is ready')
        } catch (loadError) {
          console.error('FFmpeg load error:', loadError)
          throw new Error('Failed to load FFmpeg')
        }
      }

      for (const file of e.target.files) {
        console.log('Processing file:', file.name)
        setStatus('Processing video...')
        
        // Create a unique filename with timestamp
        const timestamp = new Date().getTime()
        const fileExtension = file.name.split('.').pop()
        const uniqueFilename = `${file.name.split('.')[0]}_${timestamp}.${fileExtension}`
        
        // Upload to Supabase
        setStatus('Uploading video to storage...')
        console.log('Uploading to Supabase...')
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('videos')
          .upload(`${projectId}/${uniqueFilename}`, file)
          
        if (uploadError) throw uploadError
        console.log('Upload successful')

        // Create video record
        console.log('Creating video record...')
        const { data: videoData, error: videoError } = await supabase
          .from('videos')
          .insert({
            project_id: projectId,
            filename: uniqueFilename,
            storage_path: uploadData.path,
            status: 'processing'
          })
          .select()
          .single()

        if (videoError) throw videoError
        console.log('Video record created')

        // Store the video ID for showing frames later
        setCurrentVideoId(videoData.id)

        // Process video with FFmpeg
        setStatus('Loading video into FFmpeg...')
        console.log('Writing video to FFmpeg filesystem...')
        
        try {
          // Write video to FFmpeg filesystem
          const videoBuffer = await fetchFile(file)
          await ffmpeg.writeFile('input.mp4', videoBuffer)
          console.log('Video written to FFmpeg filesystem')

          // Extract frames (1 frame per second)
          setStatus('Extracting frames...')
          console.log('Getting video information...')
          await ffmpeg.exec(['-i', 'input.mp4'])
          console.log('Video info command completed')

          // Extract frames with a more reliable command
          console.log('Starting frame extraction...')
          await ffmpeg.exec([
            '-i', 'input.mp4',
            '-vf', 'fps=1',
            '-start_number', '0',
            '-vframes', '10',  // Limit to 10 frames for testing
            '-f', 'image2',
            '-y',
            'frame-%03d.jpg'
          ])
          console.log('Frame extraction command completed')

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
          setStatus(`Uploading ${frameFiles.length} frames...`)
          
          for (let i = 0; i < frameFiles.length; i++) {
            const frameFile = frameFiles[i]
            console.log(`Processing frame ${i + 1}/${frameFiles.length}`)
            const frameData = await ffmpeg.readFile(frameFile.name)
            const frameBlob = new Blob([frameData], { type: 'image/jpeg' })
            const framePath = `${projectId}/${videoData.id}/frame_${i}.jpg`

            // Upload frame with retries
            let retryCount = 0;
            const maxRetries = 3;
            let frameUploadError: Error | null = null;

            while (retryCount < maxRetries) {
              try {
                const { error } = await supabase
                  .storage
                  .from('frames')
                  .upload(framePath, frameBlob, {
                    contentType: 'image/jpeg',
                    cacheControl: '3600',
                    upsert: true // Enable overwriting if file exists
                  });

                if (!error) {
                  frameUploadError = null;
                  break;
                }
                
                frameUploadError = error as Error;
                retryCount++;
                console.log(`Retry ${retryCount}/${maxRetries} for frame ${i + 1}`);
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
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

            // Create frame record
            const { error: frameRecordError } = await supabase
              .from('frames')
              .insert({
                video_id: videoData.id,
                frame_number: i,
                storage_path: framePath
              })

            if (frameRecordError) {
              throw new Error(`Failed to create frame record: ${frameRecordError.message}`);
            }
            
            console.log(`Frame ${i + 1} processed successfully`);
            setStatus(`Uploaded frame ${i + 1}/${frameFiles.length}`);
          }

          // Update video status to completed
          console.log('Updating video status to completed...')
          const { error: updateError } = await supabase
            .from('videos')
            .update({ status: 'completed' })
            .eq('id', videoData.id)

          if (updateError) throw updateError
          console.log('Video processing completed successfully')

          setStatus('Processing completed!')
        } catch (ffmpegError) {
          console.error('FFmpeg processing error:', ffmpegError)
          throw new Error('Failed to process video: ' + (ffmpegError instanceof Error ? ffmpegError.message : 'Unknown error'))
        }
      }
    } catch (error) {
      console.error('Error:', error)
      setStatus(error instanceof Error ? error.message : 'Error processing video')
      
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
        {status && (
          <p className="mt-2 text-sm text-gray-500">{status}</p>
        )}
      </div>
      
      {currentVideoId && (
        <VideoFrames videoId={currentVideoId} />
      )}
    </div>
  )
} 