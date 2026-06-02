import { NextRequest, NextResponse } from 'next/server';

async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8081';
  const path = params.path.join('/');
  const url = `${backendUrl}/api/${path}${req.nextUrl.search}`;

  const headers: Record<string, string> = {};
  const contentType = req.headers.get('content-type');
  const auth = req.headers.get('authorization');
  if (contentType) headers['content-type'] = contentType;
  if (auth) headers['authorization'] = auth;

  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await req.text()
    : undefined;

  const res = await fetch(url, { method: req.method, headers, body });
  const data = await res.text();

  return new NextResponse(data, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
  });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
