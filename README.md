# Next.js App with Supabase

This is a modern web application built with Next.js, Tailwind CSS, shadcn/ui, and Supabase.

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - Re-usable components
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

## Deployment

The easiest way to deploy your Next.js app is to use [Vercel](https://vercel.com/new).

## Project Structure

- `/src/app` - App router pages and layouts
- `/src/lib` - Utility functions and shared libraries
- `/src/components` - React components
- `/public` - Static assets

## Adding New Features

1. Components: Use shadcn/ui to add new components:
   ```bash
   npx shadcn-ui@latest add [component-name]
   ```

2. Database: Use Supabase Dashboard to manage your database schema and API

3. Styling: Use Tailwind CSS classes for styling components
# base2
