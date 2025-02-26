
## Development Philosophy

- **Simplicity First**: Each feature is implemented methodically and thoroughly before moving to the next
- **Step-by-Step Development**: Clear progression from basic functionality to advanced features
- **Quality Over Quantity**: Focus on perfecting core features rather than implementing many features partially



## Video Processing Implementation

### 8. Future Backend Processing Architecture

To enable background processing and handle larger videos more efficiently, the following architecture is recommended:

#### Components

1. **Upload Service**
   - Direct video upload to Supabase Storage
   - Create initial video record with 'pending' status
   - Send message to processing queue

2. **Processing Queue**
   - AWS SQS or similar message queue
   - Store video metadata and processing parameters
   - Enable retry mechanisms and dead letter queues

3. **Worker Service**
   - AWS Lambda or dedicated server with FFmpeg
   - Pull messages from queue
   - Process videos using native FFmpeg
   - Update progress in database
   - Store frames in Supabase Storage

4. **Status Updates**
   - Real-time updates via Supabase subscriptions
   - Progress tracking in databasea
   - Error handling and retry logic

#### Implementation Steps

1. **Set Up Infrastructure**
   ```bash
   # AWS Setup
   aws configure
   aws sqs create-queue --queue-name video-processing
   aws lambda create-function --function-name video-processor
   ```

2. **Database Schema Updates**
   ```sql
   -- Add processing metadata
   ALTER TABLE videos ADD COLUMN
     processing_progress INTEGER,
     processing_error TEXT,
     worker_id TEXT,
     started_at TIMESTAMPTZ,
     completed_at TIMESTAMPTZ;
   ```

3. **Worker Implementation**
   ```typescript
   // Example Lambda function
   export async function handler(event) {
     const { videoId, projectId } = event
     
     // Update status
     await supabase.from('videos')
       .update({ 
         status: 'processing',
         worker_id: context.awsRequestId,
         started_at: new Date()
       })
       .eq('id', videoId)
     
     try {
       // Process video with native FFmpeg
       // Extract and upload frames
       // Update progress
     } catch (error) {
       // Handle errors
     }
   }
   ```

4. **Frontend Updates**
   - Remove browser-based FFmpeg processing
   - Add progress polling or real-time subscriptions
   - Improve UX for background processing

#### Benefits

1. **Performance**
   - Native FFmpeg performance (5-10x faster)
   - No browser resource limitations
   - Parallel processing of multiple videos

2. **User Experience**
   - Background processing
   - No need to keep browser open
   - Better progress tracking
   - Handle larger videos (up to 5GB)

3. **Reliability**
   - Automatic retries
   - Better error handling
   - Processing queue management
   - Resource scaling

#### Cost Considerations

1. **AWS Costs (estimated)**
   - Lambda: ~$0.20 per 1000 videos
   - SQS: ~$0.40 per 1M messages
   - S3: ~$0.023 per GB/month

2. **Alternatives**
   - Digital Ocean Droplet: ~$5/month
   - Cloudflare Workers: Free tier available
   - Self-hosted solution

#### Monitoring

1. **CloudWatch Metrics**
   - Processing time
   - Error rates
   - Queue length
   - Resource usage

2. **Alerts**
   - Processing failures
   - Queue backlog
   - Resource constraints
   - Cost thresholds

## Video Frame Persistence and Organization Plan

### Current Issues
1. Frame persistence issues:
   - Frames are not properly persisting across sessions
   - Annotations are not consistently saved
   - Frame organization per video upload is not clear

2. Data structure issues:
   - No clear relationship between videos and their frames in the UI
   - Missing batch/upload session organization
   - No way to view historical uploads for a project

### Solution Plan

#### 1. Database Schema Updates
```sql
-- Add batch information to videos table
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS
    batch_name TEXT,
    batch_order INTEGER;

-- Add indexes for better querying
CREATE INDEX IF NOT EXISTS idx_videos_project_id ON public.videos(project_id);
CREATE INDEX IF NOT EXISTS idx_videos_batch_name ON public.videos(batch_name);
```

#### 2. UI/UX Improvements
1. Project Details Page:
   - Group frames by video upload batch
   - Show upload date and batch name
   - Collapsible sections for each batch
   - Batch-level actions (delete, export)

2. Video Upload Flow:
   - Add batch name input
   - Show upload progress per batch
   - Maintain batch context across uploads

3. Frame Management:
   - Add batch context to frame display
   - Improve frame deletion UX
   - Add batch-level frame operations

#### 3. Implementation Steps

1. Database Updates:
   ```bash
   # Create new migration
   supabase migration new add_batch_info_to_videos
   ```

2. Component Updates:
   - Update VideoUpload component to handle batch information
   - Create new BatchFrameGroup component
   - Modify VideoFrames to work within batch context

3. API Updates:
   - Add batch-aware queries
   - Implement batch-level operations
   - Update frame storage paths to include batch info

4. Storage Organization:
   ```
   storage/
   └── frames/
       └── project_id/
           └── batch_name/
               └── video_id/
                   └── frame_001.jpg
   ```

#### 4. Testing Plan
1. Verify frame persistence:
   - Upload multiple videos
   - Check frames after page refresh
   - Verify annotations persist

2. Test batch operations:
   - Create multiple batches
   - Delete entire batches
   - Move frames between batches

3. Performance testing:
   - Load testing with multiple batches
   - Memory usage monitoring
   - Storage space tracking

### Implementation Timeline
1. Database Schema Updates (1 day)
2. Storage Reorganization (1 day)
3. Component Updates (2-3 days)
4. Testing & Bug Fixes (2 days)

### Usage Guidelines
1. Batch Naming:
   - Use descriptive names
   - Include date in batch name
   - Maximum length: 50 characters

2. Storage Management:
   - Regular cleanup of unused batches
   - Automatic removal of temporary files
   - Storage usage monitoring

3. Performance Considerations:
   - Limit frames per batch: 100
   - Maximum concurrent uploads: 5
   - Implement lazy loading for large batches

### 9. Loom URL Integration with Backend Architecture

#### Overview
Integrate Loom video processing alongside direct uploads using the backend processing architecture.

#### Components Updates

1. **Upload Service**
   - Accept both direct file uploads and Loom URLs
   - Handle Loom API authentication
   - Download Loom videos to temporary storage
   - Create video records with source metadata

2. **Processing Queue**
   - Add source_type field ('direct' or 'loom')
   - Store Loom-specific metadata
   - Handle different processing priorities

3. **Worker Service**
   - Handle both local files and Loom downloads
   - Implement Loom API error handling
   - Process videos based on source type

#### Implementation Steps

1. **Database Updates**
   ```sql
   -- Add source information to videos table
   ALTER TABLE videos ADD COLUMN
     source_type TEXT DEFAULT 'direct',
     source_url TEXT,
     source_metadata JSONB;
   ```

2. **Loom API Integration**
   ```bash
   # Environment Variables
   LOOM_API_KEY=your_api_key
   LOOM_API_URL=https://api.loom.com/v1
   ```

3. **Worker Implementation**
   ```typescript
   // Example Lambda function update
   export async function handler(event) {
     const { videoId, projectId, sourceType, sourceUrl } = event
     
     // Handle Loom videos
     if (sourceType === 'loom') {
       try {
         // Fetch Loom video details
         const loomDetails = await fetchLoomVideo(sourceUrl)
         
         // Download to temporary storage
         const videoPath = await downloadLoomVideo(
           loomDetails.download_url,
           `/tmp/${videoId}.mp4`
         )
         
         // Process with native FFmpeg
         await processVideo(videoPath, projectId)
         
         // Cleanup temporary files
         await cleanup(videoPath)
       } catch (error) {
         // Handle Loom-specific errors
         await handleLoomError(error, videoId)
       }
     } else {
       // Handle direct uploads
       await processDirectUpload(event)
     }
   }
   ```

4. **Frontend Updates**
   ```typescript
   // Video upload component
   interface VideoSource {
     type: 'direct' | 'loom';
     url?: string;
     file?: File;
   }
   
   async function handleVideoUpload(source: VideoSource) {
     // Create initial record
     const { data: video } = await supabase
       .from('videos')
       .insert({
         project_id: projectId,
         source_type: source.type,
         source_url: source.url,
         status: 'pending'
       })
       .select()
       .single()
     
     // Send to processing queue
     await fetch('/api/process-video', {
       method: 'POST',
       body: JSON.stringify({
         videoId: video.id,
         sourceType: source.type,
         sourceUrl: source.url
       })
     })
   }
   ```

#### Integration Flow

1. **Loom URL Submission**
   ```
   User submits Loom URL
   ↓
   Validate URL format
   ↓
   Create video record (status: pending)
   ↓
   Send to processing queue
   ↓
   Return video ID to frontend
   ```

2. **Worker Processing**
   ```
   Receive queue message
   ↓
   Fetch Loom video metadata
   ↓
   Download video to temp storage
   ↓
   Process with native FFmpeg
   ↓
   Upload frames to storage
   ↓
   Update video status
   ```

3. **Error Handling**
   ```
   Loom API errors
   ↓
   Download failures
   ↓
   Processing errors
   ↓
   Update video status
   ↓
   Retry logic
   ```

#### Testing Plan

1. **API Integration Tests**
   - Loom API authentication
   - Video metadata retrieval
   - Download functionality
   - Error handling

2. **Processing Tests**
   - Various Loom video formats
   - Different video lengths
   - Error conditions
   - Retry mechanisms

3. **End-to-End Tests**
   - Complete processing flow
   - Status updates
   - Frame generation
   - Cleanup procedures

#### Monitoring Additions

1. **Loom-specific Metrics**
   - API response times
   - Download speeds
   - Processing times
   - Error rates

2. **Alerts**
   - Loom API issues
   - Download failures
   - Processing errors
   - Rate limit warnings

#### Cost Considerations

1. **Loom API Usage**
   - Free tier limits
   - API call costs
   - Storage requirements
   - Bandwidth costs

2. **Processing Costs**
   - Additional storage for temporary files
   - Increased processing time
   - Bandwidth for downloads

#### Security Considerations

1. **API Security**
   - Secure API key storage
   - Request validation
   - URL sanitization
   - Access controls

2. **Data Handling**
   - Temporary file management
   - Secure downloads
   - Data encryption
   - Privacy compliance

#### Implementation Timeline

1. Database Updates (1 day)
2. Loom API Integration (2 days)
3. Worker Service Updates (2-3 days)
4. Frontend Integration (1-2 days)
5. Testing & Bug Fixes (2-3 days)

#### Usage Guidelines

1. **Loom URL Requirements**
   - Format validation
   - Access permissions
   - Video length limits
   - Size restrictions

2. **Error Messages**
   - User-friendly errors
   - Technical details logging
   - Status notifications
   - Retry instructions

3. **Performance Guidelines**
   - Optimal video lengths
   - Processing time estimates
   - Queue priority handling
   - Resource allocation

#### Loom API Setup Guide

1. **Get API Access**
   - Visit [Loom Developers Portal](https://www.loom.com/developers)
   - Create a new application
   - Copy API key and secret
   - Note your rate limits (typically 100 requests/hour on free tier)

2. **Required Permissions**
   - Video read access
   - Download URL access
   - Content API access

#### Local Development Setup

1. **Environment Setup**
   ```bash
   # Add to .env.local
   LOOM_API_KEY=your_api_key
   LOOM_API_URL=https://api.loom.com/v1
   ```

2. **Testing Tools**
   ```bash
   # Install helpful testing utilities
   npm install -D jest-fetch-mock
   npm install -D @types/jest
   ```

3. **Debug Configuration**
   ```json
   {
     "configurations": [
       {
         "type": "node",
         "request": "launch",
         "name": "Debug Worker",
         "skipFiles": ["<node_internals>/**"],
         "program": "${workspaceFolder}/worker/index.ts"
       }
     ]
   }
   ```

#### Deployment Checklist

1. **Environment Variables**
   - [ ] Add LOOM_API_KEY to production environment
   - [ ] Add LOOM_API_URL to production environment
   - [ ] Update CORS settings if needed

2. **Infrastructure Updates**
   - [ ] Increase worker memory limits for video downloads
   - [ ] Update storage bucket permissions
   - [ ] Configure monitoring for Loom API calls

3. **Database Migration**
   - [ ] Run source_type column migration
   - [ ] Update existing video records
   - [ ] Verify indexes are created

4. **Testing Verification**
   - [ ] Test with various Loom video lengths
   - [ ] Verify error handling in production
   - [ ] Monitor initial processing jobs