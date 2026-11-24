import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Dev only: lets a phone on the LAN open the dev server (pairing a device, see apps/koplugin/README.md).
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*', '*.local'],
  cacheComponents: true,
  // Devices moved into the settings page.
  redirects: async () => [
    {
      source: '/:lang(en|fr)/dashboard/devices',
      destination: '/:lang/dashboard/settings#devices',
      permanent: true,
    },
  ],
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
}

export default nextConfig
