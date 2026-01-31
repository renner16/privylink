"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RefundPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/deposits?tab=expired");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <div className="text-center">
        <div className="spinner mx-auto mb-4" style={{ width: "2rem", height: "2rem" }} />
        <p className="text-muted">Redirecting to deposits...</p>
      </div>
    </div>
  );
}
