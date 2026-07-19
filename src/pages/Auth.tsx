import { Button } from "@/components/ui/button";

import { useAuth } from "@/hooks/use-auth";
import { Chrome, HeartHandshake, Loader2, Radar, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router";

function Auth() {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/apoiar");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("google", { redirectTo: "/apoiar" });
    } catch (error) {
      console.error("Google sign-in error:", error);
      setError("Falha ao entrar com Google. Tente novamente.");
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate("/apoiar");
    } catch (error) {
      console.error("Guest login error:", error);
      setError("Falha ao entrar como convidado.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl">
        <nav className="glass-panel rounded-2xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3" onClick={() => navigate("/")}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/30 to-rose-500/30 flex items-center justify-center cursor-pointer">
              <Radar className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm tracking-tight">
              Sentinela<span className="gradient-text">Global</span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="text-muted-foreground"
          >
            Início
          </Button>
        </nav>
      </header>

      {/* ── Auth Content ── */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[400px]">
          <div className="glass-card rounded-3xl overflow-hidden">
            {/* Header */}
            <div className="text-center pt-10 pb-6 px-8">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-purple-500/20 flex items-center justify-center">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/30 to-rose-500/30 flex items-center justify-center cursor-pointer" onClick={() => navigate("/")}>
                    <Radar className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">
                Apoie o SentinelaGlobal
              </h1>
              <p className="text-sm text-muted-foreground">
                Entre para contribuir com o projeto e ajudar a manter o monitoramento gratuito para todos.
              </p>
            </div>

            <div className="px-8 pb-8 space-y-3">
              {/* Google Login */}
              <Button
                type="button"
                variant="outline"
                className="w-full border-border/50 bg-background/30 backdrop-blur-sm hover:bg-background/50 h-12"
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Chrome className="mr-2 h-4 w-4" />
                )}
                Entrar com Google
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Ou
                  </span>
                </div>
              </div>

              {/* Guest Login */}
              <Button
                type="button"
                variant="outline"
                className="w-full border-border/50 bg-background/30 backdrop-blur-sm hover:bg-background/50"
                onClick={handleGuestLogin}
                disabled={isLoading}
              >
                <UserX className="mr-2 h-4 w-4" />
                Entrar como convidado
              </Button>

              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}
            </div>

            {/* PIX Quick Info */}
            <div className="px-8 pb-8">
              <div className="glass-subtle rounded-xl px-4 py-3 flex items-center gap-3">
                <HeartHandshake className="h-5 w-5 text-rose-400 shrink-0" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Sua contribuição via PIX ajuda a manter os servidores, APIs e o desenvolvimento contínuo do sistema.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="glass-subtle rounded-2xl px-6 py-3 mt-4 text-xs text-center text-muted-foreground">
            <button
              onClick={() => navigate("/")}
              className="underline hover:text-foreground transition-colors"
            >
              Voltar para o início
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <Auth />
    </Suspense>
  );
}
