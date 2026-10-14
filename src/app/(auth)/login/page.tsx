"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Info, Loader2, Lock, Mail } from "lucide-react";

// `useSearchParams` opts the component out of static prerendering
// unless it sits under a Suspense boundary. We split the form into
// a child component so the outer page can prerender the chrome
// (background, card frame) while the form hydrates with the query
// string on the client.
// Supabase answers in English, and "Invalid login credentials" also
// covers an account that exists without a password (invited by email).
function mensajeDeError(mensaje: string): string {
  if (/invalid login credentials/i.test(mensaje)) {
    return "Correo o contraseña incorrectos. Si te invitaron por correo y aún no creaste tu contraseña, usa «¿Olvidaste tu contraseña?».";
  }
  if (/email not confirmed/i.test(mensaje)) {
    return "Aún no confirmaste tu correo. Abre el enlace que te enviamos y vuelve a intentarlo.";
  }
  return mensaje;
}

// Set by /auth/callback when an email link couldn't open the session here.
const AVISOS: Record<string, string> = {
  confirmado: "Tu correo quedó confirmado. Inicia sesión para continuar.",
  enlace: "Ese enlace ya se usó o venció. Inicia sesión o pide uno nuevo.",
  reset: "Abre el enlace en el mismo navegador donde pediste cambiar la contraseña, o pide uno nuevo.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  // Forwarded from `/join/<token>` when the visitor already has an
  // account. After a successful sign-in we send them to the join
  // page to accept rather than to /dashboard.
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(mensajeDeError(error.message));
      setLoading(false);
      return;
    }

    if (inviteToken) {
      router.push(`/join/${encodeURIComponent(inviteToken)}`);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Animated Mesh Gradient Background Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[20%] -left-[10%] h-[550px] w-[550px] rounded-full bg-primary/20 blur-[130px] animate-pulse duration-1000" />
        <div className="absolute -bottom-[20%] -right-[10%] h-[550px] w-[550px] rounded-full bg-primary/15 blur-[140px] animate-pulse duration-700" />
        <div className="absolute top-[35%] right-[25%] h-[320px] w-[320px] rounded-full bg-violet-500/10 blur-[110px]" />
      </div>

      {/* Glass Card */}
      <Card className="relative z-10 w-full max-w-md rounded-3xl border border-border/80 bg-card/80 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-200">
        <CardHeader className="items-center text-center pb-4">
          <div className="mb-4 flex items-center justify-center">
            <div className="group relative flex items-center justify-center">
              <div className="absolute -inset-2 rounded-2xl bg-primary/25 opacity-60 blur-md transition-all duration-300 group-hover:opacity-100 group-hover:scale-105" />
              <img
                src="/logo.png"
                alt="Wio CRM"
                className="relative h-16 w-auto rounded-xl object-contain shadow-sm transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {inviteToken ? "Inicia sesión para aceptar" : "Bienvenido de nuevo"}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {inviteToken
              ? "Inicia sesión y te llevaremos a tu invitación pendiente."
              : "Ingresa tus credenciales para acceder al panel"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {!error && AVISOS[searchParams.get("aviso") ?? ""] && (
              <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-sm text-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="flex-1 leading-snug">
                  {AVISOS[searchParams.get("aviso") ?? ""]}
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="flex-1 leading-snug">
                  {error}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Correo Electrónico
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 rounded-xl border-border bg-muted/50 pl-10 text-foreground placeholder:text-muted-foreground/50 transition-all focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Contraseña
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline hover:text-primary/80"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 rounded-xl border-border bg-muted/50 pl-10 text-foreground placeholder:text-muted-foreground/50 transition-all focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <span>Iniciar Sesión</span>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿No tienes una cuenta?{" "}
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : "/signup"
              }
              className="font-medium text-primary hover:underline hover:text-primary/80"
            >
              Crear cuenta
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
