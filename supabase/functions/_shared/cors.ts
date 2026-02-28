/**
 * CORS helper for Supabase Edge Functions
 * Handles cross-origin requests, particularly for GitHub Pages deployments
 */

export interface CorsOptions {
  origin?: string | string[];
  methods?: string[];
  headers?: string[];
  maxAge?: number;
}

const DEFAULT_OPTIONS: CorsOptions = {
  origin: '*', // Allow all origins (can be restricted to specific domains)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
};

/**
 * Creates CORS headers based on the request and options
 */
export function createCorsHeaders(
  request: Request,
  options: CorsOptions = {}
): Headers {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const headers = new Headers();

  // Handle origin
  const requestOrigin = request.headers.get('origin');
  if (opts.origin === '*' || (requestOrigin && opts.origin?.includes(requestOrigin))) {
    headers.set('Access-Control-Allow-Origin', requestOrigin || '*');
  } else if (typeof opts.origin === 'string') {
    headers.set('Access-Control-Allow-Origin', opts.origin);
  }

  // Handle methods
  if (opts.methods) {
    headers.set('Access-Control-Allow-Methods', opts.methods.join(', '));
  }

  // Handle headers
  if (opts.headers) {
    headers.set('Access-Control-Allow-Headers', opts.headers.join(', '));
  }

  // Handle credentials
  headers.set('Access-Control-Allow-Credentials', 'true');

  // Handle max age
  if (opts.maxAge) {
    headers.set('Access-Control-Max-Age', opts.maxAge.toString());
  }

  return headers;
}

/**
 * Handles preflight OPTIONS requests
 */
export function handleCorsPreflight(
  request: Request,
  options: CorsOptions = {}
): Response | null {
  if (request.method === 'OPTIONS') {
    const headers = createCorsHeaders(request, options);
    return new Response(null, { status: 204, headers });
  }
  return null;
}

/**
 * Adds CORS headers to a response
 */
export function addCorsHeaders(
  response: Response,
  request: Request,
  options: CorsOptions = {}
): Response {
  const corsHeaders = createCorsHeaders(request, options);
  corsHeaders.forEach((value, key) => {
    response.headers.set(key, value);
  });
  return response;
}
