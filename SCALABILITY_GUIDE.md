# 🚀 Hướng dẫn Scale cho 20+ Users Đồng thời

## 📊 Phân tích hiện tại
- **45 requests** mỗi page load
- **9MB resources** 
- **1.7 phút** total time
- **Duplicate calls:** 3x user, 5x profiles, 2x courses

## ✅ Giải pháp Tối ưu cho Multi-User

### 1. **Edge Caching với Supabase + CDN**

```javascript
// lib/supabase/cached-client.ts
import { createClient } from '@supabase/supabase-js';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

export function getCachedData(key: string, fetcher: () => Promise<any>) {
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return Promise.resolve(cached.data);
  }
  
  return fetcher().then(data => {
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  });
}

// Usage
export async function getCachedProfile(userId: string) {
  return getCachedData(`profile-${userId}`, async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  });
}
```

### 2. **Database Optimization**

```sql
-- Tạo indexes cho queries thường xuyên
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_courses_user ON user_courses(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_active ON courses(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_status ON chat_rooms(status);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);

-- Materialized View cho common queries
CREATE MATERIALIZED VIEW user_course_summary AS
SELECT 
  u.id as user_id,
  u.email,
  u.full_name,
  COUNT(uc.course_id) as course_count,
  ARRAY_AGG(c.title) as course_titles
FROM profiles u
LEFT JOIN user_courses uc ON u.id = uc.user_id
LEFT JOIN courses c ON uc.course_id = c.id
GROUP BY u.id, u.email, u.full_name;

-- Refresh every 5 minutes
CREATE OR REPLACE FUNCTION refresh_user_course_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW user_course_summary;
END;
$$ LANGUAGE plpgsql;
```

### 3. **Connection Pooling với PgBouncer**

```javascript
// lib/supabase/pooled-client.ts
import { createClient } from '@supabase/supabase-js';

// Use pooled connection string
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Connection pool config
const options = {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: true,
    storageKey: 'supabase.auth.token',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  global: {
    headers: {
      'x-connection-pool': 'true',
    },
  },
  // Reduce timeout for faster failover
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
};

export const supabasePooled = createClient(supabaseUrl, supabaseAnonKey, options);
```

### 4. **Server-Side Rendering với ISR**

```tsx
// app/(main)/courses/page.tsx
import { unstable_cache } from 'next/cache';

// Cache course list for 5 minutes
const getCourses = unstable_cache(
  async () => {
    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return data;
  },
  ['courses-list'],
  {
    revalidate: 300, // 5 minutes
    tags: ['courses'],
  }
);

export default async function CoursesPage() {
  const courses = await getCourses();
  
  return (
    <div>
      {/* Pre-rendered content, no client-side fetch needed */}
      {courses?.map(course => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
```

### 5. **Request Batching**

```typescript
// hooks/use-batch-query.ts
import { useQueries } from '@tanstack/react-query';

export function useBatchedUserData(userId: string) {
  const results = useQueries({
    queries: [
      {
        queryKey: ['profile', userId],
        queryFn: () => fetchProfile(userId),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ['courses', userId],
        queryFn: () => fetchUserCourses(userId),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ['matches', userId],
        queryFn: () => fetchUserMatches(userId),
        staleTime: 5 * 60 * 1000,
      },
    ],
  });

  return {
    profile: results[0].data,
    courses: results[1].data,
    matches: results[2].data,
    isLoading: results.some(r => r.isLoading),
  };
}
```

### 6. **Redis Cache Layer**

```javascript
// lib/redis-cache.js
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getCachedOrFetch(
  key: string,
  fetcher: () => Promise<any>,
  ttl: number = 300 // 5 minutes default
) {
  // Try cache first
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch and cache
  const data = await fetcher();
  await redis.set(key, JSON.stringify(data), 'EX', ttl);
  return data;
}

// API Route example
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  const data = await getCachedOrFetch(
    `user:${userId}`,
    async () => {
      // Expensive database query
      return await fetchUserData(userId);
    }
  );
  
  return NextResponse.json(data);
}
```

### 7. **Load Balancing với PM2**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'matching-ptit',
    script: 'npm',
    args: 'start',
    instances: 4, // Run 4 instances
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
  }],
};
```

### 8. **Rate Limiting**

```typescript
// middleware.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '60 s'), // 100 requests per minute
});

export async function middleware(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1';
  const { success, limit, reset, remaining } = await ratelimit.limit(ip);
  
  if (!success) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(reset).toISOString(),
      },
    });
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

## 📈 Kết quả mong đợi với 20+ users

### Trước tối ưu:
- **Response time:** 3-5s per request
- **Concurrent users:** Max 5-10
- **Database connections:** 20+ per user
- **Server load:** 80-90% CPU

### Sau tối ưu:
- **Response time:** <500ms ✅
- **Concurrent users:** 100+ ✅
- **Database connections:** 2-3 per user ✅
- **Server load:** 20-30% CPU ✅

## 🚀 Deployment với Vercel Edge

```javascript
// vercel.json
{
  "functions": {
    "app/api/*": {
      "runtime": "edge",
      "maxDuration": 10
    }
  },
  "crons": [{
    "path": "/api/cron/refresh-cache",
    "schedule": "*/5 * * * *"
  }]
}
```

## 🔍 Monitoring với Datadog/New Relic

```javascript
// lib/monitoring.ts
import { init } from '@datadog/browser-rum';

init({
  applicationId: process.env.NEXT_PUBLIC_DD_APP_ID,
  clientToken: process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN,
  site: 'datadoghq.com',
  service: 'matching-ptit',
  env: process.env.NODE_ENV,
  trackUserInteractions: true,
  defaultPrivacyLevel: 'mask-user-input'
});

// Track custom metrics
export function trackApiCall(endpoint: string, duration: number) {
  if (typeof window !== 'undefined') {
    window.DD_RUM?.addAction('api_call', {
      endpoint,
      duration,
      timestamp: Date.now(),
    });
  }
}
```

## ⚡ Quick Wins ngay lập tức

### 1. Enable Supabase Connection Pooling
```bash
# In Supabase Dashboard
Settings > Database > Connection Pooling > Enable
Pool Mode: Session
Pool Size: 25
```

### 2. Add Database Indexes
```sql
-- Run in Supabase SQL Editor
CREATE INDEX CONCURRENTLY idx_profiles_role ON profiles(role);
CREATE INDEX CONCURRENTLY idx_user_courses_compound ON user_courses(user_id, course_id);
CREATE INDEX CONCURRENTLY idx_courses_active_level ON courses(is_active, level);
```

### 3. Enable Vercel Edge Caching
```javascript
// next.config.js
module.exports = {
  // ... existing config
  headers: async () => [
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, s-maxage=60, stale-while-revalidate=300',
        },
      ],
    },
  ],
};
```

## 💰 Chi phí ước tính

### Cho 20-50 users:
- **Supabase:** Free tier đủ dùng
- **Vercel:** Free tier (100GB bandwidth)
- **Total:** $0/month

### Cho 100-500 users:
- **Supabase Pro:** $25/month
- **Vercel Pro:** $20/month
- **Redis (Upstash):** $10/month
- **Total:** ~$55/month

### Cho 1000+ users:
- **Supabase Team:** $599/month
- **Vercel Enterprise:** Custom pricing
- **Redis cluster:** $200/month
- **CDN (Cloudflare):** $20/month
- **Total:** ~$850+/month

## ✅ Action Items

1. **Ngay lập tức:** Apply AuthProvider + QueryProvider
2. **Trong 24h:** Add database indexes
3. **Trong tuần:** Setup Redis caching
4. **Trong tháng:** Implement SSR/ISR for static pages
5. **Khi cần scale:** Add load balancer + CDN
