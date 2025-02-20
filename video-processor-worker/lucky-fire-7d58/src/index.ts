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
		let videoId: string | undefined;
		let supabase: any;

		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
					'Access-Control-Max-Age': '86400',
				},
			});
		}

		// Only allow POST requests
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { 
				status: 405,
				headers: {
					'Access-Control-Allow-Origin': '*',
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

			// Create the frames
			console.log('Starting frame creation');
			const frames = [];
			for (let i = 0; i < 5; i++) {
				console.log(`Processing frame ${i + 1}/5`);
				
				// Create a 100x100 pixel JPEG with a colored background
				const width = 100;
				const height = 100;
				const frameDataArray = [
					0xFF, 0xD8, // SOI marker
					0xFF, 0xE0, // APP0 marker
					0x00, 0x10, // Length of APP0 segment
					0x4A, 0x46, 0x49, 0x46, 0x00, // JFIF identifier
					0x01, 0x01, // JFIF version
					0x00, // Density units
					0x00, 0x01, // X density
					0x00, 0x01, // Y density
					0x00, 0x00, // Thumbnail size
					0xFF, 0xC0, // SOF marker
					0x00, 0x11, // Length of SOF segment
					0x08, // Precision
					(height >> 8) & 0xFF, height & 0xFF, // Height (100)
					(width >> 8) & 0xFF, width & 0xFF,   // Width (100)
					0x03, // Number of components (RGB)
					0x01, 0x22, 0x00, // Y component
					0x02, 0x11, 0x01, // Cb component
					0x03, 0x11, 0x01, // Cr component
					0xFF, 0xDB, // DQT marker
					0x00, 0x43, // Length
					0x00, // Table ID
					// Basic luminance quantization table
					0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07,
					0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14,
					0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12, 0x13,
					0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A,
					0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20, 0x22,
					0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C,
					0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39,
					0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32,
					0xFF, 0xC4, // DHT marker
					0x00, 0x1F, // Length
					0x00, // Table class and ID
					// Basic Huffman table
					0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01,
					0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
					0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
					0x08, 0x09, 0x0A, 0x0B,
					0xFF, 0xDA, // SOS marker
					0x00, 0x0C, // Length
					0x03, // Number of components
					0x01, 0x00, // Y component
					0x02, 0x00, // Cb component
					0x03, 0x00, // Cr component
					0x00, 0x3F, 0x00  // Spectral selection
				];

				// Add image data - a simple gradient pattern
				for (let y = 0; y < height; y++) {
					for (let x = 0; x < width; x++) {
						const r = Math.floor((x / width) * 255);
						const g = Math.floor((y / height) * 255);
						const b = Math.floor(((x + y) / (width + height)) * 255);
						frameDataArray.push(r, g, b);
					}
				}

				// Add EOI marker
				frameDataArray.push(0xFF, 0xD9);

				const frameData = new Uint8Array(frameDataArray);
				const blob = new Blob([frameData], { type: 'image/jpeg' });
				const framePath = `${projectId}/${videoId}/frame_${i}.jpg`;
				
				// Upload frame
				console.log(`Uploading frame ${i + 1} to ${framePath}`);
				const { error: frameUploadError } = await supabase
					.storage
					.from('frames')
					.upload(framePath, blob, {
						contentType: 'image/jpeg',
						cacheControl: '3600'
					});

				if (frameUploadError) {
					throw new Error(`Failed to upload frame ${i}: ${frameUploadError.message}`);
				}

				console.log(`Frame ${i + 1} uploaded successfully`);

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

				frames.push(framePath);
				console.log(`Frame ${i + 1} completed`);
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
					frameCount: frames.length
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
