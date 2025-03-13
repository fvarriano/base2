# AppAudits

## Project Overview
A personal web application that allows you to add annotations to images of apps, organize them into projects, and export them as PDFs. The app will support processing videos (either uploaded directly or via Loom links) to extract frames for annotation.

## Core Features
1. Dashboard for project management
2. Project creation and organization
3. Video processing to extract frames
3. Image annotation capabilities w/ severity scoring system
6. PDF export functionality


## Technology Stack

### Frontend
- **Framework**: React with Next.js (for server-side rendering and API routes)
- **UI Library**: Tailwind CSS for styling
- **State Management**: React Context API 
- **Annotation Tool**: react-image-annotation or fabric.js
- **PDF Generation**: react-pdf or jsPDF

### Backend
- **Server**: Next.js API routes (simplifies deployment)
- **Database**: PostgreSQL (for structured data) with Prisma ORM
- **File Storage**: Google Cloud Storage for images and videos
- **Video Processing**: FFmpeg (for video frame extraction)
- **Deployment**: Vercel

### Infrastructure
- **Domain**: Custom domain with DNS configuration
- **Storage**: Google Cloud Storage with lifecycle management
- **Database Hosting**: Managed PostgreSQL service - Supabase

## Development Roadmap

### Phase 1: Project Setup and Basic Structure
1. Initialize Next.js project with TypeScript
2. Set up Tailwind CSS
3. Create basic layout components (header, sidebar, main content area)
4. Set up database schema and connections
5. Implement basic routing

### Phase 2: Dashboard and Project Management
1. Create dashboard UI
2. Implement project creation functionality
3. Build project listing and navigation
4. Add project metadata management (name, description, etc.)
5. Implement project groups/categories

### Phase 3: Image Annotation Core
1. Implement image upload functionality
2. Create basic annotation interface
3. Add annotation tools (rectangles, arrows, text)
4. Implement severity scoring dropdown
5. Build image gallery view for each project

### Phase 4: Video Processing
1. Set up video upload functionality
2. Implement FFmpeg integration for frame extraction
3. Create Loom link processing capability
4. Build frame selection interface
5. Optimize video processing for speed

### Phase 5: Advanced Features
1. Implement PDF export functionality
2. Add annotation templates or presets
3. Create project duplication feature
4. Implement bulk operations
5. Add search and filtering capabilities

### Phase 6: Deployment and Optimization
1. Set up production environment
2. Configure custom domain
3. Implement caching strategies
4. Optimize image and video processing
5. Set up monitoring and error tracking

## Technical Implementation Details

### Database Schema
```
Project
  - id
  - name
  - description
  - createdAt
  - updatedAt

Group
  - id
  - projectId
  - name
  - createdAt
  - updatedAt

Image
  - id
  - groupId
  - url
  - sourceType (upload/video)
  - videoId (optional)
  - frameNumber (optional)
  - createdAt
  - updatedAt

Video
  - id
  - projectId
  - url
  - loomUrl (optional)
  - processingStatus
  - createdAt
  - updatedAt

Annotation
  - id
  - imageId
  - data (JSON)
  - severityScore
  - createdAt
  - updatedAt
```

### Video Processing Approach
1. **Upload Handling**:
   - Direct uploads will be processed immediately
   - Loom links will be fetched and downloaded server-side

2. **Frame Extraction**:
   - Use FFmpeg to extract frames at regular intervals
   - For efficiency, extract 1 frame per second initially
   - Allow user to request higher frame rate extraction for specific segments

3. **Optimization Strategies**:
   - Process videos in the background using a queue
   - Store processed frames in Google Cloud Storage
   - Use Google Cloud's image optimization features for thumbnails
   - Use WebP format for better compression
   - Leverage Google Cloud Storage's built-in CDN capabilities for faster delivery

### PDF Export Implementation
1. Generate a cover page with project details
2. For each group, create a section with:
   - Group name and metadata
   - Images with their annotations
   - Severity scores and any notes
3. Include a summary page with statistics
4. Allow customization of the PDF layout

## Potential Challenges and Solutions

### Video Processing Performance
- **Challenge**: Processing large videos can be time-consuming
- **Solution**: Implement a background job system, consider using AWS Lambda or similar serverless functions for processing

### Storage Management
- **Challenge**: Videos and images can consume significant storage
- **Solution**: Implement Google Cloud Storage lifecycle policies to archive to Nearline/Coldline storage or delete old data, use Cloud Storage compression options where appropriate

### Annotation Tool Responsiveness
- **Challenge**: Complex annotations might affect performance
- **Solution**: Optimize rendering, consider using canvas-based solutions instead of DOM elements

## Future Enhancements
1. AI-assisted annotation suggestions
2. Collaboration features (if needed later)
3. Integration with design tools (Figma, Sketch)
4. Mobile app version for on-the-go annotations
5. Analytics dashboard for annotation patterns

# Migration Plan: Current Implementation to Target Architecture

## Current Implementation Overview

The application currently uses:
- **Frontend**: Next.js with React and Tailwind CSS
- **Backend**: Next.js API routes (serverless functions on Vercel)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth
- **Video Processing**: Placeholder images instead of real video processing
- **Deployment**: Vercel with custom headers for CORS policies

## Target Implementation (Google Cloud)

The target implementation uses:
- **Frontend**: React with Next.js (unchanged)
- **UI Library**: Tailwind CSS (unchanged)
- **Backend**: Next.js API routes (unchanged)
- **Database**: PostgreSQL with Prisma ORM (migrating from Supabase)
- **File Storage**: Google Cloud Storage (migrating from Supabase Storage)
- **Video Processing**: FFmpeg (to be implemented)
- **Deployment**: Vercel (unchanged)

## Step-by-Step Migration Plan

### Phase 1: Preparation and Planning (1-2 weeks)

1. **Set Up Google Cloud Project**
   - Create a new Google Cloud project
   - Set up billing
   - Enable required APIs (Cloud Storage, Cloud SQL)
   - Create service accounts and download credentials

2. **Set Up Google Cloud Storage**
   - Create buckets for:
     - Videos (raw uploads)
     - Frames (extracted video frames)
     - Annotations (exported PDFs)
   - Configure CORS settings
   - Set up appropriate IAM permissions

3. **Set Up Cloud SQL (PostgreSQL)**
   - Create a PostgreSQL instance
   - Configure networking (private connection preferred)
   - Set up backups and maintenance windows

4. **Install and Configure Prisma**
   - Add Prisma to the project: `npm install prisma @prisma/client`
   - Initialize Prisma: `npx prisma init`
   - Create Prisma schema based on existing Supabase schema

### Phase 2: Database Migration (1-2 weeks)

1. **Export Data from Supabase**
   - Use Supabase dashboard to export data as SQL
   - Alternatively, write scripts to export data via API

2. **Create Database Schema with Prisma**
   - Convert Supabase schema to Prisma schema
   - Run migrations: `npx prisma migrate dev`

3. **Import Data to Cloud SQL**
   - Transform exported data to match new schema if needed
   - Import data to Cloud SQL

4. **Update Database Connection in Application**
   - Update environment variables
   - Replace Supabase client with Prisma client
   - Update database queries throughout the application

### Phase 3: Storage Migration (1 week)

1. **Set Up Google Cloud Storage Client**
   - Install Google Cloud Storage client: `npm install @google-cloud/storage`
   - Configure client with credentials

2. **Migrate Files from Supabase to Google Cloud Storage**
   - Write a migration script to:
     - Download files from Supabase
     - Upload files to Google Cloud Storage
     - Update database records with new storage paths

3. **Update Storage Operations in Application**
   - Replace Supabase storage operations with Google Cloud Storage operations
   - Update file URLs in the application

### Phase 4: Implement Real Video Processing (2-3 weeks)

1. **Set Up FFmpeg Processing Environment**
   - Choose implementation approach:
     - Option A: Use Google Cloud Functions for processing
     - Option B: Use Google Cloud Run with FFmpeg container
     - Option C: Use Compute Engine VM for processing

2. **Implement Video Processing Logic**
   - Create processing service with FFmpeg
   - Implement frame extraction at regular intervals
   - Set up storage of extracted frames in Google Cloud Storage

3. **Create Processing Queue**
   - Implement a queue system using Google Cloud Pub/Sub
   - Create a worker service to process videos from the queue

4. **Update Video Import API**
   - Modify the import-video-from-url route to use the new processing service
   - Implement progress tracking and status updates

### Phase 5: Authentication Migration (1 week)

1. **Evaluate Authentication Options**
   - Option A: Continue using Supabase Auth
   - Option B: Migrate to Firebase Authentication
   - Option C: Implement custom authentication with Google Identity Platform

2. **Implement Chosen Authentication Solution**
   - Set up authentication service
   - Migrate user accounts if needed
   - Update authentication logic in the application

### Phase 6: Testing and Optimization (1-2 weeks)

1. **Comprehensive Testing**
   - Test all migrated functionality
   - Verify data integrity
   - Test performance under load

2. **Optimize Performance**
   - Implement caching strategies
   - Optimize database queries
   - Configure Google Cloud resources for optimal performance

3. **Implement Monitoring and Logging**
   - Set up Google Cloud Monitoring
   - Configure alerts for critical issues
   - Implement detailed logging

### Phase 7: Deployment and Cutover (1 week)

1. **Update Deployment Configuration**
   - Update Vercel environment variables
   - Configure secrets management

2. **Staged Rollout**
   - Deploy to staging environment
   - Perform final testing
   - Plan cutover strategy

3. **Production Deployment**
   - Deploy to production
   - Monitor for issues
   - Be prepared to rollback if necessary

## Simplified Migration Approach (Recommended)

Based on the current implementation and project needs, we recommend adopting a simplified migration approach that focuses on implementing real video processing while minimizing infrastructure changes. This approach keeps Supabase for database and authentication while leveraging Google Cloud for video processing.

### Benefits of This Approach

- **Faster Implementation**: 2-3 weeks vs. 7-11 weeks for full migration
- **Lower Risk**: Minimizes changes to existing working components
- **Cost Effective**: Estimated $30-60/month vs. $75-150/month for full solution
- **Focused on Core Need**: Addresses the critical video processing functionality
- **Future-Proof**: Can be expanded to full Google Cloud migration later if needed

### Detailed Implementation Plan

#### Phase 1: Set Up Google Cloud Resources (2-3 days)

1. **Create Google Cloud Project**
   ```bash
   # Install Google Cloud CLI if not already installed
   # https://cloud.google.com/sdk/docs/install
   
   # Initialize and create a new project
   gcloud init
   gcloud projects create appaudits-video-processor
   gcloud config set project appaudits-video-processor
   
   # Enable required APIs
   gcloud services enable storage.googleapis.com
   gcloud services enable run.googleapis.com
   ```

2. **Set Up Google Cloud Storage Bucket**
   ```bash
   # Create a bucket for processed frames
   gsutil mb -l us-central1 gs://appaudits-frames
   
   # Set CORS policy for the bucket
   cat > cors.json << EOL
   [
     {
       "origin": ["https://appaudits.vercel.app", "http://localhost:3000"],
       "method": ["GET", "HEAD", "PUT", "POST"],
       "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
       "maxAgeSeconds": 3600
     }
   ]
   EOL
   
   gsutil cors set cors.json gs://appaudits-frames
   
   # Set public read access for the bucket
   gsutil iam ch allUsers:objectViewer gs://appaudits-frames
   ```

3. **Create Service Account for Application**
   ```bash
   # Create service account
   gcloud iam service-accounts create appaudits-app
   
   # Grant storage permissions
   gcloud projects add-iam-policy-binding appaudits-video-processor \
     --member="serviceAccount:appaudits-app@appaudits-video-processor.iam.gserviceaccount.com" \
     --role="roles/storage.objectAdmin"
   
   # Create and download key
   gcloud iam service-accounts keys create ./appaudits-key.json \
     --iam-account=appaudits-app@appaudits-video-processor.iam.gserviceaccount.com
   ```

#### Phase 2: Create Video Processing Service (3-5 days)

1. **Create Cloud Run Service with FFmpeg**

   Create a new directory for the processing service:
   ```bash
   mkdir -p video-processor
   cd video-processor
   ```

   Create a Dockerfile:
   ```dockerfile
   FROM node:18-slim
   
   # Install FFmpeg and dependencies
   RUN apt-get update && apt-get install -y \
       ffmpeg \
       python3-pip \
       && rm -rf /var/lib/apt/lists/*
   
   # Create app directory
   WORKDIR /usr/src/app
   
   # Install app dependencies
   COPY package*.json ./
   RUN npm install
   
   # Bundle app source
   COPY . .
   
   # Expose port
   EXPOSE 8080
   
   # Start the service
   CMD [ "node", "server.js" ]
   ```

   Create package.json:
   ```json
   {
     "name": "video-processor",
     "version": "1.0.0",
     "description": "Video processing service for AppAudits",
     "main": "server.js",
     "scripts": {
       "start": "node server.js"
     },
     "dependencies": {
       "express": "^4.18.2",
       "multer": "^1.4.5-lts.1",
       "@google-cloud/storage": "^6.9.0",
       "@supabase/supabase-js": "^2.10.0",
       "axios": "^1.3.4",
       "cors": "^2.8.5"
     }
   }
   ```

   Create server.js:
   ```javascript
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
   const bucket = storage.bucket('appaudits-frames');
   
   // Initialize Supabase client
   const supabase = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_SERVICE_ROLE_KEY
   );
   
   // Process video endpoint
   app.post('/process', async (req, res) => {
     const { videoUrl, videoId, projectId } = req.body;
     
     if (!videoUrl || !videoId || !projectId) {
       return res.status(400).json({ error: 'Missing required parameters' });
     }
     
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
       
       // Update video status
       await supabase
         .from('videos')
         .update({ status: 'processing' })
         .eq('id', videoId);
       
       // Download video
       await downloadVideo(videoUrl, videoPath);
       
       // Extract frames
       const frameCount = await extractFrames(videoPath, framesDir);
       
       // Upload frames to Google Cloud Storage and create records
       const frames = fs.readdirSync(framesDir)
         .filter(file => file.endsWith('.jpg'))
         .map(file => path.join(framesDir, file));
       
       const results = await uploadFrames(frames, videoId, projectId);
       
       // Update video status
       await supabase
         .from('videos')
         .update({ 
           status: 'completed',
           processing_completed_at: new Date().toISOString()
         })
         .eq('id', videoId);
       
       // Clean up
       fs.rmSync(tempDir, { recursive: true, force: true });
       
       res.json({
         success: true,
         videoId,
         frameCount: results.length,
         frames: results
       });
     } catch (error) {
       console.error('Processing error:', error);
       
       // Update video status
       await supabase
         .from('videos')
         .update({ 
           status: 'error',
           error_message: error.message
         })
         .eq('id', videoId);
       
       // Clean up if directory exists
       if (fs.existsSync(tempDir)) {
         fs.rmSync(tempDir, { recursive: true, force: true });
       }
       
       res.status(500).json({ error: error.message });
     }
   });
   
   // Download video function
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
   
   // Extract frames function
   function extractFrames(videoPath, outputDir, frameCount = 5) {
     return new Promise((resolve, reject) => {
       const ffmpeg = spawn('ffmpeg', [
         '-i', videoPath,
         '-vf', `fps=1/${Math.ceil(30/frameCount)}`,
         '-q:v', '1',
         `${outputDir}/frame_%03d.jpg`
       ]);
       
       let error = '';
       ffmpeg.stderr.on('data', (data) => {
         error += data.toString();
       });
       
       ffmpeg.on('close', (code) => {
         if (code !== 0) {
           return reject(new Error(`FFmpeg process exited with code ${code}: ${error}`));
         }
         
         const frames = fs.readdirSync(outputDir).filter(file => file.endsWith('.jpg'));
         resolve(frames.length);
       });
     });
   }
   
   // Upload frames function
   async function uploadFrames(frames, videoId, projectId) {
     const results = [];
     
     for (let i = 0; i < frames.length; i++) {
       const framePath = frames[i];
       const frameNumber = i + 1;
       const storagePath = `${projectId}/${videoId}/frame_${frameNumber}.jpg`;
       
       // Upload to Google Cloud Storage
       await bucket.upload(framePath, {
         destination: storagePath,
         metadata: {
           contentType: 'image/jpeg',
         },
       });
       
       // Get public URL
       const publicUrl = `https://storage.googleapis.com/appaudits-frames/${storagePath}`;
       
       // Create frame record in Supabase
       const { error: insertError } = await supabase
         .from('frames')
         .insert({
           video_id: videoId,
           frame_number: frameNumber,
           storage_path: storagePath,
           public_url: publicUrl
         });
       
       if (insertError) throw insertError;
       
       results.push({
         frameNumber,
         storagePath,
         publicUrl
       });
     }
     
     return results;
   }
   
   // Health check endpoint
   app.get('/health', (req, res) => {
     res.json({ status: 'ok' });
   });
   
   const PORT = process.env.PORT || 8080;
   app.listen(PORT, () => {
     console.log(`Server running on port ${PORT}`);
   });
   ```

2. **Deploy the Service to Cloud Run**
   ```bash
   # Build and push the container
   gcloud builds submit --tag gcr.io/appaudits-video-processor/video-processor
   
   # Deploy to Cloud Run
   gcloud run deploy video-processor \
     --image gcr.io/appaudits-video-processor/video-processor \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars="SUPABASE_URL=https://your-project.supabase.co,SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
   ```

#### Phase 3: Update Next.js Application (2-3 days)

1. **Add Google Cloud Storage Environment Variables**
   
   Update your `.env.local` file:
   ```
   # Google Cloud Storage
   GOOGLE_CLOUD_PROJECT=appaudits-video-processor
   GOOGLE_CLOUD_BUCKET=appaudits-frames
   NEXT_PUBLIC_FRAMES_BASE_URL=https://storage.googleapis.com/appaudits-frames
   
   # Video Processor URL
   NEXT_PUBLIC_VIDEO_PROCESSOR_URL=https://video-processor-xxxx-uc.a.run.app
   ```

2. **Update the Video Import API**

   Modify `src/app/api/import-video-from-url/route.ts`:
   ```typescript
   import { createClient } from '@supabase/supabase-js'
   import { NextResponse } from 'next/server'
   import { v4 as uuidv4 } from 'uuid'
   import axios from 'axios'

   // Initialize Supabase client
   const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL || '',
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
   )

   // Video processor URL
   const VIDEO_PROCESSOR_URL = process.env.NEXT_PUBLIC_VIDEO_PROCESSOR_URL || '';

   export async function POST(request: Request) {
     try {
       const { videoUrl, projectId } = await request.json()
       
       if (!videoUrl || !projectId) {
         return NextResponse.json(
           { error: 'Video URL and Project ID are required' }, 
           { status: 400 }
         )
       }
       
       // Extract Loom video ID if applicable
       const loomRegex = /loom\.com\/(share|v)\/([a-zA-Z0-9_-]+)/i;
       const match = videoUrl.match(loomRegex);
       let isLoom = false;
       let loomVideoId;
       
       if (match && match[2]) {
         isLoom = true;
         loomVideoId = match[2];
       }
       
       // Generate a unique ID for the video
       const videoId = uuidv4();
       
       // Create a filename for the imported video
       const filename = isLoom ? `loom_${loomVideoId}.mp4` : `video_${videoId}.mp4`;
       
       // Create a storage path for the video
       const storagePath = `${projectId}/${videoId}/${filename}`;
       
       // Create a record in the videos table
       const { error: insertError } = await supabase
         .from('videos')
         .insert({
           id: videoId,
           project_id: projectId,
           display_name: isLoom ? `Loom Video - ${new Date().toLocaleDateString()}` : `Video - ${new Date().toLocaleDateString()}`,
           filename: filename,
           storage_path: storagePath,
           source_url: videoUrl,
           status: 'pending',
           processing_started_at: new Date().toISOString(),
           created_at: new Date().toISOString(),
           updated_at: new Date().toISOString()
         });
       
       if (insertError) {
         return NextResponse.json(
           { error: `Failed to create video record: ${insertError.message}` }, 
           { status: 500 }
         )
       }
       
       // Send to processing service
       try {
         await axios.post(`${VIDEO_PROCESSOR_URL}/process`, {
           videoUrl,
           videoId,
           projectId
         });
         
         return NextResponse.json({
           message: 'Video import started successfully!',
           videoId,
           status: 'processing'
         });
       } catch (error: any) {
         console.error('Processing service error:', error);
         
         // Update video status to error
         await supabase
           .from('videos')
           .update({
             status: 'error',
             error_message: error.message || 'Error connecting to processing service',
             updated_at: new Date().toISOString()
           })
           .eq('id', videoId);
         
         return NextResponse.json({
           message: 'Video record created but processing failed',
           videoId,
           status: 'error',
           error: error.message || 'Unknown error during processing'
         }, { status: 500 });
       }
     } catch (error: any) {
       console.error('API error:', error);
       return NextResponse.json(
         { error: error.message || 'Unknown error' }, 
         { status: 500 }
       )
     }
   }
   ```

3. **Update the VideoFrames Component**

   Ensure the component uses the `public_url` field from the frames table:
   ```typescript
   // In src/components/VideoFrames.tsx
   // Make sure the component uses the public_url field:
   
   const frameUrl = frame.public_url || 
     `${process.env.NEXT_PUBLIC_FRAMES_BASE_URL}/${frame.storage_path}`;
   ```

#### Phase 4: Testing and Deployment (2-3 days)

1. **Test the Processing Service**
   - Test with various Loom URLs
   - Test with direct video uploads
   - Verify frames are correctly extracted and stored

2. **Deploy the Updated Next.js Application**
   ```bash
   # Add the new environment variables to Vercel
   vercel env add GOOGLE_CLOUD_PROJECT
   vercel env add GOOGLE_CLOUD_BUCKET
   vercel env add NEXT_PUBLIC_FRAMES_BASE_URL
   vercel env add NEXT_PUBLIC_VIDEO_PROCESSOR_URL
   
   # Deploy the application
   vercel --prod
   ```

3. **Monitor and Troubleshoot**
   - Check Cloud Run logs for processing issues
   - Verify frame extraction and storage
   - Test the end-to-end flow from video import to frame display

### Cost Estimate for Simplified Approach

- **Google Cloud Storage**: ~$0.02/GB/month (minimal for frame storage)
- **Cloud Run**: Pay-per-use, typically $5-15/month for low volume
- **Data Transfer**: Minimal costs for transferring frames

**Total Estimated Cost**: $10-30/month for the simplified approach

### Future Expansion Options

This simplified approach can be expanded in the future:

1. **Add Processing Queue**
   - Implement Cloud Pub/Sub for handling multiple video processing requests
   - Create a separate worker service for background processing

2. **Enhance Frame Extraction**
   - Add options for frame extraction density
   - Implement scene detection for smarter frame selection
   - Add thumbnail generation for faster loading

3. **Implement PDF Export**
   - Use the same Cloud Run service to generate PDFs
   - Store exported PDFs in Google Cloud Storage

This approach gives you a working video processing solution quickly while leaving the door open for future enhancements.