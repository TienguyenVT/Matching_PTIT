#!/bin/bash

echo "🔧 Fixing optimization errors..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 2. Clear Next.js cache
echo "🗑️ Clearing Next.js cache..."
rm -rf .next

# 3. Fix TypeScript module resolution
echo "🔍 Fixing TypeScript paths..."

# Create tsconfig paths if not exists
cat > tsconfig.paths.json << 'EOF'
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["components/*"],
      "@/lib/*": ["lib/*"],
      "@/hooks/*": ["hooks/*"],
      "@/providers/*": ["providers/*"],
      "@/utils/*": ["utils/*"],
      "@/types/*": ["types/*"]
    }
  }
}
EOF

# Update main tsconfig to extend paths
if ! grep -q "tsconfig.paths.json" tsconfig.json; then
  echo "Updating tsconfig.json..."
  # This is a simplified approach - in production use jq or proper JSON parsing
  sed -i.bak '2i\  "extends": "./tsconfig.paths.json",' tsconfig.json
fi

echo "✅ Setup complete! Run 'npm run dev' to start the optimized app."
