import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import axios from 'axios'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Maximum processing time in minutes before considering a video as stuck
const MAX_PROCESSING_TIME_MINUTES = 30;

// This is a simplified version for demonstration
// In production, you would use a queue system like AWS SQS or a background worker
export async function POST(request: Request) {
  try {
    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    // Get video details from database
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return NextResponse.json(
        { error: `Video not found: ${videoError?.message || 'Unknown error'}` },
        { status: 404 }
      );
    }

    if (!video.project_id) {
      console.error('Video has no project ID:', videoId);
      return NextResponse.json({ 
        error: 'Video has no associated project ID' 
      }, { status: 400 })
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
        processing_started_at: new Date().toISOString(),
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

    return NextResponse.json({
      success: true,
      message: 'Video processing started successfully',
      framesGenerated: response.data.frameCount
    });
  } catch (error: any) {
    console.error('Error processing video:', error);

    // Update video status to error if we have a videoId
    try {
      const { videoId } = await request.json();
      if (videoId) {
        await supabase
          .from('videos')
          .update({
            status: 'error',
            updated_at: new Date().toISOString(),
            error_message: error.message || 'Unknown error during processing'
          })
          .eq('id', videoId);
      }
    } catch (updateError) {
      console.error('Error updating video status:', updateError);
    }

    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error' 
    }, { status: 500 });
  }
} 