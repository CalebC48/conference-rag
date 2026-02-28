/**
 * Supabase Edge Function: generate-answer
 *
 * Generates AI-powered answers using GPT-4o based on conference talk context.
 *
 * POST /functions/v1/generate-answer
 * Body: { "question": "...", "context_talks": [{ title, speaker, text }] }
 * Response: { "answer": "..." }
 */

import { handleCorsPreflight, addCorsHeaders } from "../_shared/cors.ts";
import {
  verifyAuth,
  getSupabaseUrl,
  getSupabaseServiceKey,
} from "../_shared/auth.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const GPT_MODEL = "gpt-4o";

Deno.serve(async (request: Request) => {
  // Handle CORS preflight
  const corsPreflight = handleCorsPreflight(request);
  if (corsPreflight) {
    return corsPreflight;
  }

  // Only allow POST requests
  if (request.method !== "POST") {
    const response = new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
    return addCorsHeaders(response, request);
  }

  try {
    // Verify authentication
    const supabaseUrl = getSupabaseUrl(request);
    const supabaseServiceKey = getSupabaseServiceKey();

    const authResult = await verifyAuth(
      request,
      supabaseUrl,
      supabaseServiceKey
    );

    if (authResult.error || !authResult.user) {
      console.error("Authentication failed:", authResult.error);
      const response = new Response(
        JSON.stringify({ error: authResult.error || "Authentication failed" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
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
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
      return addCorsHeaders(response, request);
    }

    // Validate question field
    if (!body.question || typeof body.question !== "string") {
      const response = new Response(
        JSON.stringify({
          error: 'Missing or invalid "question" field in request body',
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
      return addCorsHeaders(response, request);
    }

    const question = body.question.trim();

    if (question.length === 0) {
      const response = new Response(
        JSON.stringify({ error: "Question cannot be empty" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
      return addCorsHeaders(response, request);
    }

    // Validate context_talks field
    if (!body.context_talks || !Array.isArray(body.context_talks)) {
      const response = new Response(
        JSON.stringify({
          error: 'Missing or invalid "context_talks" field. Must be an array.',
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
      return addCorsHeaders(response, request);
    }

    const contextTalks = body.context_talks;

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      console.error("OPENAI_API_KEY environment variable is not set");
      const response = new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
      return addCorsHeaders(response, request);
    }

    // Build the prompt with context talks
    let contextText = "";
    if (contextTalks.length > 0) {
      contextText = "\n\nRelevant conference talks:\n\n";
      for (let i = 0; i < contextTalks.length; i++) {
        const talk = contextTalks[i];
        const title = talk.title || "Unknown Title";
        const speaker = talk.speaker || "Unknown Speaker";
        const text = talk.text || "";

        contextText += `${i + 1}. "${title}" by ${speaker}\n`;
        contextText += `${text}\n\n`;
      }
    }

    const systemPrompt = `You are a helpful assistant that answers questions based on provided General Conference talks.
When you reference information from the talks, cite the talk title and speaker.
Be accurate, helpful, and cite your sources.`;

    const userPrompt = `Question: ${question}${contextText}\n\nPlease provide a thoughtful answer based on the conference talks provided above. Cite which talks you draw from.`;

    // Call OpenAI API to generate answer
    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: GPT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", openaiResponse.status, errorText);

      const response = new Response(
        JSON.stringify({
          error: `Failed to generate answer: ${openaiResponse.status}`,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
      return addCorsHeaders(response, request);
    }

    const openaiData = await openaiResponse.json();

    // Extract answer from OpenAI response
    if (
      !openaiData.choices ||
      !Array.isArray(openaiData.choices) ||
      openaiData.choices.length === 0
    ) {
      const response = new Response(
        JSON.stringify({ error: "Invalid response from OpenAI API" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
      return addCorsHeaders(response, request);
    }

    const answer = openaiData.choices[0].message?.content;

    if (!answer) {
      const response = new Response(
        JSON.stringify({ error: "No answer generated from OpenAI API" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
      return addCorsHeaders(response, request);
    }

    // Return the answer
    const response = new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    return addCorsHeaders(response, request);
  } catch (error) {
    console.error("Unexpected error:", error);

    const response = new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );

    return addCorsHeaders(response, request);
  }
});
