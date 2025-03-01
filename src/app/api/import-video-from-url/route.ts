import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import fetch from 'node-fetch'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
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
    
    // Always use the local fix-stuck-videos endpoint directly
    // This is more reliable than trying to use an external processor
    const apiUrl = '/api/fix-stuck-videos';
    
    console.log('Using API URL:', apiUrl);
    
    try {
      // Use the global fetch instead of the imported node-fetch
      // This ensures we're using the correct fetch for the environment
      const processResponse = await global.fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          action: 'fix'
        })
      });
      
      console.log('Process response status:', processResponse.status);
      
      if (!processResponse.ok) {
        console.error('Process video error status:', processResponse.status);
        
        try {
          const processError = await processResponse.json() as { error?: string };
          console.error('Process video error details:', processError);
          
          // If processing fails, update the video status to error
          await supabase
            .from('videos')
            .update({
              status: 'error',
              error_message: processError.error || 'Failed to start processing',
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId);
            
          return NextResponse.json(
            { error: `Failed to process video: ${processError.error || 'Unknown error'}` }, 
            { status: 500 }
          )
        } catch (parseError) {
          console.error('Error parsing process response:', parseError);
          
          // If we can't parse the response, update with generic error
          await supabase
            .from('videos')
            .update({
              status: 'error',
              error_message: `Failed to start processing (Status ${processResponse.status})`,
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId);
            
          return NextResponse.json(
            { error: `Failed to process video: Status ${processResponse.status}` }, 
            { status: 500 }
          )
        }
      }
      
      // Try to parse the successful response
      try {
        const processResult = await processResponse.json();
        console.log('Process result:', processResult);
      } catch (parseError) {
        console.error('Error parsing successful response (non-critical):', parseError);
      }
      
      console.log('Video processing started successfully');
      
      // Update the video status to processing
      await supabase
        .from('videos')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      return NextResponse.json({
        message: 'Video import started',
        videoId,
        displayName,
        status: 'processing'
      });
    } catch (fetchError) {
      console.error('Fetch error during processing:', fetchError);
      
      // Update the video status to error
      await supabase
        .from('videos')
        .update({
          status: 'error',
          error_message: 'Network error while processing video',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      return NextResponse.json(
        { error: 'Network error while processing video' }, 
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
} 