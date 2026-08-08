/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Allow the 10 MB file uploads plus multipart boundary overhead.
      // The upload action still enforces its own 10 MB file-size limit.
      bodySizeLimit: '12mb',
    },
  },
}

export default nextConfig
