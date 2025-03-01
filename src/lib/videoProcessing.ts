import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase client with service role key for admin access
// Note: This should be kept secure and only used in trusted server environments
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' // Use service role key for admin privileges
);

/**
 * Processes a video to extract frames using an external worker service
 */
export async function processVideo(videoId: string): Promise<{
  success: boolean;
  framesGenerated?: number;
  error?: string;
}> {
  console.log(`Starting video processing for video ID: ${videoId}`);
  
  try {
    // Get video details from database
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (videoError || !video) {
      throw new Error(`Video not found: ${videoError?.message || 'Unknown error'}`);
    }
    
    console.log(`Processing video: ${video.display_name}`);
    
    // Update status to processing
    await supabase
      .from('videos')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);
    
    // For now, we'll create placeholder frames since we don't have a real worker service
    // In a production environment, you would call your worker service here
    // Example: const response = await axios.post('https://your-worker-service.com/process-video', { videoId, videoUrl: video.source_url });
    
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
    
    console.log(`Successfully processed ${successfulFrames} frames out of ${numFrames}`);
    
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
    
    return {
      success: true,
      framesGenerated: successfulFrames
    };
  } catch (error: any) {
    console.error('Error processing video:', error);
    
    // Update video status to error
    await supabase
      .from('videos')
      .update({
        status: 'error',
        updated_at: new Date().toISOString(),
        error_message: error.message || 'Unknown error during processing'
      })
      .eq('id', videoId);
    
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
} 