import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase client with service role key for admin access
// Note: This should be kept secure and only used in trusted server environments
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' // Use service role key for admin privileges
);

/**
 * Processes a video to extract frames using the video processor service
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
    
    // Call the video processor service
    const processorUrl = process.env.NEXT_PUBLIC_VIDEO_PROCESSOR_URL;
    if (!processorUrl) {
      throw new Error('Video processor URL not configured');
    }
    
    console.log(`Calling video processor service at ${processorUrl}`);
    
    const response = await axios.post(`${processorUrl}/process`, {
      videoUrl: video.source_url,
      videoId: video.id,
      projectId: video.project_id
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.VIDEO_PROCESSOR_API_KEY || ''
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Unknown error from video processor');
    }
    
    console.log(`Video processor response:`, response.data);
    
    return {
      success: true,
      framesGenerated: response.data.frameCount
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