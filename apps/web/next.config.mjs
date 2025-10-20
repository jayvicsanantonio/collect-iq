/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // Configure allowed image domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.pokemontcg.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.execute-api.us-east-1.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
        pathname: '/**',
      },
    ],
  },
  // Ensure environment variables are available at build time
  env: {
    NEXT_PUBLIC_AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION,
    NEXT_PUBLIC_COGNITO_USER_POOL_ID:
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
    NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID:
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID,
    NEXT_PUBLIC_COGNITO_DOMAIN:
      process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
    NEXT_PUBLIC_OAUTH_REDIRECT_URI:
      process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI,
    NEXT_PUBLIC_OAUTH_LOGOUT_URI:
      process.env.NEXT_PUBLIC_OAUTH_LOGOUT_URI,
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
  },
};

export default nextConfig;
