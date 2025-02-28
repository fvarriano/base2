import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import fetch from 'node-fetch'

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
    const { videoId, projectId, videoUrl, loomVideoId } = await request.json()
    
    console.log('Process video request received:', { videoId, projectId, loomVideoId });
    
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
        
        console.log(`Starting delayed processing for video ${videoId} (${processingTime/1000}s delay)`);
        
        // Generate frames for the video
        const numFrames = Math.floor(Math.random() * 3) + 3; // 3-5 frames
        
        console.log(`Generating ${numFrames} frames for video ${videoId}`);
        
        // Create frame records in the database
        let successfulFrames = 0;
        
        for (let i = 0; i < numFrames; i++) {
          try {
            // In a real app, you would upload the frame to storage
            // For this demo, we'll just create the database record
            const frameNumber = i;
            const storagePath = `${projectId}/${videoId}/frame_${i}.jpg`;
            
            // Create frame record in database directly without storage
            // This simplifies the process and reduces potential points of failure
            const { error: insertError } = await supabase
              .from('frames')
              .insert({
                video_id: videoId,
                frame_number: frameNumber,
                storage_path: storagePath,
                created_at: new Date().toISOString()
              });
              
            if (insertError) {
              console.error(`Error inserting frame ${i}:`, insertError);
              continue;
            }
            
            successfulFrames++;
            console.log(`Successfully created frame ${i} for video ${videoId}`);
          } catch (error) {
            console.error(`Error processing frame ${i}:`, error);
          }
        }
        
        console.log(`Successfully created ${successfulFrames} frame records out of ${numFrames} attempted`);
        
        if (successfulFrames === 0) {
          // If no frames were created successfully, mark as error
          await supabase
            .from('videos')
            .update({ 
              status: 'error',
              updated_at: new Date().toISOString(),
              error_message: 'Failed to generate any frames'
            })
            .eq('id', videoId);
            
          console.log(`Video ${videoId} processing failed - no frames could be generated`);
          return;
        }
        
        // After the delay, update the status to completed
        await supabase
          .from('videos')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString(),
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', videoId)
        
        console.log(`Video ${videoId} processing completed after ${processingTime/1000} seconds with ${successfulFrames} frames`)
      } catch (error) {
        console.error('Error updating video status:', error)
        
        // Update status to error
        await supabase
          .from('videos')
          .update({ 
            status: 'error',
            updated_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Failed to process video'
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