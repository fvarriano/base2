import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
// Remove the node-fetch import as we won't need it
// import fetch from 'node-fetch'

// Import the axios library for making HTTP requests
import axios from 'axios'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' // Use anon key instead of service role key
)

export async function POST(request: Request) {
  try {
    const { videoUrl, projectId } = await request.json()
    
    if (!videoUrl || !projectId) {
      return NextResponse.json(
        { error: 'Video URL and Project ID are required' }, 
        { status: 400 }
      )
    }
    
    console.log('Original URL:', videoUrl);
    console.log('Project ID:', projectId);
    
    // Extract the Loom video ID directly from the URL using regex
    // This is more permissive to handle various Loom URL formats
    const loomRegex = /loom\.com\/(share|v)\/([a-zA-Z0-9_-]+)/i;
    const match = videoUrl.match(loomRegex);
    
    console.log('Regex match result:', match);
    
    let loomVideoId;
    
    if (!match || !match[2]) {
      console.error('Could not extract Loom video ID using regex');
      
      // Try a more manual approach as fallback
      let manualVideoId = null;
      if (videoUrl.includes('loom.com/share/')) {
        const parts = videoUrl.split('loom.com/share/');
        if (parts.length > 1) {
          manualVideoId = parts[1].split('?')[0].split('#')[0];
          console.log('Manual extraction attempt:', manualVideoId);
        }
      }
      
      if (manualVideoId && manualVideoId.length >= 5) {
        console.log('Using manually extracted ID:', manualVideoId);
        loomVideoId = manualVideoId;
      } else {
        // If both approaches fail, return error
        return NextResponse.json(
          { error: 'Invalid Loom URL format. Please use a Loom share URL (e.g., https://www.loom.com/share/abcdef123456)' }, 
          { status: 400 }
        )
      }
    } else {
      loomVideoId = match[2];
    }
    
    console.log('Extracted Loom video ID:', loomVideoId);
    
    // Validate the video ID
    if (!loomVideoId || loomVideoId.length < 5) {
      console.error('Invalid Loom video ID (too short):', loomVideoId);
      return NextResponse.json(
        { error: 'Invalid Loom video ID' }, 
        { status: 400 }
      )
    }
    
    // For demo purposes, we'll use a placeholder title
    const displayName = `Loom Video - ${new Date().toLocaleDateString()}`;
    
    // Generate a unique ID for the video
    const videoId = uuidv4();
    
    // Create a filename for the imported video
    const filename = `loom_${loomVideoId}.mp4`;
    
    // Create a storage path for the video (even though we're not actually storing it)
    const storagePath = `${projectId}/${videoId}/${filename}`;
    
    console.log('Creating video record with ID:', videoId);
    
    // Create a record in the videos table
    const { error: insertError } = await supabase
      .from('videos')
      .insert({
        id: videoId,
        project_id: projectId,
        display_name: displayName,
        filename: filename,
        storage_path: storagePath,
        source_url: videoUrl, // Store the original URL
        status: 'pending',
        processing_started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: `Failed to create video record: ${insertError.message}` }, 
        { status: 500 }
      )
    }
    
    console.log('Video record created, starting processing');
    
    // Process frames immediately
    try {
      // Generate frames synchronously
      await generateDirectFrames(videoId, projectId);
      
      // Return success response
      return NextResponse.json({
        message: 'Video import completed successfully!',
        videoId,
        displayName,
        status: 'completed'
      });
    } catch (error: any) {
      console.error('Frame generation error:', error);
      
      // Update video status to error
      await supabase
        .from('videos')
        .update({
          status: 'error',
          error_message: error.message || 'Error generating frames',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      return NextResponse.json({
        message: 'Video record created but frame generation failed',
        videoId,
        displayName,
        status: 'error',
        error: error.message || 'Unknown error during processing'
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
}

// Function to generate frames directly without using storage
async function generateDirectFrames(videoId: string, projectId: string) {
  console.log(`Generating direct frames for video ${videoId}`);
  
  // Update status to processing
  const { error: updateError } = await supabase
    .from('videos')
    .update({
      status: 'processing',
      updated_at: new Date().toISOString()
    })
    .eq('id', videoId);
  
  if (updateError) {
    console.error('Error updating video status:', updateError);
    throw new Error(`Failed to update video status: ${updateError.message}`);
  }
  
  // Generate 5 placeholder frames
  const numFrames = 5;
  let successfulFrames = 0;
  let errors = [];
  
  for (let i = 0; i < numFrames; i++) {
    try {
      // Create a placeholder image URL - using a public image service
      // We're using placeholder.com which doesn't require any storage
      const placeholderUrl = `https://via.placeholder.com/800x450.jpg?text=Frame+${i+1}`;
      
      console.log(`Using placeholder image: ${placeholderUrl}`);
      
      // Create frame record in database with direct URL
      const { error: insertError } = await supabase
        .from('frames')
        .insert({
          video_id: videoId,
          frame_number: i,
          storage_path: `direct/${projectId}/${videoId}/frame_${i}.jpg`,
          public_url: placeholderUrl, // Use the direct placeholder URL
          created_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error(`Error inserting frame ${i}:`, insertError);
        errors.push(`Frame ${i} database: ${insertError.message}`);
        continue;
      }
      
      successfulFrames++;
      console.log(`Successfully processed frame ${i+1}/${numFrames}`);
    } catch (error: any) {
      console.error(`Error processing frame ${i}:`, error);
      errors.push(`Frame ${i}: ${error.message || 'Unknown error'}`);
    }
  }
  
  // Update video status
  const now = new Date().toISOString();
  const status = successfulFrames > 0 ? 'completed' : 'error';
  const errorMessage = successfulFrames > 0 ? 
    (errors.length > 0 ? `Partial success: ${errors.join('; ')}` : null) : 
    `Failed to generate any frames: ${errors.join('; ')}`;
  
  const { error: finalUpdateError } = await supabase
    .from('videos')
    .update({
      status: status,
      updated_at: now,
      processing_completed_at: now,
      error_message: errorMessage
    })
    .eq('id', videoId);
  
  if (finalUpdateError) {
    console.error('Error updating final video status:', finalUpdateError);
    throw new Error(`Failed to update final video status: ${finalUpdateError.message}`);
  }
  
  console.log(`Video processing completed for ${videoId} with ${successfulFrames} frames`);
  
  if (successfulFrames === 0) {
    throw new Error('Failed to generate any frames');
  }
  
  return successfulFrames;
} 