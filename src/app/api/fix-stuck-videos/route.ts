import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { validate as isValidUUID } from 'uuid';
import axios from 'axios';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// Maximum processing time in minutes before considering a video as stuck
const MAX_PROCESSING_TIME_MINUTES = 30;

export async function GET(request: Request) {
  console.log('Fix stuck videos GET request received');
  
  try {
    // Find videos that have been processing for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    console.log('Looking for videos processing since before:', fiveMinutesAgo);
    
    const { data: stuckVideos, error } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'processing')
      .lt('processing_started_at', fiveMinutesAgo);
    
    if (error) {
      console.error('Error fetching stuck videos:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    console.log(`Found ${stuckVideos?.length || 0} stuck videos`);
    
    if (!stuckVideos || stuckVideos.length === 0) {
      return NextResponse.json({ message: 'No stuck videos found' });
    }
    
    const now = new Date();
    const fixedVideos = [];
    
    // Check each processing video
    for (const video of stuckVideos || []) {
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
  console.log('Fix stuck videos POST request received');
  
  try {
    const body = await request.json();
    const { videoId, action = 'fix' } = body;
    
    if (!videoId) {
      console.error('Missing videoId in request body');
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }
    
    // Validate that videoId is a valid UUID
    if (!isValidUUID(videoId)) {
      console.error('Invalid UUID format for videoId:', videoId);
      return NextResponse.json({ error: 'Invalid video ID format' }, { status: 400 });
    }
    
    console.log(`${action === 'cancel' ? 'Cancelling' : 'Fixing'} specific video:`, videoId);
    
    // Get the video details
    const { data: video, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (error) {
      console.error('Error fetching video:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!video) {
      console.error('Video not found:', videoId);
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    
    console.log('Found video to process:', video.display_name);
    
    if (!video.project_id) {
      return NextResponse.json(
        { error: 'Video has no associated project ID' }, 
        { status: 400 }
      )
    }
    
    // If action is cancel, just mark the video as cancelled
    if (action === 'cancel') {
      const { error: updateError } = await supabase
        .from('videos')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString(),
          processing_completed_at: new Date().toISOString(),
          error_message: 'Processing cancelled by user'
        })
        .eq('id', videoId);
      
      if (updateError) {
        console.error('Error cancelling video:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      
      return NextResponse.json({ 
        message: 'Video processing cancelled',
        videoId,
        status: 'cancelled'
      });
    }
    
    // Process the video using our process-video API endpoint
    console.log(`Starting video processing for video ${videoId}`);
    
    try {
      // Call the process-video API endpoint
      const response = await axios.post(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/process-video`, {
        videoId
      });
      
      return NextResponse.json({ 
        message: 'Video processed successfully with real frames',
        videoId,
        framesGenerated: response.data.framesGenerated
      });
    } catch (processError: any) {
      console.error('Error processing video:', processError);
      
      // If there's a response with error details
      if (processError.response && processError.response.data) {
        return NextResponse.json({ 
          message: 'Failed to process video',
          videoId,
          error: processError.response.data.error || 'Unknown error',
          status: 'error'
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        message: 'Failed to process video',
        videoId,
        error: processError.message || 'Unknown error',
        status: 'error'
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
} 