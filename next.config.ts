import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // ضع true للإنتاج إذا أردت اكتشاف الأخطاء بدقة
  eslint: {
    ignoreDuringBuilds: true, // يسمح بالتجميع حتى لو كان هناك تحذيرات/أخطاء ESLint
  },
  images: {
    remotePatterns: [
      // أي فرع فرعي على vercel.app
      {
        protocol: "https",
        hostname: "*.vercel.app",
      },
      // Liara storage
      {
        protocol: "https",
        hostname: "storage.c2.liara.space",
        port: "",
        pathname: "/tlgrm/**",
      },
      // Cloudinary (مثال على نطاق عام)
      {
        protocol: "https",
        hostname: "*.cloudinary.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  // يمكن إضافة أي إعدادات أخرى هنا مثل rewrites أو headers
};

export default nextConfig;
