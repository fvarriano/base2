interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    try {
      const { videoId, storagePath } = await request.json()
      
      // For now, just return success to test integration
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Video processing started'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false,
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
} 