# 📝 Hướng dẫn Update Components

## ❌ **Code CŨ (gây duplicate calls):**
```tsx
// Mỗi component đều gọi riêng
useEffect(() => {
  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
  };
  getUser();
}, []);
```

## ✅ **Code MỚI (dùng global state):**
```tsx
import { useAuth } from '@/providers/auth-provider';

export default function Component() {
  const { user, profile, role } = useAuth();
  // Không cần gọi API, data có sẵn!
}
```

## 📋 Files cần update:

### 1. **components/layout/Header.tsx**
```tsx
// OLD
const [user, setUser] = useState(null);
useEffect(() => {
  supabase.auth.getUser().then(...)
}, []);

// NEW  
import { useAuth } from '@/providers/auth-provider';
const { user, role } = useAuth();
```

### 2. **components/layout/Sidebar.tsx**
```tsx
// OLD
const [isAdmin, setIsAdmin] = useState(false);
useEffect(() => {
  getUserRole(...).then(...)
}, []);

// NEW
import { useAuth } from '@/providers/auth-provider';
const { role } = useAuth();
const isAdmin = role === 'admin';
```

### 3. **app/(main)/home/page.tsx**
```tsx
// OLD
useEffect(() => {
  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    // Multiple API calls...
  };
}, []);

// NEW
import { useAuth } from '@/providers/auth-provider';
import { useCourses } from '@/hooks/use-courses';

const { user, profile } = useAuth();
const { data: courses } = useCourses();
```

### 4. **app/(main)/admin/page.tsx**
```tsx
// OLD
await requireAdminAccess(supabase);

// NEW
import { withAuth } from '@/providers/auth-provider';

export default withAuth(AdminPage, { requireAdmin: true });
```

### 5. **app/(main)/profile/page.tsx**
```tsx
// OLD
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase.from('profiles')...

// NEW
const { user, profile, refreshProfile } = useAuth();
// Update profile
await updateProfile(...);
await refreshProfile(); // Refresh cache
```

## 🔄 Migration Script

```bash
# Run this to update all components
npx tsx update-components.ts
```

```typescript
// update-components.ts
import fs from 'fs';
import path from 'path';

const filesToUpdate = [
  'components/layout/Header.tsx',
  'components/layout/Sidebar.tsx', 
  'app/(main)/home/page.tsx',
  'app/(main)/admin/page.tsx',
  'app/(main)/profile/page.tsx',
  'app/(main)/courses/page.tsx',
  'app/(main)/community/page.tsx',
  'app/(main)/study-profile/page.tsx',
];

filesToUpdate.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Add import
  if (!content.includes('@/providers/auth-provider')) {
    content = `import { useAuth } from '@/providers/auth-provider';\n` + content;
  }
  
  // Replace patterns
  content = content
    .replace(/supabase\.auth\.getUser\(\)/g, '// Replaced with useAuth()')
    .replace(/await.*getUserRole.*\n/g, '// Replaced with useAuth()\n')
    .replace(/const.*\s*=\s*await.*profiles.*select/g, '// Replaced with useAuth()');
    
  fs.writeFileSync(filePath, content);
  console.log(`✅ Updated ${file}`);
});
```

## ⚡ Performance Impact

### Before (45 requests):
- 3x `auth.getUser()` 
- 5x `profiles` queries
- 2x `user_courses` queries
- Total: **~10 API calls per page**

### After (với global state):
- 1x `auth.getUser()` (on app load)
- 1x `profiles` query (cached)
- 0x duplicate queries
- Total: **2 API calls for entire session**

## 🎯 Result: **80% reduction in API calls!**
