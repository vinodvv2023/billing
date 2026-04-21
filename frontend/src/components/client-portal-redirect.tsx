"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

export function ClientPortalRedirect({
  title,
  description,
  target = "/billing",
}: {
  title: string;
  description: string;
  target?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      router.replace(target);
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [router, target]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-6 text-white/64">{description}</CardContent>
    </Card>
  );
}
