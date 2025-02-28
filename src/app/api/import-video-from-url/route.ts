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
    
    // Validate URL
    let url: URL;
    try {
      url = new URL(videoUrl);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid URL format' }, 
        { status: 400 }
      )
    }
    
    // Currently only supporting Loom
    if (!url.hostname.includes('loom.com') || !url.pathname.includes('/share/')) {
      return NextResponse.json(
        { error: 'Currently only Loom URLs are supported' }, 
        { status: 400 }
      )
    }
    
    // Extract the Loom video ID from the URL
    const loomVideoId = url.pathname.split('/').pop();
    
    if (!loomVideoId) {
      return NextResponse.json(
        { error: 'Could not extract video ID from URL' }, 
        { status: 400 }
      )
    }
    
    // Get the video metadata from Loom's oembed endpoint
    const oembedUrl = `https://www.loom.com/v1/oembed?url=${encodeURIComponent(videoUrl)}`;
    const oembedResponse = await fetch(oembedUrl);
    
    if (!oembedResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch video metadata from Loom' }, 
        { status: 500 }
      )
    }
    
    const oembedData = await oembedResponse.json() as any;
    
    // Extract the direct video URL from the HTML (this is a bit hacky but works for now)
    // In a production app, you might want to use the Loom API with proper authentication
    const html = oembedData.html;
    const srcMatch = html.match(/src="([^"]+)"/);
    
    if (!srcMatch || !srcMatch[1]) {
      return NextResponse.json(
        { error: 'Could not extract video source from Loom embed' }, 
        { status: 500 }
      )
    }
    
    // Get the iframe URL
    const iframeUrl = srcMatch[1];
    
    // Fetch the iframe content to find the actual video URL
    const iframeResponse = await fetch(iframeUrl);
    const iframeContent = await iframeResponse.text();
    
    // Look for the video source in the iframe content
    // This is a simplified approach and might break if Loom changes their embed structure
    const videoSrcMatch = iframeContent.match(/"playbackUrl":"([^"]+)"/);
    
    if (!videoSrcMatch || !videoSrcMatch[1]) {
      return NextResponse.json(
        { error: 'Could not extract video source from Loom iframe' }, 
        { status: 500 }
      )
    }
    
    // Get the actual video URL (need to unescape it)
    const videoSrc = videoSrcMatch[1].replace(/\\u002F/g, '/');
    
    // Generate a unique ID for the video
    const videoId = uuidv4();
    
    // Create a display name from the Loom title
    const displayName = oembedData.title || `Loom Video - ${new Date().toLocaleDateString()}`;
    
    // Create a record in the videos table
    const { error: insertError } = await supabase
      .from('videos')
      .insert({
        id: videoId,
        project_id: projectId,
        display_name: displayName,
        status: 'pending',
        source_url: videoUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (insertError) {
      return NextResponse.json(
        { error: `Failed to create video record: ${insertError.message}` }, 
        { status: 500 }
      )
    }
    
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
        videoUrl: videoSrc, // Pass the direct video URL for processing
      }),
    });
    
    if (!processResponse.ok) {
      // If processing fails, update the video status to error
      await supabase
        .from('videos')
        .update({
          status: 'error',
          error_message: 'Failed to start processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
        
      const processError = await processResponse.json();
      return NextResponse.json(
        { error: `Failed to process video: ${typeof processError === 'object' && processError !== null && 'error' in processError ? (processError as any).error : 'Unknown error'}` }, 
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'Video import started',
      videoId,
      displayName,
      status: 'processing'
    });
    
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
} 