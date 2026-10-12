"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { Revision } from "@/components/jurisprudencia/revision";
import { useAdminWio } from "@/components/jurisprudencia/use-admin-wio";

export default function RevisionPage() {
  const { id } = useParams<{ id: string }>();
  const esAdmin = useAdminWio();
  const router = useRouter();

  useEffect(() => {
    if (esAdmin === false) router.push("/dashboard");
  }, [esAdmin, router]);

  if (!esAdmin) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Revision id={id} />
    </div>
  );
}
