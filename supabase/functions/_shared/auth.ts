/**
 * Authentication helper for Supabase Edge Functions
 * Manually verifies JWT tokens from the Authorization header
 *
 * Note: This is used because Supabase is transitioning JWT verification.
 * Deploy functions with --no-verify-jwt and handle auth manually.
 */

/**
 * Verifies a Supabase JWT token by calling the Supabase Auth API
 */
export async function verifyAuth(
  request: Request,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<{ user: any; error: null } | { user: null; error: string }> {
  // Extract the Authorization header
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return { user: null, error: 'Missing Authorization header' };
  }

  // Extract the token (format: "Bearer <token>")
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return { user: null, error: 'Missing token in Authorization header' };
  }

  try {
    // Verify the token by calling Supabase Auth API
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseServiceKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        user: null,
        error: `Authentication failed: ${response.status} ${errorText}`
      };
    }

    const user = await response.json();
    return { user, error: null };
  } catch (error) {
    return {
      user: null,
      error: `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Gets the Supabase URL from environment variables
 * Falls back to extracting from request if needed
 * Note: Supabase CLI doesn't allow secrets starting with SUPABASE_,
 * so we extract from the request URL automatically
 */
export function getSupabaseUrl(request: Request): string {
  // Try to get from environment first (if set via PROJECT_URL or similar)
  const envUrl = Deno.env.get('PROJECT_URL');
  if (envUrl) {
    return envUrl;
  }

  // Extract from the request URL automatically
  // Edge functions are typically at: https://<project-ref>.supabase.co/functions/v1/<function-name>
  const url = new URL(request.url);
  const hostname = url.hostname;

  // Extract project ref from hostname (e.g., "orxluewmoltsbkjgzflh.supabase.co")
  const match = hostname.match(/^([^.]+)\.supabase\.co$/);
  if (match) {
    return `https://${hostname}`;
  }

  throw new Error('Could not determine Supabase URL from request. Set PROJECT_URL secret if needed.');
}

/**
 * Gets the Supabase service key from environment variables
 * Note: Supabase CLI doesn't allow secrets starting with SUPABASE_,
 * so we use SERVICE_ROLE_KEY instead
 */
export function getSupabaseServiceKey(): string {
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY');

  if (!serviceKey) {
    throw new Error('SERVICE_ROLE_KEY environment variable is required. Set it with: supabase secrets set SERVICE_ROLE_KEY=your_key');
  }

  return serviceKey;
}
