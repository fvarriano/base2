# Video Processing Implementation Guide

This guide explains how to implement real video frame extraction to replace the current placeholder images in the application.

## Current Implementation

Currently, the application uses placeholder images from an external service (picsum.photos) instead of real video frames. The process works as follows:

1. When a video URL is imported, a record is created in the database
2. The `process-video` API endpoint is called with the video ID
3. The endpoint generates placeholder images and uploads them to Supabase storage
4. Frame records are created in the database pointing to these images

## Implementing Real Video Processing

To extract actual frames from videos, you'll need to set up a video processing service. Here are the steps:

### 1. Choose a Video Processing Service

You have several options:

- **Vercel Edge Functions**: Limited to 10-second execution time, which may not be enough for longer videos
- **Cloudflare Workers**: Similar limitations but with isolates that can run longer
- **Dedicated Server**: A server with FFmpeg installed (e.g., AWS EC2, DigitalOcean)
- **Third-party Service**: Video processing services like Mux, Cloudinary, etc.

For a complete solution, a dedicated server or worker service is recommended.

### 2. Implement Video Processing Logic

Here's a sample implementation using FFmpeg:

```javascript
// Example implementation for a Node.js server with FFmpeg installed
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function downloadVideo(url, outputPath) {
  const writer = fs.createWriteStream(outputPath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  
  response.data.pipe(writer);
  
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

function extractFrames(videoPath, outputDir, frameRate = '1/5') {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vf', `fps=${frameRate}`,
      '-q:v', '2', // High quality JPEG
      path.join(outputDir, 'frame-%03d.jpg')
    ]);
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`FFmpeg: ${data.toString()}`);
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });
    
    ffmpeg.on('error', reject);
  });
}

async function processVideo(videoId) {
  console.log(`Processing video: ${videoId}`);
  
  // Create temporary directories
  const tmpDir = path.join('/tmp', videoId);
  const videoPath = path.join(tmpDir, 'video.mp4');
  const framesDir = path.join(tmpDir, 'frames');
  
  try {
    // Create directories
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(framesDir, { recursive: true });
    
    // Get video details from database
    const { data: video, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();
      
    if (error || !video) {
      throw new Error(`Video not found: ${error?.message || 'Unknown error'}`);
    }
    
    // Update status to processing
    await supabase
      .from('videos')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);
    
    // Download video
    console.log(`Downloading video from: ${video.source_url}`);
    await downloadVideo(video.source_url, videoPath);
    
    // Extract frames
    console.log('Extracting frames with FFmpeg');
    await extractFrames(videoPath, framesDir);
    
    // Get list of extracted frames
    const frameFiles = fs.readdirSync(framesDir)
      .filter(file => file.endsWith('.jpg'))
      .sort();
      
    console.log(`Extracted ${frameFiles.length} frames`);
    
    // Upload frames to Supabase storage
    let successfulFrames = 0;
    
    for (let i = 0; i < frameFiles.length; i++) {
      try {
        const framePath = path.join(framesDir, frameFiles[i]);
        const storagePath = `${video.project_id}/${videoId}/frame_${i}.jpg`;
        
        // Read frame file
        const frameBuffer = fs.readFileSync(framePath);
        
        // Upload to Supabase storage
        const { error: uploadError } = await supabase
          .storage
          .from('frames')
          .upload(storagePath, frameBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });
          
        if (uploadError) {
          console.error(`Error uploading frame ${i}:`, uploadError);
          continue;
        }
        
        // Make the file publicly accessible
        const { error: publicError } = await supabase
          .storage
          .from('frames')
          .update(storagePath, frameBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
            cacheControl: '3600'
          });
          
        if (publicError) {
          console.error(`Error making frame ${i} public:`, publicError);
        }
        
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
        console.log(`Successfully processed frame ${i+1}/${frameFiles.length}`);
      } catch (error) {
        console.error(`Error processing frame ${i}:`, error);
      }
    }
    
    // Update video status
    const now = new Date().toISOString();
    await supabase
      .from('videos')
      .update({
        status: successfulFrames > 0 ? 'completed' : 'error',
        updated_at: now,
        processing_completed_at: now,
        error_message: successfulFrames > 0 ? null : 'Failed to generate any frames'
      })
      .eq('id', videoId);
      
    // Clean up temporary files
    fs.rmSync(tmpDir, { recursive: true, force: true });
    
    return {
      success: true,
      framesGenerated: successfulFrames
    };
  } catch (error) {
    console.error('Error processing video:', error);
    
    // Update video status to error
    await supabase
      .from('videos')
      .update({
        status: 'error',
        updated_at: new Date().toISOString(),
        error_message: error.message || 'Unknown error during processing'
      })
      .eq('id', videoId);
      
    // Clean up temporary files
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError);
    }
    
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

// Example Express endpoint
app.post('/api/process-video', async (req, res) => {
  try {
    const { videoId } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }
    
    const result = await processVideo(videoId);
    
    if (result.success) {
      return res.json({
        success: true,
        message: 'Video processed successfully',
        framesGenerated: result.framesGenerated
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error processing video:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
});
```

### 3. Deploy the Video Processing Service

#### Option 1: Serverless Function (with limitations)

For Vercel Edge Functions or Cloudflare Workers, you'll need to:

1. Create a new project for your worker
2. Install FFmpeg.wasm or use a third-party API for video processing
3. Deploy the worker and configure environment variables

#### Option 2: Dedicated Server

1. Set up a server with Node.js and FFmpeg installed
2. Deploy your processing code to the server
3. Expose an API endpoint for your application to call
4. Secure the endpoint with authentication

### 4. Update the Application

1. Modify the `process-video` API endpoint to call your video processing service
2. Update environment variables to include the URL of your processing service
3. Add authentication for secure communication between services

```javascript
// Example update to process-video/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { videoId } = body;
    
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }
    
    // Call the external video processing service
    const response = await axios.post(process.env.VIDEO_PROCESSOR_URL, {
      videoId,
      apiKey: process.env.VIDEO_PROCESSOR_API_KEY
    });
    
    return NextResponse.json({
      success: true,
      message: 'Video processing started',
      jobId: response.data.jobId
    });
  } catch (error: any) {
    console.error('Error processing video:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error' 
    }, { status: 500 });
  }
}
```

### 5. Considerations

- **Processing Time**: Video processing can take a long time, especially for longer videos
- **Storage Costs**: Real video frames will increase your Supabase storage usage
- **API Limits**: Be aware of rate limits on Loom's API for downloading videos
- **Error Handling**: Implement robust error handling and retry mechanisms

## Testing

1. Start with small videos to test your processing pipeline
2. Monitor logs for errors during processing
3. Check that frames are correctly uploaded to storage
4. Verify that frame records are created in the database

## Resources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) 