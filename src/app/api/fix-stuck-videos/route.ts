import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// Maximum processing time in minutes before considering a video as stuck
const MAX_PROCESSING_TIME_MINUTES = 30;

export async function GET(request: Request) {
  try {
    // Get all videos in processing state
    const { data: processingVideos, error: queryError } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'processing')
    
    if (queryError) {
      return NextResponse.json(
        { error: `Failed to query videos: ${queryError.message}` }, 
        { status: 500 }
      )
    }
    
    const now = new Date();
    const fixedVideos = [];
    
    // Check each processing video
    for (const video of processingVideos || []) {
      if (video.processing_started_at) {
        const processingStartedAt = new Date(video.processing_started_at);
        const processingTimeMinutes = (now.getTime() - processingStartedAt.getTime()) / (1000 * 60);
        
        // If processing for too long, mark as error
        if (processingTimeMinutes > MAX_PROCESSING_TIME_MINUTES) {
          const { error: updateError } = await supabase
            .from('videos')
            .update({ 
              status: 'error',
              updated_at: now.toISOString(),
              error_message: 'Processing timeout exceeded'
            })
            .eq('id', video.id);
            
          if (!updateError) {
            fixedVideos.push({
              id: video.id,
              display_name: video.display_name,
              processingTime: processingTimeMinutes.toFixed(1)
            });
          }
        }
      } else {
        // If no processing_started_at, update it
        await supabase
          .from('videos')
          .update({ 
            processing_started_at: video.created_at || now.toISOString()
          })
          .eq('id', video.id);
      }
    }
    
    return NextResponse.json({ 
      message: `Fixed ${fixedVideos.length} stuck videos`,
      fixedVideos
    })
    
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
}

// Also handle POST requests to fix a specific video
export async function POST(request: Request) {
  try {
    const { videoId } = await request.json()
    
    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' }, 
        { status: 400 }
      )
    }
    
    // Get video details
    const { data: video, error: videoError } = await supabase
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
    
    if (!video.project_id) {
      return NextResponse.json(
        { error: 'Video has no associated project ID' }, 
        { status: 400 }
      )
    }
    
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
      
      console.log(`Generating ${numFrames} frames for video ${videoId} during fix`);
      
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
        const storagePath = `${video.project_id}/${videoId}/frame_${i}.jpg`;
        
        // Simulate uploading the frame to storage
        // In a real app, you would download the frame from the video and upload it
        const sampleImageUrl = sampleFrameUrls[i % sampleFrameUrls.length];
        
        try {
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
          
        return NextResponse.json({ 
          message: 'Failed to generate any frames for the video',
          videoId,
          status: 'error'
        }, { status: 500 });
      }
    } else {
      console.log(`Video ${videoId} already has ${existingFrames.length} frames, skipping frame generation`);
    }
    
    // Mark the video as completed
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('videos')
      .update({ 
        status: 'completed',
        updated_at: now,
        processing_completed_at: now
      })
      .eq('id', videoId);
    
    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update video: ${updateError.message}` }, 
        { status: 500 }
      )
    }
    
    // Get the final count of frames
    const { data: finalFrames, error: finalFramesError } = await supabase
      .from('frames')
      .select('id')
      .eq('video_id', videoId)
    
    const frameCount = finalFrames ? finalFrames.length : 0;
    
    return NextResponse.json({ 
      message: 'Video marked as completed with frames generated',
      videoId,
      framesGenerated: frameCount
    })
    
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
} 