#!/bin/bash

# Supabase URL
echo "Setting NEXT_PUBLIC_SUPABASE_URL"
vercel env add NEXT_PUBLIC_SUPABASE_URL <<EOF
https://tzsesaqnkjxqcpbuzdvr.supabase.co
Production,Preview,Development
EOF

# Supabase Anon Key
echo "Setting NEXT_PUBLIC_SUPABASE_ANON_KEY"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY <<EOF
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6c2VzYXFua2p4cWNwYnV6ZHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4MDk4MzQsImV4cCI6MjA1NTM4NTgzNH0.Qr4n-EidUvQ3reesDFLEA-YpULkJE-x_nTtEKH2W4P0
Production,Preview,Development
EOF

# Video Processor URL
echo "Setting NEXT_PUBLIC_VIDEO_PROCESSOR_URL"
vercel env add NEXT_PUBLIC_VIDEO_PROCESSOR_URL <<EOF
https://lucky-fire-7d58.appaudits.workers.dev
Production,Preview,Development
EOF 