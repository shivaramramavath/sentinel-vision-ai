import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@sentinel/shared-types'],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/missing-persons',
        destination: '/cases',
        permanent: false,
      },
      {
        source: '/missing-persons/:path*',
        destination: '/cases/:path*',
        permanent: false,
      },
      {
        source: '/search-person',
        destination: '/search',
        permanent: false,
      },
      {
        source: '/sightings',
        destination: '/review',
        permanent: false,
      },
      {
        source: '/verification',
        destination: '/review',
        permanent: false,
      },
      {
        source: '/tracking',
        destination: '/journeys',
        permanent: false,
      },
      {
        source: '/live-cameras',
        destination: '/cameras?view=grid',
        permanent: false,
      },
      {
        source: '/locations/topology',
        destination: '/cameras?mode=topology',
        permanent: false,
      },
      {
        source: '/locations',
        destination: '/cameras?view=map',
        permanent: false,
      },
      {
        source: '/reports',
        destination: '/evidence?tab=reports',
        permanent: false,
      },
      {
        source: '/reports/:path*',
        destination: '/evidence?tab=reports',
        permanent: false,
      },
      {
        source: '/users',
        destination: '/admin/users',
        permanent: false,
      },
      {
        source: '/users/:path*',
        destination: '/admin/users',
        permanent: false,
      },
      {
        source: '/settings',
        destination: '/admin',
        permanent: false,
      },
      {
        source: '/settings/:path*',
        destination: '/admin',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
