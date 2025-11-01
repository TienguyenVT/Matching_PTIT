import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(_req: NextRequest) {
  try {
    const { data: { user } } = await supabaseServer().auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const key = process.env.DAILY_API_KEY;
    if (!key) {
      const url = `https://example.com/mock-room/${crypto.randomUUID()}`;
      return NextResponse.json({ url, provider: 'mock' });
    }

    const resp = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ privacy: 'private', properties: { exp: Math.floor(Date.now()/1000) + 60*60 } }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json({ error: err }, { status: 400 });
    }
    const data = await resp.json();
    return NextResponse.json({ url: data.url, provider: 'daily' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}


