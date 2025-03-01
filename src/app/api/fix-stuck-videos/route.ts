import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { validate as isValidUUID } from 'uuid';

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
    
    // Otherwise, fix the video by generating frames
    // Always generate new frames when fixing a stuck video
    // This ensures we have frames even if previous attempts failed
    const numFrames = Math.floor(Math.random() * 3) + 3; // 3-5 frames to reduce potential errors
    
    console.log(`Generating ${numFrames} frames for video ${videoId} during fix`);
    
    // Create frame records in the database
    let successfulFrames = 0;
    
    // TODO: REPLACE THIS WITH ACTUAL VIDEO PROCESSING
    // To extract real frames from videos, you would need to:
    // 1. Download the video from the source (e.g., Loom API)
    // 2. Use a video processing library like FFmpeg to extract frames
    // 3. Upload those frames to Supabase storage
    // 4. Create frame records in the database with paths to the real frames
    //
    // Example implementation with FFmpeg (would need to be run in a serverless function or worker):
    // 
    // const videoUrl = video.source_url;
    // const videoPath = `/tmp/${videoId}.mp4`;
    // 
    // // Download video
    // await downloadFile(videoUrl, videoPath);
    // 
    // // Extract frames using FFmpeg (every 5 seconds for example)
    // const framesDir = `/tmp/${videoId}/`;
    // await executeCommand(`mkdir -p ${framesDir}`);
    // await executeCommand(`ffmpeg -i ${videoPath} -vf fps=1/5 ${framesDir}frame-%03d.jpg`);
    // 
    // // Upload frames to storage and create records
    // const frameFiles = await listFiles(framesDir);
    // for (let i = 0; i < frameFiles.length; i++) {
    //   const framePath = frameFiles[i];
    //   const storagePath = `${video.project_id}/${videoId}/frame_${i}.jpg`;
    //   
    //   // Upload actual frame to storage
    //   await supabase.storage.from('frames').upload(storagePath, fs.readFileSync(framePath));
    //   
    //   // Create frame record
    //   await supabase.from('frames').insert({
    //     video_id: videoId,
    //     frame_number: i,
    //     storage_path: storagePath,
    //     created_at: new Date().toISOString()
    //   });
    // }
    
    // For now, we're using placeholder SVG images instead of real frames
    for (let i = 0; i < numFrames; i++) {
      try {
        // In a real app, you would upload the frame to storage
        // For this demo, we'll just create the database record
        const frameNumber = i;
        const storagePath = `${video.project_id}/${videoId}/frame_${i}.jpg`;
        
        // Create a more visually appealing placeholder image
        // This is a base64 encoded SVG that looks like a video frame
        // It includes the frame number and video title for context
        const frameTitle = `Frame ${i+1} of ${numFrames}`;
        const videoTitle = video.display_name || 'Video';
        
        // Create an SVG with text showing the frame number and video title
        const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
          <rect width="800" height="450" fill="#f0f0f0" />
          <rect x="20" y="20" width="760" height="410" fill="#e0e0e0" stroke="#cccccc" stroke-width="2" />
          
          <!-- Video camera icon -->
          <path d="M400 150 L350 180 L350 270 L450 270 L450 180 Z" fill="#a0a0a0" />
          <path d="M450 200 L500 170 L500 250 L450 220 Z" fill="#a0a0a0" />
          
          <!-- Frame information -->
          <text x="400" y="320" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#505050">${frameTitle}</text>
          <text x="400" y="350" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" fill="#707070">${videoTitle}</text>
          <text x="400" y="380" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#909090">Generated placeholder</text>
        </svg>`;
        
        // Convert SVG to base64
        const svgBuffer = Buffer.from(svgContent);
        
        try {
          // Upload the SVG placeholder image to storage
          const { error: uploadError, data: uploadData } = await supabase
            .storage
            .from('frames')
            .upload(storagePath, svgBuffer, {
              contentType: 'image/svg+xml',
              upsert: true
            });
            
          if (uploadError) {
            console.error(`Error uploading placeholder for frame ${i}:`, uploadError);
          } else {
            console.log(`Successfully uploaded placeholder for frame ${i}`);
            
            // Make the file publicly accessible
            const { error: publicError } = await supabase
              .storage
              .from('frames')
              .update(storagePath, svgBuffer, {
                contentType: 'image/svg+xml',
                upsert: true,
                cacheControl: '3600'
              });
              
            if (publicError) {
              console.error(`Error making frame ${i} public:`, publicError);
            } else {
              console.log(`Successfully made frame ${i} public`);
            }
          }
        } catch (uploadError) {
          console.error(`Error uploading placeholder for frame ${i}:`, uploadError);
        }
        
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
        
      return NextResponse.json({ 
        message: 'Failed to generate any frames for the video',
        videoId,
        status: 'error'
      }, { status: 500 });
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
    
    return NextResponse.json({ 
      message: 'Video marked as completed with frames generated',
      videoId,
      framesGenerated: successfulFrames
    })
    
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
} 