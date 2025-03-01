# Implementing Real Video Processing

This guide explains how to replace the placeholder frames with actual frames extracted from videos.

## Current Implementation

Currently, the application uses placeholder SVG images instead of real video frames. When a video is "processed", the app:

1. Creates 3-5 SVG placeholder images with frame numbers and the video title
2. Uploads these SVG images to Supabase storage
3. Creates frame records in the database pointing to these SVG images

## Implementing Real Video Processing

To extract actual frames from videos, you need to:

### 1. Set Up a Video Processing Service

You have several options:

- **Vercel Edge Functions or Serverless Functions**: For processing small videos
- **Cloudflare Workers**: For more intensive processing
- **Dedicated Server**: For heavy video processing with FFmpeg
- **Third-party Service**: Like AWS Elemental MediaConvert or similar

### 2. Implement the Video Processing Logic

Here's a basic implementation using FFmpeg:

```javascript
// Example implementation in a serverless function
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import fs from 'fs';
import fetch from 'node-fetch';
import { promisify } from 'util';

const execAsync = promisify(exec);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for admin privileges
);

async function downloadFile(url, path) {
  const response = await fetch(url);
  const buffer = await response.buffer();
  fs.writeFileSync(path, buffer);
}

export async function processVideo(videoId) {
  try {
    // Get video details from database
    const { data: video, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();
      
    if (error || !video) throw new Error('Video not found');
    
    // Download video from source (e.g., Loom)
    const videoUrl = video.source_url;
    const videoPath = `/tmp/${videoId}.mp4`;
    await downloadFile(videoUrl, videoPath);
    
    // Create directory for frames
    const framesDir = `/tmp/${videoId}/`;
    await execAsync(`mkdir -p ${framesDir}`);
    
    // Extract frames using FFmpeg (every 5 seconds)
    await execAsync(`ffmpeg -i ${videoPath} -vf fps=1/5 ${framesDir}frame-%03d.jpg`);
    
    // Get list of generated frames
    const { stdout } = await execAsync(`ls ${framesDir}`);
    const frameFiles = stdout.trim().split('\n');
    
    // Upload frames to Supabase storage and create records
    let successfulFrames = 0;
    
    for (let i = 0; i < frameFiles.length; i++) {
      const framePath = `${framesDir}${frameFiles[i]}`;
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
    }
    
    // Update video status
    await supabase
      .from('videos')
      .update({
        status: successfulFrames > 0 ? 'completed' : 'error',
        updated_at: new Date().toISOString(),
        processing_completed_at: new Date().toISOString(),
        error_message: successfulFrames > 0 ? null : 'Failed to generate frames'
      })
      .eq('id', videoId);
      
    // Clean up temporary files
    await execAsync(`rm -rf ${videoPath} ${framesDir}`);
    
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
      
    return {
      success: false,
      error: error.message
    };
  }
}
```

### 3. Deploy the Video Processing Service

1. For Vercel Serverless Functions:
   - Create a new API endpoint in your Next.js app
   - Implement the video processing logic
   - Note: There are time and memory limitations

2. For a dedicated server:
   - Set up a server with FFmpeg installed
   - Create an API endpoint that your app can call
   - Implement authentication to secure the endpoint

### 4. Update the Application to Use the Real Processing Service

1. Modify `src/app/api/import-video-from-url/route.ts` to call your video processing service
2. Update `src/app/api/fix-stuck-videos/route.ts` to use real frame extraction

### 5. Considerations

- **Processing Time**: Real video processing takes time, especially for longer videos
- **Storage Costs**: Storing video frames will increase your Supabase storage usage
- **API Limits**: Be aware of Loom API limits when downloading videos
- **Error Handling**: Implement robust error handling for the video processing pipeline

## Testing

1. Start with small, short videos to test the processing pipeline
2. Monitor the logs for any errors during processing
3. Check the quality and frequency of the extracted frames
4. Test with different video sources and formats

## Resources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Vercel Serverless Functions](https://vercel.com/docs/concepts/functions/serverless-functions)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) 