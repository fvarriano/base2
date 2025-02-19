// @ts-ignore
import { FFmpeg } from '@ffmpeg/ffmpeg'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
}

interface FFmpegFile {
  name: string
  // Add other properties if needed
}

export default {
  async fetch(request: Request, env: Env) {
    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    try {
      const { videoId, storagePath } = await request.json()

      // Initialize FFmpeg
      const ffmpeg = new FFmpeg()
      await ffmpeg.load({
        coreURL: await fetch('https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js').then(r => r.url),
        wasmURL: await fetch('https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm').then(r => r.url)
      })

      // Get video from Supabase
      const response = await fetch(
        `${env.SUPABASE_URL}/storage/v1/object/public/videos/${storagePath}`,
        {
          headers: {
            Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch video')
      }

      const videoData = await response.arrayBuffer()

      // Write video to FFmpeg's virtual filesystem
      await ffmpeg.writeFile('input.mp4', new Uint8Array(videoData))

      // Extract frames (1 frame per second)
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-vf', 'fps=1',
        'frame_%d.jpg'
      ])

      // Get list of generated frames with proper typing
      const frames: FFmpegFile[] = await ffmpeg.listDir('/')
      const frameFiles = frames.filter(f => f.name.startsWith('frame_'))

      // Upload frames to Supabase
      for (const frame of frameFiles) {
        const frameData = await ffmpeg.readFile(frame.name)
        const framePath = `${videoId}/${frame.name}`

        // Upload to Supabase storage
        await fetch(
          `${env.SUPABASE_URL}/storage/v1/object/frames/${framePath}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'image/jpeg'
            },
            body: frameData
          }
        )
      }

      return new Response(JSON.stringify({ 
        success: true,
        frames: frameFiles.length 
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Error processing video:', error)
      return new Response(JSON.stringify({ 
        success: false,
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}