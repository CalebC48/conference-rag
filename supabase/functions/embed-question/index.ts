/**
 * Supabase Edge Function: embed-question
 *
 * Generates embeddings for questions using OpenAI's text-embedding-3-small model.
 *
 * POST /functions/v1/embed-question
 * Body: { "question": "..." }
 * Response: { "embedding": [...] }
 */

import { handleCorsPreflight, addCorsHeaders } from '../_shared/cors.ts';
import { verifyAuth, getSupabaseUrl, getSupabaseServiceKey } from '../_shared/auth.ts';

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';

Deno.serve(async (request: Request) => {
  // Handle CORS preflight
  const corsPreflight = handleCorsPreflight(request);
  if (corsPreflight) {
    return corsPreflight;
  }

  // Only allow POST requests
  if (request.method !== 'POST') {
    const response = new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
    return addCorsHeaders(response, request);
  }

  try {
    // Verify authentication
    const supabaseUrl = getSupabaseUrl(request);
    const supabaseServiceKey = getSupabaseServiceKey();

    const authResult = await verifyAuth(request, supabaseUrl, supabaseServiceKey);

    if (authResult.error || !authResult.user) {
      console.error('Authentication failed:', authResult.error);
      const response = new Response(
        JSON.stringify({ error: authResult.error || 'Authentication failed' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return addCorsHeaders(response, request);
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      const response = new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return addCorsHeaders(response, request);
    }

    // Validate question field
    if (!body.question || typeof body.question !== 'string') {
      const response = new Response(
        JSON.stringify({ error: 'Missing or invalid "question" field in request body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return addCorsHeaders(response, request);
    }

    const question = body.question.trim();

    if (question.length === 0) {
      const response = new Response(
        JSON.stringify({ error: 'Question cannot be empty' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return addCorsHeaders(response, request);
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY environment variable is not set');
      const response = new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return addCorsHeaders(response, request);
    }

    // Call OpenAI API to generate embedding
    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: question,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);

      const response = new Response(
        JSON.stringify({
          error: `Failed to generate embedding: ${openaiResponse.status}`
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return addCorsHeaders(response, request);
    }

    const openaiData = await openaiResponse.json();

    // Extract embedding from OpenAI response
    if (!openaiData.data || !Array.isArray(openaiData.data) || openaiData.data.length === 0) {
      const response = new Response(
        JSON.stringify({ error: 'Invalid response from OpenAI API' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return addCorsHeaders(response, request);
    }

    const embedding = openaiData.data[0].embedding;

    // Return the embedding
    const response = new Response(
      JSON.stringify({ embedding }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    return addCorsHeaders(response, request);

  } catch (error) {
    console.error('Unexpected error:', error);

    const response = new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    return addCorsHeaders(response, request);
  }
});
