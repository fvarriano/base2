## Video Processing Implementation

### 1. Update Database Schema
Add to `supabase/init.sql`:
```sql
CREATE TABLE videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE frames (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id UUID REFERENCES videos(id),
    frame_number INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE frames ENABLE ROW LEVEL SECURITY;

-- Allow public access
CREATE POLICY "Allow all operations for videos" ON videos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for frames" ON frames FOR ALL USING (true) WITH CHECK (true);
```

### 2. Set Up Storage Buckets
1. Go to Supabase Dashboard
2. Create two public buckets:
   - `videos`
   - `frames`
3. Set bucket policies to public

### 3. Update TypeScript Types
Add to `src/lib/database.types.ts`:
```typescript
// Add to existing Database interface
videos: {
  Row: {
    id: string
    project_id: string
    filename: string
    storage_path: string
    status: string
    created_at: string
  }
  Insert: {
    id?: string
    project_id: string
    filename: string
    storage_path: string
    status?: string
    created_at?: string
  }
}
frames: {
  Row: {
    id: string
    video_id: string
    frame_number: number
    storage_path: string
    created_at: string
  }
  Insert: {
    id?: string
    video_id: string
    frame_number: number
    storage_path: string
    created_at?: string
  }
}
```

### 4. Set Up Cloudflare Worker
1. Create Cloudflare account
2. Install Wrangler CLI:
```bash
npm install -g wrangler
```
3. Create new worker:
```bash
wrangler init video-processor
cd video-processor
```
4. Add environment variables in Cloudflare Dashboard:
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY

### 5. Deploy
1. Deploy Next.js app to Vercel:
```bash
vercel
```
2. Deploy Cloudflare Worker:
```bash
wrangler deploy
```
3. Add environment variables to Vercel:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - CLOUDFLARE_WORKER_URL

### 6. Usage Limits
- Supabase Storage: 1GB (Free tier)
- Cloudflare Worker: 100,000 requests/day (Free tier)
- Video size: Up to 100MB
- Processing time: ~30 seconds per video

### 7. Maintenance
- Monitor storage usage in Supabase Dashboard
- Check worker execution logs in Cloudflare Dashboard
- Periodically clean up old videos/frames

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