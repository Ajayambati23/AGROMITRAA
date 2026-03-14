import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only bundle the icons/components you import (faster compiles + smaller bundles)
  optimizePackageImports: [
    "lucide-react",
    "date-fns",
    "@headlessui/react",
  ],
};

export default nextConfig;
