import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

const sentryEnabled = Boolean(process.env.SENTRY_DSN);

export default sentryEnabled
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@sentry/nextjs").withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      disableLogger: true,
    })
  : nextConfig;
