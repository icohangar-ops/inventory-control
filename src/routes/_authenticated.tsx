import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login", replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }
  if (!isAuthenticated) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">Redirecting…</div>;
  }
  return <AppShell />;
}