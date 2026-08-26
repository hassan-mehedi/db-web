import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@db-web/sql", "@db-web/db", "@db-web/bootstrap"],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
