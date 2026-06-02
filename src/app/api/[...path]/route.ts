import { NextRequest, NextResponse } from 'next/server';

async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8081';
  const path = params.path.join('/');
  const url = `${backendUrl}/api/${path}${req.nextUrl.search}`;

  console.log(`[PROXY] ${req.method} ${url} | BACKEND_URL=${process.env.BACKEND_URL ?? 'NOT SET'}`);

  const headers: Record<string, string> = {};
  const contentType = req.headers.get('content-type');
  const auth = req.headers.get('authorization');
  if (contentType) headers['content-type'] = contentType;
  if (auth) headers['authorization'] = auth;

  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await req.text()
    : undefined;

  if (body) console.log(`[PROXY] Body: ${body.substring(0, 200)}`);

  try {
    const res = await fetch(url, { method: req.method, headers, body });
    const data = await res.text();
    console.log(`[PROXY] Response: ${res.status} | ${data.substring(0, 200)}`);

    return new NextResponse(data, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[PROXY] Fetch failed: ${message}`);
    return new NextResponse(JSON.stringify({ error: 'Proxy error', detail: message }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
