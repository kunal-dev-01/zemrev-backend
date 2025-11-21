

// ============================================
// 1. CONSTANTS
// ============================================

// Hop-by-hop headers jo remove karne hain
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
]);

// Routes configuration - kaunsa path kaunsi service ko jaye
const ROUTE_CONFIG = [
  { pattern: '/api/v1/auth/*', service: 'AUTH_SERVICE' },
  { pattern: '/api/v1/user/*', service: 'USER_SERVICE' },
  { pattern: '/api/v1/credit/*', service: 'USER_SERVICE' },
  { pattern: '/api/v1/payment/*', service: 'USER_SERVICE' },
];

// CORS headers - taqreeb tamam clients se allow karne hain
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

// ============================================
// 2. UTILITY FUNCTIONS
// ============================================

/**
 * Headers ko clean karo - sensitive headers nikalo
 */
function cleanHeaders(headers) {
  const cleaned = new Headers();

  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();

    // Hop-by-hop headers skip karo
    if (HOP_BY_HOP_HEADERS.has(lowerKey)) {
      return;
    }

    // Sensitive headers skip karo
    if (
      lowerKey === 'host' ||
      lowerKey === 'cookie' ||
      lowerKey === 'authorization'
    ) {
      return;
    }

    cleaned.set(key, value);
  });

  return cleaned;
}

/**
 * Client ka IP address nikalo
 */
function getClientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

/**
 * Upstream URL banao - path aur query ke saath
 */
function buildUpstreamUrl(baseUrl, path, query) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(baseUrl);
  url.pathname = cleanPath;

  if (query) {
    url.search = query;
  }

  return url.toString();
}

/**
 * Route match karo - dekho kaunsa upstream service lagega
 */
function findUpstream(path) {
  for (const route of ROUTE_CONFIG) {
    const pattern = route.pattern.replace('*', '.*');
    if (new RegExp(`^${pattern}$`).test(path)) {
      return route.service;
    }
  }
  return null;
}

/**
 * Request ko upstream service ko bhejo
 */
async function proxyRequest(request, upstreamUrl, clientIp) {
  const method = request.method;
  const headers = cleanHeaders(request.headers);

  // Forwarded headers add karo
  headers.set('x-forwarded-for', clientIp);
  headers.set('x-forwarded-proto', 'https');
  headers.set('x-gateway-via', 'cloudflare-worker');

  // Fetch options banao
  const fetchOptions = {
    method,
    headers,
    cf: {
      cacheTtl: 0,
      cacheEverything: false,
    },
  };

  // POST, PUT, PATCH mein body hota hai
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    if (request.body) {
      fetchOptions.body = request.body;
    }
  }

  try {
    // 10 second timeout set karo
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const upstreamResponse = await fetch(upstreamUrl, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Response headers mein CORS add karo
    const responseHeaders = new Headers(upstreamResponse.headers);

    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const errorMessage = error?.message || 'Unknown error';
    const isTimeout = errorMessage.includes('abort');

    console.error('Upstream request failed:', {
      url: upstreamUrl,
      error: errorMessage,
      isTimeout,
    });

    const statusCode = isTimeout ? 504 : 502;
    const errorBody = JSON.stringify({
      error: isTimeout ? 'Gateway Timeout' : 'Bad Gateway',
      message: `Failed to reach upstream service: ${errorMessage}`,
      requestId: Math.random().toString(36).substring(7),
    });

    const headers = new Headers({
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    });

    return new Response(errorBody, {
      status: statusCode,
      headers,
    });
  }
}

/**
 * Health check - sab upstreams theek hain ya nahi check karo
 */
async function healthCheck(env) {
  const upstreams = [];

  for (const [serviceName, serviceUrl] of Object.entries(env)) {
    if (!serviceName.endsWith('_SERVICE')) {
      continue;
    }

    const displayName = serviceName.replace('_SERVICE', '');
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${serviceUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        cf: { cacheTtl: 0 },
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      upstreams.push({
        name: displayName,
        url: serviceUrl,
        status: response.ok ? 'ok' : 'error',
        responseTime,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      upstreams.push({
        name: displayName,
        url: serviceUrl,
        status: 'error',
        responseTime,
      });

      console.warn(`Health check failed for ${displayName}:`, {
        url: serviceUrl,
        error: error?.message || 'Unknown error',
      });
    }
  }

  const healthResponse = {
    gateway: 'ok',
    upstreams,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(healthResponse, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

// ============================================
// 3. MAIN WORKER HANDLER
// ============================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const query = url.search;
    const method = request.method;
    const clientIp = getClientIp(request);

    console.log(`[${method}] ${path} from ${clientIp}`);

    // ============ CORS Preflight ============
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // ============ Health Check ============
    if (path === '/health' || path === '/api/v1/health') {
      return healthCheck(env);
    }

    // ============ Find Upstream Service ============
    const upstreamServiceKey = findUpstream(path);

    if (!upstreamServiceKey) {
      console.warn(`No route found for: ${path}`);

      return new Response(
        JSON.stringify({
          error: 'Not Found',
          message: `No upstream service configured for path: ${path}`,
          availableRoutes: ROUTE_CONFIG.map((r) => r.pattern),
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        },
      );
    }

    const upstreamBaseUrl = env[upstreamServiceKey];

    if (!upstreamBaseUrl) {
      console.error(`Environment variable not set: ${upstreamServiceKey}`);

      return new Response(
        JSON.stringify({
          error: 'Service Unavailable',
          message: `Upstream service ${upstreamServiceKey} is not configured`,
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        },
      );
    }

    // ============ Build Upstream URL ============
    const upstreamUrl = buildUpstreamUrl(upstreamBaseUrl, path, query);

    console.log(`Proxying to: ${upstreamUrl}`);

    // ============ Proxy Request ============
    const response = await proxyRequest(request, upstreamUrl, clientIp);

    return response;
  },
};