import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Initialize Supabase client with service role key for admin access
// Note: This should be kept secure and only used in trusted server environments
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' // Use service role key for admin privileges
);

/**
 * Downloads a file from a URL to a local path
 */
async function downloadFile(url: string, outputPath: string): Promise<void> {
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

/**
 * Executes an FFmpeg command
 */
function executeFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);
    
    let stdoutData = '';
    let stderrData = '';
    
    ffmpeg.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    ffmpeg.stderr.on('data', (data) => {
      stderrData += data.toString();
      // FFmpeg outputs progress information to stderr
      console.log(`FFmpeg: ${data.toString()}`);
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}: ${stderrData}`));
      }
    });
    
    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Processes a video to extract frames
 */
export async function processVideo(videoId: string): Promise<{
  success: boolean;
  framesGenerated?: number;
  error?: string;
}> {
  console.log(`Starting video processing for video ID: ${videoId}`);
  
  // Create temporary directory
  const tmpDir = path.join(os.tmpdir(), videoId);
  const videoPath = path.join(tmpDir, 'video.mp4');
  const framesDir = path.join(tmpDir, 'frames');
  
  try {
    // Create directories
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
    }
    
    // Get video details from database
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (videoError || !video) {
      throw new Error(`Video not found: ${videoError?.message || 'Unknown error'}`);
    }
    
    console.log(`Processing video: ${video.display_name}`);
    
    // Update status to processing
    await supabase
      .from('videos')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);
    
    // Download video from source URL
    console.log(`Downloading video from: ${video.source_url}`);
    await downloadFile(video.source_url, videoPath);
    console.log('Video download complete');
    
    // Extract frames using FFmpeg (1 frame every 5 seconds)
    console.log('Extracting frames with FFmpeg');
    await executeFFmpeg([
      '-i', videoPath,
      '-vf', 'fps=1/5',
      '-q:v', '2', // High quality JPEG
      path.join(framesDir, 'frame-%03d.jpg')
    ]);
    console.log('Frame extraction complete');
    
    // Get list of extracted frames
    const frameFiles = fs.readdirSync(framesDir)
      .filter(file => file.endsWith('.jpg'))
      .sort();
    
    console.log(`Extracted ${frameFiles.length} frames`);
    
    // Upload frames to Supabase storage and create records
    let successfulFrames = 0;
    
    for (let i = 0; i < frameFiles.length; i++) {
      try {
        const framePath = path.join(framesDir, frameFiles[i]);
        const storagePath = `${video.project_id}/${videoId}/frame_${i}.jpg`;
        
        console.log(`Uploading frame ${i+1}/${frameFiles.length} to storage`);
        
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
    
    console.log(`Successfully processed ${successfulFrames} frames out of ${frameFiles.length}`);
    
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
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      console.log('Cleaned up temporary files');
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError);
    }
    
    return {
      success: true,
      framesGenerated: successfulFrames
    };
  } catch (error: any) {
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