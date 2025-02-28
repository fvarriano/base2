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
        
        // Check if frames already exist for this video
        const { data: existingFrames, error: framesError } = await supabase
          .from('frames')
          .select('id')
          .eq('video_id', videoId)
        
        if (framesError) {
          console.error('Error checking existing frames:', framesError);
        }
        
        // Only generate new frames if none exist
        if (!existingFrames || existingFrames.length === 0) {
          // Generate some sample frames (in a real app, you would extract these from the video)
          const numFrames = Math.floor(Math.random() * 5) + 3; // 3-7 frames
          
          console.log(`Generating ${numFrames} frames for video ${videoId}`);
          
          // Sample frame URLs - in a real app, these would be actual extracted frames
          const sampleFrameUrls = [
            'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7',
            'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0',
            'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb',
            'https://images.unsplash.com/photo-1611162616475-b1a91bd5a1d6',
            'https://images.unsplash.com/photo-1611162617263-4ec3a5c84103',
            'https://images.unsplash.com/photo-1611162616390-aaa3b4444fff',
            'https://images.unsplash.com/photo-1611162618479-ee4d1e0e5ac9'
          ];
          
          // Create frame records in the database
          const framePromises = [];
          
          for (let i = 0; i < numFrames; i++) {
            // In a real app, you would upload the frame to storage
            // For this demo, we'll just create the database record
            const frameNumber = i;
            const storagePath = `${projectId}/${videoId}/frame_${i}.jpg`;
            
            try {
              // Simulate uploading the frame to storage
              // In a real app, you would download the frame from the video and upload it
              const sampleImageUrl = sampleFrameUrls[i % sampleFrameUrls.length];
              const response = await fetch(sampleImageUrl);
              
              if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
              }
              
              const imageBuffer = await response.arrayBuffer();
              
              // Upload the image to Supabase storage
              const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('frames')
                .upload(storagePath, imageBuffer, {
                  contentType: 'image/jpeg',
                  upsert: true
                });
                
              if (uploadError) {
                console.error(`Error uploading frame ${i}:`, uploadError);
                continue;
              }
              
              // Create frame record in database
              const framePromise = supabase
                .from('frames')
                .insert({
                  video_id: videoId,
                  frame_number: frameNumber,
                  storage_path: storagePath,
                  created_at: new Date().toISOString()
                });
                
              framePromises.push(framePromise);
            } catch (error) {
              console.error(`Error processing frame ${i}:`, error);
            }
          }
          
          // Wait for all frame insertions to complete
          const frameResults = await Promise.allSettled(framePromises);
          const successfulFrames = frameResults.filter(result => result.status === 'fulfilled').length;
          
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
        } else {
          console.log(`Video ${videoId} already has ${existingFrames.length} frames, skipping frame generation`);
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
          
        // Get the final count of frames
        const { data: finalFrames } = await supabase
          .from('frames')
          .select('id')
          .eq('video_id', videoId)
        
        const frameCount = finalFrames ? finalFrames.length : 0;
        
        console.log(`Video ${videoId} processing completed after ${processingTime/1000} seconds with ${frameCount} frames`)
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