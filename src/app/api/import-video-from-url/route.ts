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
    
    // Clean up the URL - remove any trailing query parameters or hash fragments
    let cleanUrl = videoUrl.trim();
    // Remove any query parameters
    cleanUrl = cleanUrl.split('?')[0];
    // Remove any hash fragments
    cleanUrl = cleanUrl.split('#')[0];
    
    console.log('Processing URL:', cleanUrl);
    
    // Validate URL
    let url: URL;
    try {
      url = new URL(cleanUrl);
    } catch (error) {
      console.error('URL parsing error:', error);
      return NextResponse.json(
        { error: 'Invalid URL format. Please provide a complete URL including https://' }, 
        { status: 400 }
      )
    }
    
    // Currently only supporting Loom
    if (!url.hostname.includes('loom.com')) {
      return NextResponse.json(
        { error: 'Currently only Loom URLs are supported' }, 
        { status: 400 }
      )
    }
    
    // More flexible path checking for Loom
    if (!url.pathname.includes('/share/') && !url.pathname.includes('/v/')) {
      return NextResponse.json(
        { error: 'Invalid Loom URL format. Please use a Loom share URL (e.g., https://www.loom.com/share/...)' }, 
        { status: 400 }
      )
    }
    
    // Extract the Loom video ID from the URL
    const pathParts = url.pathname.split('/');
    const loomVideoId = pathParts[pathParts.length - 1];
    
    if (!loomVideoId || loomVideoId.length < 5) { // Basic validation for ID length
      console.error('Invalid Loom video ID:', loomVideoId, 'from URL:', cleanUrl);
      return NextResponse.json(
        { error: 'Could not extract a valid video ID from URL' }, 
        { status: 400 }
      )
    }
    
    console.log('Extracted Loom video ID:', loomVideoId);
    
    // For demo purposes, we'll skip the oembed API call and just use a placeholder title
    // In a production app, you would want to use the Loom API properly
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
        status: 'pending',
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
    
    // Start processing the video
    // We'll use the same process-video endpoint that handles uploaded videos
    const processResponse = await fetch(`${process.env.NEXT_PUBLIC_VERCEL_URL || ''}/api/process-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId,
        projectId,
        loomVideoId,
      }),
    });
    
    if (!processResponse.ok) {
      console.error('Process video error:', await processResponse.text());
      
      // If processing fails, update the video status to error
      await supabase
        .from('videos')
        .update({
          status: 'error',
          error_message: 'Failed to start processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
        
      return NextResponse.json(
        { error: `Failed to process video: Status ${processResponse.status}` }, 
        { status: 500 }
      )
    }
    
    console.log('Video processing started successfully');
    
    return NextResponse.json({
      message: 'Video import started',
      videoId,
      displayName,
      status: 'processing'
    });
    
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
} 