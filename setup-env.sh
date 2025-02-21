#!/bin/bash

# Supabase URL
echo "Setting NEXT_PUBLIC_SUPABASE_URL"
vercel env add NEXT_PUBLIC_SUPABASE_URL <<EOF
https://ezclbieisztdxwzltjnl.supabase.co
Production,Preview,Development
EOF

# Supabase Anon Key
echo "Setting NEXT_PUBLIC_SUPABASE_ANON_KEY"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY <<EOF
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6Y2xiaWVpc3p0ZHh3emx0am5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk5OTk5MDQsImV4cCI6MjA1NTU3NTkwNH0.8uz2LIXut96rLpSNshqeUADQyuhpIGYOW6QFDmFhfeo
Production,Preview,Development
EOF

# Video Processor URL
echo "Setting NEXT_PUBLIC_VIDEO_PROCESSOR_URL"
vercel env add NEXT_PUBLIC_VIDEO_PROCESSOR_URL <<EOF
https://lucky-fire-7d58.appaudits.workers.dev
Production,Preview,Development
EOF 