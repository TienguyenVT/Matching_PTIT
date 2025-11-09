/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better debugging
  reactStrictMode: true,
  
  // Optimize images
  images: {
    domains: [
      'localhost',
      process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '') || '',
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Optimize bundle size
  webpack: (config, { isServer }) => {
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
};

module.exports = nextConfig;
