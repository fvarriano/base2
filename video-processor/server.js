const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Google Cloud Storage
const storage = new Storage();
const bucket = storage.bucket(process.env.BUCKET_NAME || 'appaudits-frames');

// API key for securing the endpoint
const API_KEY = process.env.VIDEO_PROCESSOR_API_KEY || 'test-api-key';

// Initialize Supabase client
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ezclbieisztdxwzltjnl.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize Loom API client
const LOOM_API_KEY = process.env.LOOM_API_KEY;

console.log(`Initializing Supabase client with URL: ${SUPABASE_URL}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY length: ${SUPABASE_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY.length : 'undefined'}`);
if (SUPABASE_SERVICE_ROLE_KEY) {
  console.log(`SUPABASE_SERVICE_ROLE_KEY first 10 chars: ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 10)}`);
  
  // Parse and log JWT token parts
  try {
    const parts = SUPABASE_SERVICE_ROLE_KEY.split('.');
    if (parts.length === 3) {
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      console.log('JWT Header:', JSON.stringify(header));
      console.log('JWT Payload:', JSON.stringify(payload));
      
      // Check if token is expired
      if (payload.exp) {
        const expiryDate = new Date(payload.exp * 1000);
        const now = new Date();
        console.log(`Token expires on: ${expiryDate.toISOString()}`);
        console.log(`Current time: ${now.toISOString()}`);
        console.log(`Token is ${expiryDate > now ? 'valid' : 'EXPIRED'}`);
      }
    }
  } catch (error) {
    console.error('Error parsing JWT token:', error);
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  }
});

// Middleware to validate API key
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  console.log('API Key Validation:');
  console.log(`Received API key type: ${typeof apiKey}`);
  console.log(`Expected API key type: ${typeof API_KEY}`);
  console.log(`Received API key length: ${apiKey ? apiKey.length : 'undefined'}`);
  console.log(`Expected API key length: ${API_KEY ? API_KEY.length : 'undefined'}`);
  console.log(`Received API key: "${apiKey}"`);
  console.log(`Expected API key: "${API_KEY}"`);
  console.log(`API keys match: ${apiKey === API_KEY}`);
  
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// Process video endpoint
app.post('/process', validateApiKey, async (req, res) => {
  const { videoUrl, videoId, projectId } = req.body;
  
  if (!videoUrl || !videoId || !projectId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  console.log(`Processing video: ${videoId} from ${videoUrl}`);
  console.log('Project ID:', projectId);
  
  // Create temp directory
  const tempDir = `/tmp/${videoId}`;
  const videoPath = `${tempDir}/video.mp4`;
  const framesDir = `${tempDir}/frames`;
  
  try {
    // Create directories
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
    }
    
    // Update video status to processing with start time
    console.log(`Updating video ${videoId} status to 'processing'`);
    const { error: updateError } = await supabase
      .from('videos')
      .update({ 
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', videoId);
      
    if (updateError) {
      console.error('Error updating video status to processing:', updateError);
      throw updateError;
    }
    
    console.log('Successfully updated video status to processing');
    console.log(`Downloading video from ${videoUrl}`);
    
    try {
      await downloadVideo(videoUrl, videoPath);
      console.log('Video downloaded successfully');
    } catch (downloadError) {
      console.error('Error downloading video:', downloadError);
      throw new Error(`Failed to download video: ${downloadError.message}`);
    }
    
    console.log('Video downloaded, extracting frames');
    let frameCount;
    try {
      frameCount = await extractFrames(videoPath, framesDir);
      console.log(`Successfully extracted ${frameCount} frames`);
    } catch (extractError) {
      console.error('Error extracting frames:', extractError);
      throw new Error(`Failed to extract frames: ${extractError.message}`);
    }
    
    // Get list of frame files
    console.log('Reading frame files from directory');
    const frameFiles = fs.readdirSync(framesDir)
      .filter(file => file.endsWith('.jpg'))
      .map(file => path.join(framesDir, file))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/\d+/)[0]);
        const bNum = parseInt(b.match(/\d+/)[0]);
        return aNum - bNum;
      });
    
    console.log(`Found ${frameFiles.length} frame files`);
    
    try {
      const results = await uploadFrames(frameFiles, videoId, projectId);
      console.log(`Successfully uploaded ${results.length} frames`);
      
      // Update video status to completed with completion time
      const { error: completeError } = await supabase
        .from('videos')
        .update({ 
          status: 'completed',
          processing_completed_at: new Date().toISOString(),
          frame_count: results.length
        })
        .eq('id', videoId);
        
      if (completeError) {
        console.error('Error updating video status to completed:', completeError);
        throw completeError;
      }
      
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      res.json({
        success: true,
        videoId,
        frameCount: results.length,
        frames: results
      });
    } catch (uploadError) {
      console.error('Error uploading frames:', uploadError);
      throw new Error(`Failed to upload frames: ${uploadError.message}`);
    }
  } catch (error) {
    console.error('Processing error:', error);
    
    // Update video status to error with detailed message and completion time
    console.log(`Updating video ${videoId} status to 'error'`);
    const { error: errorUpdate } = await supabase
      .from('videos')
      .update({ 
        status: 'error',
        error_message: error.message,
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', videoId);
      
    if (errorUpdate) {
      console.error('Error updating video status to error:', errorUpdate);
    }
    
    // Clean up if directory exists
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
});

// Function to get video URL from Loom API
async function getLoomVideoUrl(loomUrl) {
  try {
    // First get the video ID from the URL
    const videoId = loomUrl.split('/').pop().split('?')[0];
    console.log('Extracted video ID:', videoId);

    // First try to get the video data using the v1 API with proper authentication
    const videoResponse = await axios.get(`https://www.loom.com/v1/videos/${videoId}`, {
      headers: {
        'Authorization': `Bearer ${LOOM_API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'AppAudits-VideoProcessor/1.0'
      }
    });

    console.log('Loom API response:', JSON.stringify(videoResponse.data, null, 2));

    if (!videoResponse.data) {
      throw new Error('No data received from Loom API');
    }

    // Try different possible URL fields
    const videoUrl = videoResponse.data.url || // Try direct URL first
                    (videoResponse.data.asset_urls && (
                      videoResponse.data.asset_urls.mp4_url ||
                      videoResponse.data.asset_urls.hls_url ||
                      videoResponse.data.asset_urls.dash_url
                    ));

    if (!videoUrl) {
      // If no direct URL is found, try getting it from the embed URL
      const embedResponse = await axios.get(`https://www.loom.com/v1/oembed?url=${encodeURIComponent(loomUrl)}`, {
        headers: {
          'Authorization': `Bearer ${LOOM_API_KEY}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'AppAudits-VideoProcessor/1.0'
        }
      });

      console.log('Loom oEmbed response:', JSON.stringify(embedResponse.data, null, 2));

      if (!embedResponse.data || !embedResponse.data.html) {
        throw new Error('Could not get video data from oEmbed API');
      }

      // Extract the video URL from the iframe src
      const iframeSrcMatch = embedResponse.data.html.match(/src="([^"]+)"/);
      if (!iframeSrcMatch || !iframeSrcMatch[1]) {
        throw new Error('Could not extract video URL from embed HTML');
      }

      // Try to get the direct video URL from the embed URL
      const embedUrl = iframeSrcMatch[1];
      const embedVideoId = embedUrl.split('/').pop().split('?')[0];
      
      // Make another request to get the video data
      const embedVideoResponse = await axios.get(`https://www.loom.com/v1/videos/${embedVideoId}`, {
        headers: {
          'Authorization': `Bearer ${LOOM_API_KEY}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'AppAudits-VideoProcessor/1.0'
        }
      });

      console.log('Loom embed video response:', JSON.stringify(embedVideoResponse.data, null, 2));

      const embedVideoUrl = embedVideoResponse.data.url || // Try direct URL first
                          (embedVideoResponse.data.asset_urls && (
                            embedVideoResponse.data.asset_urls.mp4_url ||
                            embedVideoResponse.data.asset_urls.hls_url ||
                            embedVideoResponse.data.asset_urls.dash_url
                          ));

      if (!embedVideoUrl) {
        throw new Error('Could not find video URL in any API response');
      }

      return embedVideoUrl;
    }

    return videoUrl;
  } catch (error) {
    console.error('Error getting Loom video URL:', error);
    if (error.response) {
      console.error('Loom API error details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    throw new Error(`Loom API error: ${error.response?.status || error.message}`);
  }
}

// Download video function
async function downloadVideo(url, outputPath) {
  try {
    // If it's a Loom URL, get the actual download URL
    if (url.includes('loom.com/share/') || url.includes('loom.com/v/')) {
      console.log('Detected Loom URL, getting download URL from API');
      if (!LOOM_API_KEY) {
        throw new Error('LOOM_API_KEY environment variable is not set');
      }
      url = await getLoomVideoUrl(url);
      console.log('Got Loom download URL:', url);
    }
    
    // If it's a Google Cloud Storage URL, use the Storage client
    if (url.includes('storage.googleapis.com')) {
      console.log('Detected Google Cloud Storage URL');
      const bucketName = url.split('storage.googleapis.com/')[1].split('/')[0];
      const filePath = url.split(`${bucketName}/`)[1];
      
      console.log(`Downloading from bucket: ${bucketName}, file: ${filePath}`);
      
      const storageBucket = storage.bucket(bucketName);
      const file = storageBucket.file(filePath);
      
      // Download the file
      await file.download({
        destination: outputPath
      });
      
      return;
    }
    
    // For other URLs, use axios
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
  } catch (error) {
    throw new Error(`Failed to download video: ${error.message}`);
  }
}

// Extract frames function
function extractFrames(videoPath, outputDir) {
  return new Promise((resolve, reject) => {
    console.log('Starting frame extraction...');
    console.log('Video path:', videoPath);
    console.log('Output directory:', outputDir);

    // Get video duration first
    const ffprobeProcess = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ]);

    let duration = '';
    ffprobeProcess.stdout.on('data', (data) => {
      duration += data.toString();
    });

    ffprobeProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error('Failed to get video duration'));
      }

      const videoDuration = parseFloat(duration);
      console.log(`Video duration: ${videoDuration} seconds`);

      // Calculate frame extraction rate based on video length
      // For longer videos, we extract fewer frames to prevent timeouts
      let fps = 0.5; // Default: 1 frame every 2 seconds
      if (videoDuration > 600) { // If longer than 10 minutes
        fps = 0.2; // 1 frame every 5 seconds
      } else if (videoDuration > 300) { // If longer than 5 minutes
        fps = 0.33; // 1 frame every 3 seconds
      }

      console.log(`Using frame rate: ${fps} fps`);

      // Extract frames with progress monitoring
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vf', `fps=${fps}`,
        '-frame_pts', '1',
        '-progress', 'pipe:1', // Output progress information
        '-q:v', '2',
        `${outputDir}/frame_%03d.jpg`
      ]);
    
      let error = '';
      let progress = '';
      let lastProgressUpdate = Date.now();
      
      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('FFmpeg output:', output);
        error += output;
      });

      ffmpeg.stdout.on('data', (data) => {
        progress += data.toString();
        
        // Log progress every 5 seconds
        const now = Date.now();
        if (now - lastProgressUpdate >= 5000) {
          console.log('FFmpeg progress:', progress);
          lastProgressUpdate = now;
        }
      });
    
      ffmpeg.on('error', (err) => {
        console.error('FFmpeg process error:', err);
        reject(err);
      });

      // Set a timeout based on video duration
      const timeoutMinutes = Math.max(5, Math.ceil(videoDuration / 60) * 2); // At least 5 minutes, or 2x video duration
      const timeout = setTimeout(() => {
        console.error('Frame extraction timed out');
        ffmpeg.kill('SIGKILL');
        reject(new Error(`Frame extraction timed out after ${timeoutMinutes} minutes`));
      }, timeoutMinutes * 60 * 1000);
    
      ffmpeg.on('close', (code) => {
        clearTimeout(timeout);
        console.log(`FFmpeg process exited with code ${code}`);
        
        if (code !== 0) {
          console.error('FFmpeg error output:', error);
          return reject(new Error(`FFmpeg process exited with code ${code}: ${error}`));
        }
        
        try {
          // Get list of generated frames
          const frames = fs.readdirSync(outputDir)
            .filter(file => file.endsWith('.jpg'))
            .sort((a, b) => {
              const aNum = parseInt(a.match(/\d+/)[0]);
              const bNum = parseInt(b.match(/\d+/)[0]);
              return aNum - bNum;
            });
          
          console.log(`Successfully extracted ${frames.length} frames`);
          resolve(frames.length);
        } catch (err) {
          console.error('Error reading output directory:', err);
          reject(err);
        }
      });
    });
  });
}

// Upload frames function
async function uploadFrames(frames, videoId, projectId) {
  const results = [];
  
  for (let i = 0; i < frames.length; i++) {
    const framePath = frames[i];
    const frameNumber = i + 1;
    const paddedNumber = String(frameNumber).padStart(3, '0');
    const storagePath = `${projectId}/${videoId}/frame_${paddedNumber}.jpg`;
    
    console.log(`Uploading frame ${frameNumber}/${frames.length}: ${storagePath}`);
    
    try {
      // Upload to Google Cloud Storage with retries
      let retries = 3;
      let uploadSuccess = false;
      
      while (retries > 0 && !uploadSuccess) {
        try {
          // First, upload the file
          await bucket.upload(framePath, {
            destination: storagePath,
            metadata: {
              contentType: 'image/jpeg',
              cacheControl: 'public, max-age=31536000', // Cache for 1 year
            },
            predefinedAcl: 'publicRead'
          });
          
          // Get file reference
          const file = bucket.file(storagePath);
          
          // Update the file's metadata with CORS headers
          await file.setMetadata({
            contentType: 'image/jpeg',
            cacheControl: 'public, max-age=31536000',
            metadata: {
              'Access-Control-Allow-Origin': '*',
              'Cross-Origin-Resource-Policy': 'cross-origin'
            }
          });
          
          // Make the file public and verify its accessibility
          await file.makePublic();
          
          // Get the public URL
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
          
          // Verify accessibility with proper headers
          const response = await axios.head(publicUrl, {
            headers: {
              'Origin': 'https://appaudits.vercel.app',
              'Access-Control-Request-Method': 'GET'
            }
          });
          
          if (response.status === 200) {
            console.log(`Frame ${frameNumber} uploaded and verified accessible at ${publicUrl}`);
            console.log('Response headers:', response.headers);
            uploadSuccess = true;
            
            // Create frame record in Supabase
            const { data: frameData, error: insertError } = await supabase
              .from('frames')
              .insert({
                video_id: videoId,
                frame_number: frameNumber,
                storage_path: storagePath
              })
              .select()
              .single();
            
            if (insertError) throw insertError;
            
            results.push({
              frameNumber,
              storagePath,
              publicUrl,
              frameId: frameData.id
            });
          } else {
            throw new Error(`Frame verification failed with status ${response.status}`);
          }
        } catch (error) {
          console.error(`Error uploading frame ${frameNumber} (attempt ${4-retries}/3):`, error);
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }
    } catch (error) {
      console.error(`Failed to upload frame ${frameNumber} after all retries:`, error);
      throw error;
    }
  }
  
  return results;
}

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test Supabase connection endpoint (no auth required)
app.get('/test-supabase', async (req, res) => {
  console.log('Testing Supabase connection...');
  console.log('Headers:', req.headers);
  
  try {
    // Try a simple query to test the connection
    const { data, error } = await supabase
      .from('videos')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('Supabase connection error:', error);
      return res.status(500).json({ error: 'Supabase connection error', details: error });
    }
    
    console.log('Supabase connection successful:', data);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Unexpected error testing Supabase connection:', error);
    return res.status(500).json({ error: 'Unexpected error', details: error.message });
  }
});

// Test endpoint to verify Supabase connection
app.post('/test-supabase', validateApiKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('id')
      .limit(1);
      
    if (error) {
      console.error('Supabase test error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ success: true, message: 'Supabase connection successful', data });
  } catch (error) {
    console.error('Supabase test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});