import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import axios from 'axios'

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
    const body = await request.json()
    const { videoId } = body
    
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
    }
    
    console.log(`Processing video: ${videoId}`);
    
    // Get video details from database
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()
    
    if (videoError || !video) {
      console.error('Error fetching video:', videoError);
      return NextResponse.json({ 
        error: videoError ? videoError.message : 'Video not found' 
      }, { status: 404 })
    }
    
    // Check if video is already processing and has been for too long
    if (video.status === 'processing' && video.processing_started_at) {
      const processingStartedAt = new Date(video.processing_started_at);
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
    
    // Update status to processing
    await supabase
      .from('videos')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);
    
    // Generate 5 placeholder frames
    const numFrames = 5;
    let successfulFrames = 0;
    
    for (let i = 0; i < numFrames; i++) {
      try {
        const storagePath = `${video.project_id}/${videoId}/frame_${i}.jpg`;
        
        // Create a placeholder image URL (in a real implementation, this would be a real frame)
        // We're using a placeholder image service to generate a random image
        const placeholderUrl = `https://picsum.photos/800/450?random=${videoId}-${i}`;
        
        // Download the placeholder image
        const response = await axios.get(placeholderUrl, {
          responseType: 'arraybuffer'
        });
        
        // Upload to Supabase storage
        const { error: uploadError } = await supabase
          .storage
          .from('frames')
          .upload(storagePath, response.data, {
            contentType: 'image/jpeg',
            upsert: true
          });
        
        if (uploadError) {
          console.error(`Error uploading frame ${i}:`, uploadError);
          continue;
        }
        
        // Make the file publicly accessible
        const { error: publicError } = await supabase
          .storage
          .from('frames')
          .update(storagePath, response.data, {
            contentType: 'image/jpeg',
            upsert: true,
            cacheControl: '3600'
          });
        
        if (publicError) {
          console.error(`Error making frame ${i} public:`, publicError);
        }
        
        // Create frame record in database
        const { error: insertError } = await supabase
          .from('frames')
          .insert({
            video_id: videoId,
            frame_number: i,
            storage_path: storagePath,
            created_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error(`Error inserting frame ${i}:`, insertError);
          continue;
        }
        
        successfulFrames++;
        console.log(`Successfully processed frame ${i+1}/${numFrames}`);
      } catch (error) {
        console.error(`Error processing frame ${i}:`, error);
      }
    }
    
    // Update video status
    const now = new Date().toISOString();
    await supabase
      .from('videos')
      .update({
        status: successfulFrames > 0 ? 'completed' : 'error',
        updated_at: now,
        processing_completed_at: now,
        error_message: successfulFrames > 0 ? null : 'Failed to generate any frames'
      })
      .eq('id', videoId);
    
    return NextResponse.json({
      success: true,
      message: 'Video processed successfully',
      framesGenerated: successfulFrames
    });
  } catch (error: any) {
    console.error('Error processing video:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error' 
    }, { status: 500 });
  }
} 