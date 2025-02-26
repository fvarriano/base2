import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// This is a simplified version for demonstration
// In production, you would use a queue system like AWS SQS or a background worker
export async function POST(request: Request) {
  try {
    const { videoId, projectId } = await request.json()
    
    if (!videoId || !projectId) {
      return NextResponse.json(
        { error: 'Video ID and Project ID are required' }, 
        { status: 400 }
      )
    }
    
    // Get video details from database
    const { data: videoData, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()
    
    if (videoError) {
      return NextResponse.json(
        { error: `Failed to get video: ${videoError.message}` }, 
        { status: 500 }
      )
    }
    
    // Update status to processing
    await supabase
      .from('videos')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)
    
    // In a real implementation, we would send this to a background worker
    // For now, we'll just return success and let the client poll for status
    
    // Return immediately to client
    return NextResponse.json({ 
      message: 'Video processing started',
      videoId
    })
    
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
} 