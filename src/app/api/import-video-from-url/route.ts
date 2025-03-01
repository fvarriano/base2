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
    
    // Return success immediately to the client
    // This allows the client to continue while processing happens in the background
    const response = NextResponse.json({
      message: 'Video import started successfully! Processing in the background...',
      videoId,
      displayName,
      status: 'processing'
    });
    
    // Process the video in the background
    // This won't block the response
    processVideoInBackground(videoId, projectId).catch(error => {
      console.error('Background processing error:', error);
    });
    
    return response;
    
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
}

// Separate function to process the video in the background
async function processVideoInBackground(videoId: string, projectId: string) {
  try {
    console.log(`Starting background processing for video ${videoId}`);
    
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
      throw updateError;
    }
    
    // Generate 5 placeholder frames
    const numFrames = 5;
    let successfulFrames = 0;
    
    for (let i = 0; i < numFrames; i++) {
      try {
        const storagePath = `${projectId}/${videoId}/frame_${i}.jpg`;
        
        // Create a placeholder image URL
        const placeholderUrl = `https://via.placeholder.com/800x450.jpg?text=Frame+${i+1}`;
        
        console.log(`Downloading placeholder image from: ${placeholderUrl}`);
        
        // Download the placeholder image
        const response = await axios.get(placeholderUrl, {
          responseType: 'arraybuffer'
        });
        
        console.log(`Successfully downloaded placeholder image ${i+1}, size: ${response.data.length} bytes`);
        
        // Assume the frames bucket already exists
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
        const { data: publicUrlData } = supabase
          .storage
          .from('frames')
          .getPublicUrl(storagePath);
        
        console.log(`Public URL for frame ${i}:`, publicUrlData.publicUrl);
        
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
    const { error: finalUpdateError } = await supabase
      .from('videos')
      .update({
        status: successfulFrames > 0 ? 'completed' : 'error',
        updated_at: now,
        processing_completed_at: now,
        error_message: successfulFrames > 0 ? null : 'Failed to generate any frames'
      })
      .eq('id', videoId);
    
    if (finalUpdateError) {
      console.error('Error updating final video status:', finalUpdateError);
      throw finalUpdateError;
    }
    
    console.log(`Video processing completed for ${videoId} with ${successfulFrames} frames`);
    
  } catch (error) {
    console.error('Error in background processing:', error);
    
    // Update video status to error
    await supabase
      .from('videos')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error during processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);
    
    throw error;
  }
} 