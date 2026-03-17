/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dafdxgtrbtegvbvbwbfc.supabase.co' }
    ]
  }
};
module.exports = nextConfig;
