# Next.js App with Supabase

This is a modern web application built with Next.js, Tailwind CSS, and Supabase.

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Backend as a Service

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a Supabase project and get your credentials

4. Create a `.env.local` file in the root directory and add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- `/src/app` - App router pages and layouts
- `/src/lib` - Utility functions and shared libraries
- `/src/components` - React components
- `/public` - Static assets

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