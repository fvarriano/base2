/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { createClient } from '@supabase/supabase-js';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_KEY: string;
}

interface ProcessVideoRequest {
	videoId: string;
	projectId: string;
	storagePath: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		
		// Handle static file requests
		if (request.method === 'GET') {
			if (url.pathname === '/ffmpeg-core.js') {
				const response = await fetch('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js');
				return new Response(response.body, {
					headers: {
						'Content-Type': 'text/javascript',
						'Access-Control-Allow-Origin': '*',
						'Cross-Origin-Embedder-Policy': 'require-corp',
						'Cross-Origin-Opener-Policy': 'same-origin'
					}
				});
			}
			if (url.pathname === '/ffmpeg-core.wasm') {
				const response = await fetch('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm');
				return new Response(response.body, {
					headers: {
						'Content-Type': 'application/wasm',
						'Access-Control-Allow-Origin': '*',
						'Cross-Origin-Embedder-Policy': 'require-corp',
						'Cross-Origin-Opener-Policy': 'same-origin'
					}
				});
			}
			if (url.pathname === '/ffmpeg-worker.js') {
				const response = await fetch('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-worker.js');
				return new Response(response.body, {
					headers: {
						'Content-Type': 'text/javascript',
						'Access-Control-Allow-Origin': '*',
						'Cross-Origin-Embedder-Policy': 'require-corp',
						'Cross-Origin-Opener-Policy': 'same-origin'
					}
				});
			}
		}

		let videoId: string | undefined;
		let supabase: any;

		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
					'Access-Control-Max-Age': '86400',
					'Cross-Origin-Embedder-Policy': 'require-corp',
					'Cross-Origin-Opener-Policy': 'same-origin'
				},
			});
		}

		// Only allow POST requests for video processing
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { 
				status: 405,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Cross-Origin-Embedder-Policy': 'require-corp',
					'Cross-Origin-Opener-Policy': 'same-origin'
				}
			});
		}

		try {
			// Check environment variables
			if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
				throw new Error('Missing Supabase environment variables');
			}

			// Parse request body
			const body: ProcessVideoRequest = await request.json();
			videoId = body.videoId;
			const { projectId, storagePath } = body;
			console.log('Processing request:', { videoId, projectId, storagePath });

			if (!videoId || !projectId || !storagePath) {
				throw new Error('Missing required fields');
			}

			// Initialize Supabase client
			console.log('Initializing Supabase client');
			supabase = createClient(
				env.SUPABASE_URL,
				env.SUPABASE_SERVICE_KEY,
				{
					auth: {
						persistSession: false
					}
				}
			);

			// Update video status to processing
			console.log('Updating status to processing');
			const { error: updateError } = await supabase
				.from('videos')
				.update({ status: 'processing' })
				.eq('id', videoId);

			if (updateError) {
				throw new Error(`Failed to update video status: ${updateError.message}`);
			}

			// Download video from storage
			console.log('Downloading video from storage');
			const { data: videoData, error: downloadError } = await supabase
				.storage
				.from('videos')
				.download(storagePath);

			if (downloadError) {
				throw new Error(`Failed to download video: ${downloadError.message}`);
			}

			// Initialize FFmpeg
			console.log('Initializing FFmpeg');
			const ffmpeg = new FFmpeg();
			const baseUrl = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
			await ffmpeg.load({
				coreURL: `${baseUrl}/ffmpeg-core.js`,
				wasmURL: `${baseUrl}/ffmpeg-core.wasm`,
				workerURL: `${baseUrl}/ffmpeg-worker.js`
			});

			// Write video file to FFmpeg virtual filesystem
			const videoBlob = new Blob([videoData], { type: 'video/mp4' });
			const videoBuffer = await fetchFile(videoBlob);
			await ffmpeg.writeFile('input.mp4', videoBuffer);

			// Extract frames (1 frame per second)
			console.log('Extracting frames');
			await ffmpeg.exec([
				'-i', 'input.mp4',
				'-vf', 'fps=1',
				'-frame_pts', '1',
				'-f', 'image2',
				'frame_%d.jpg'
			]);

			// Get list of generated frames
			const frames = await ffmpeg.listDir('/');
			const frameFiles = frames.filter(f => f.name.startsWith('frame_') && f.name.endsWith('.jpg'));

			// Upload frames and create records
			console.log(`Uploading ${frameFiles.length} frames`);
			for (let i = 0; i < frameFiles.length; i++) {
				const frameFile = frameFiles[i];
				const frameData = await ffmpeg.readFile(frameFile.name);
				const frameBlob = new Blob([frameData], { type: 'image/jpeg' });
				const framePath = `${projectId}/${videoId}/frame_${i}.jpg`;

				// Upload frame
				console.log(`Uploading frame ${i + 1} to ${framePath}`);
				const { error: frameUploadError } = await supabase
					.storage
					.from('frames')
					.upload(framePath, frameBlob, {
						contentType: 'image/jpeg',
						cacheControl: '3600'
					});

				if (frameUploadError) {
					throw new Error(`Failed to upload frame ${i}: ${frameUploadError.message}`);
				}

				// Create frame record
				console.log(`Creating database record for frame ${i + 1}`);
				const { error: frameRecordError } = await supabase
					.from('frames')
					.insert({
						video_id: videoId,
						frame_number: i,
						storage_path: framePath
					});

				if (frameRecordError) {
					throw new Error(`Failed to create frame record ${i}: ${frameRecordError.message}`);
				}
			}

			// Update video status to completed
			console.log('Updating status to completed');
			const { error: finalUpdateError } = await supabase
				.from('videos')
				.update({ 
					status: 'completed'
				})
				.eq('id', videoId);

			if (finalUpdateError) {
				throw new Error(`Failed to update final video status: ${finalUpdateError.message}`);
			}

			console.log('Processing completed successfully');
			return new Response(
				JSON.stringify({ 
					success: true,
					message: 'Video processing completed',
					frameCount: frameFiles.length
				}),
				{ 
					headers: { 
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					}
				}
			);

		} catch (error) {
			console.error('Error processing video:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			
			// Try to update video status to error if we have Supabase client and videoId
			if (supabase && videoId) {
				try {
					console.log('Updating status to error');
					await supabase
						.from('videos')
						.update({ 
							status: 'error',
							error_message: errorMessage
						})
						.eq('id', videoId);
				} catch (updateError) {
					console.error('Failed to update error status:', updateError);
				}
			}

			return new Response(
				JSON.stringify({ 
					success: false,
					error: errorMessage,
					details: {
						videoId,
						hasSupabase: !!supabase,
						hasEnvVars: {
							url: !!env.SUPABASE_URL,
							key: !!env.SUPABASE_SERVICE_KEY
						}
					}
				}),
				{ 
					status: 500,
					headers: { 
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					}
				}
			);
		}
	}
} satisfies ExportedHandler<Env>;
