import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// Maximum processing time in minutes before considering a video as stuck
const MAX_PROCESSING_TIME_MINUTES = 30;

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
    
    // Check if video is already processing and has been for too long
    if (videoData.status === 'processing' && videoData.processing_started_at) {
      const processingStartedAt = new Date(videoData.processing_started_at);
      const now = new Date();
      const processingTimeMinutes = (now.getTime() - processingStartedAt.getTime()) / (1000 * 60);
      
      if (processingTimeMinutes > MAX_PROCESSING_TIME_MINUTES) {
        // Video has been processing for too long, mark as error
        await supabase
          .from('videos')
          .update({ 
            status: 'error',
            updated_at: now.toISOString(),
            error_message: 'Processing timeout exceeded'
          })
          .eq('id', videoId);
          
        return NextResponse.json({ 
          message: 'Video processing failed due to timeout',
          videoId,
          status: 'error'
        });
      }
    }
    
    // Update status to processing with current timestamp
    const now = new Date().toISOString()
    await supabase
      .from('videos')
      .update({ 
        status: 'processing',
        updated_at: now,
        processing_started_at: now
      })
      .eq('id', videoId)
    
    // Simulate processing by updating status after a delay (for demo purposes)
    // In a real app, this would be handled by a background worker
    setTimeout(async () => {
      try {
        // Simulate processing time based on file size
        const processingTime = Math.random() * 10000 + 5000; // 5-15 seconds for demo
        
        // After the delay, update the status to completed
        await supabase
          .from('videos')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString(),
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', videoId)
          
        console.log(`Video ${videoId} processing completed after ${processingTime/1000} seconds`)
      } catch (error) {
        console.error('Error updating video status:', error)
        
        // Update status to error
        await supabase
          .from('videos')
          .update({ 
            status: 'error',
            updated_at: new Date().toISOString(),
            error_message: 'Failed to process video'
          })
          .eq('id', videoId)
      }
    }, Math.random() * 10000 + 5000) // Random delay between 5-15 seconds for demo
    
    // Return immediately to client
    return NextResponse.json({ 
      message: 'Video processing started',
      videoId,
      status: 'processing'
    })
    
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
} 