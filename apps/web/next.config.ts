import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@tapebox/shared', '@tapebox/fork'],
  // Only the faucet route touches @tapebox/fork; keep its process helpers out of the bundle.
  serverExternalPackages: ['execa'],
  // shared/ and fork/ import './x.js' for files that are really './x.ts'. Webpack maps that with
  // extensionAlias; Turbopack cannot yet, so dev and build run with --webpack.
  webpack(cfg) {
    cfg.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };
    return cfg;
  },
};

export default config;
