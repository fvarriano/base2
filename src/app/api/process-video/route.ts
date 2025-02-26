import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// This is a simplified version for demonstration
// In production, you would use a queue system like AWS SQS or a background worker
export async function POST(request: Request) {
  try {
    const { videoId, projectId } = await request.json()
    
    if (!videoId || !projectId) {
      return NextResponse.json(
        { error: 'Video ID and Project ID are required' }, 
        { status: 400 }
      )
    }
    
    // Get video details from database
    const { data: videoData, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()
    
    if (videoError) {
      return NextResponse.json(
        { error: `Failed to get video: ${videoError.message}` }, 
        { status: 500 }
      )
    }
    
    // Update status to processing
    await supabase
      .from('videos')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)
    
    // Start processing in the background
    // Note: This is not ideal for production as the request might timeout
    // In production, use a proper queue system or background worker
    processVideo(videoData, projectId).catch(error => {
      console.error('Video processing error:', error)
      // Update status to error
      supabase
        .from('videos')
        .update({ 
          status: 'error',
          error_message: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId)
    })
    
    // Return immediately to client
    return NextResponse.json({ 
      message: 'Video processing started',
      videoId
    })
    
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
}

// This function processes the video in the background
// In production, this would be a separate worker process
async function processVideo(videoData: any, projectId: string) {
  console.log('Starting video processing for:', videoData.id)
  
  try {
    // Initialize FFmpeg
    const ffmpeg = new FFmpeg()
    await ffmpeg.load({
      coreURL: '/ffmpeg-core.js',
      wasmURL: '/ffmpeg-core.wasm',
      workerURL: '/ffmpeg-core.worker.js',
    })
    
    // Download video from storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('videos')
      .download(videoData.storage_path)
    
    if (fileError) throw new Error(`Failed to download video: ${fileError.message}`)
    
    // Process with FFmpeg
    await ffmpeg.writeFile('input.mp4', await fetchFile(fileData))
    
    // Extract frames (adjust parameters as needed)
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-vf', 'fps=1/2',  // 1 frame every 2 seconds
      '-vframes', '60',  // Maximum 60 frames
      '-q:v', '3',       // Quality setting
      '-f', 'image2',
      '-y',
      'frame-%03d.jpg'
    ])
    
    // Get list of generated frames
    const frames = await ffmpeg.listDir('/') as any[]
    const frameFiles = frames.filter(f => 
      f.name.startsWith('frame-') && f.name.endsWith('.jpg')
    )
    
    console.log(`Extracted ${frameFiles.length} frames`)
    
    // Upload frames to storage
    for (let i = 0; i < frameFiles.length; i++) {
      const frameFile = frameFiles[i]
      const frameData = await ffmpeg.readFile(frameFile.name)
      
      // Create a temporary file name for the frame
      const tempFileName = `frame_${i}.jpg`
      
      // Write the frame data to a temporary file
      await ffmpeg.writeFile(tempFileName, frameData)
      
      // Read the file as a Uint8Array
      const frameBytes = await ffmpeg.readFile(tempFileName)
      
      // Upload frame
      const framePath = `${projectId}/${videoData.id}/frame_${i}.jpg`
      const { error: uploadError } = await supabase
        .storage
        .from('frames')
        .upload(framePath, frameBytes, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true
        })
      
      if (uploadError) throw new Error(`Failed to upload frame: ${uploadError.message}`)
      
      // Create frame record
      const { error: frameRecordError } = await supabase
        .from('frames')
        .insert({
          video_id: videoData.id,
          frame_number: i,
          storage_path: framePath
        })
      
      if (frameRecordError) throw new Error(`Failed to create frame record: ${frameRecordError.message}`)
    }
    
    // Update video status to completed
    await supabase
      .from('videos')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoData.id)
    
    console.log('Video processing completed for:', videoData.id)
    
  } catch (error: any) {
    console.error('Processing error:', error)
    
    // Update video status to error
    await supabase
      .from('videos')
      .update({ 
        status: 'error',
        error_message: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoData.id)
    
    throw error
  }
} 