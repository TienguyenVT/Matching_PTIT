/** @type {import('next').NextConfig} */

// Detect environment
const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  // ✅ Only enable React strict mode in development (prevents double renders in prod)
  reactStrictMode: isDev,
  
  // Optimize images
  images: {
    domains: [
      'localhost',
      process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '') || '',
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Optimize bundle size
  webpack: (config, { dev, isServer }) => {
    // ✅ Disable HMR in production to fix WebSocket errors
    if (!dev && !isServer) {
      config.plugins = config.plugins.filter(
        (plugin) => plugin.constructor.name !== 'HotModuleReplacementPlugin'
      );
      // Remove source maps in production
      config.devtool = false;
    }
    
    // Only modify splitChunks, let Next.js handle other optimizations
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          // Common components chunk
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
          // Supabase chunk
          supabase: {
            name: 'supabase',
            test: /[\\/]node_modules[\\/](@supabase)[\\/]/,
            chunks: 'all',
            priority: 30,
          },
          // React Query chunk
          reactQuery: {
            name: 'react-query',
            test: /[\\/]node_modules[\\/](@tanstack)[\\/]/,
            chunks: 'all',
            priority: 25,
          },
        },
      };
    }

    // Alias for smaller lodash imports
    config.resolve.alias = {
      ...config.resolve.alias,
      'lodash': 'lodash-es',
    };

    return config;
  },

  // Experimental features for better performance
  experimental: {
    // Server components optimization
    serverComponentsExternalPackages: ['pdf-parse'],
  },

  // Compress output
  compress: true,

  // Generate source maps only in development
  productionBrowserSourceMaps: false,

  // Trailing slash behavior
  trailingSlash: false,

  // SWC minification (faster than Terser)
  swcMinify: true,
  
  // ✅ Disable powered by header for security
  poweredByHeader: false,
  
  // ✅ Configure CORS headers for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400', // Cache preflight for 24 hours
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
