/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb' // Tăng limit cho PDF lớn
    }
  },
  api: {
    bodyParser: {
      sizeLimit: '50mb'
    }
  }
};

module.exports = nextConfig;


