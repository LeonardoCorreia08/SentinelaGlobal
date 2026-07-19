import { motion } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  Gift,
  HeartHandshake,
  Loader2,
  QrCode,
  Radar,
  Sparkles,
  Check,
  Coffee,
  Rocket,
  Star,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

const CHAVE_PIX = "f720913e-1c46-4016-85b1-0e4805c28fab";

const valoresSugeridos = [
  { icon: Coffee, label: "Café", valor: "R$ 5" },
  { icon: Gift, label: "Apoiador", valor: "R$ 10" },
  { icon: Star, label: "Destaque", valor: "R$ 25" },
  { icon: Rocket, label: "Impulsionar", valor: "R$ 50" },
];

export default function Apoiar() {
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [copiado, setCopiado] = useState(false);

  // Auth guard — redireciona para /auth se não logado
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(CHAVE_PIX);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = CHAVE_PIX;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col"
    >
      {/* ── Navigation ── */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl">
        <nav className="glass-panel rounded-2xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/30 to-rose-500/30 flex items-center justify-center">
              <Radar className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm tracking-tight">
              Sentinela<span className="gradient-text">Global</span>
            </span>
          </div>
          <button
            onClick={() => navigate("/")}
            className="glass-button rounded-lg px-4 py-1.5 text-sm font-medium flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        </nav>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pt-28 pb-16">
        <div className="max-w-2xl w-full mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="glass-card rounded-3xl p-8 md:p-12 text-center relative overflow-hidden"
          >
            {/* Decorative glow */}
            <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-rose-500/8 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-indigo-500/8 blur-3xl pointer-events-none" />

            {/* Header */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-subtle text-xs font-medium text-muted-foreground mb-6"
            >
              <HeartHandshake className="h-3.5 w-3.5 text-rose-400" />
              Contribua com o projeto
            </motion.div>

            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Apoie o{" "}
              <span className="gradient-text">SentinelaGlobal</span>
            </h1>

            <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto mb-8 leading-relaxed">
              O SentinelaGlobal é um sistema gratuito de monitoramento de riscos que
              analisa dados de agências mundiais (USGS, GDACS, NASA, Cemaden) com IA
              generativa para alertar você sobre desastres naturais próximos.
            </p>

            <p className="text-muted-foreground text-xs max-w-md mx-auto mb-8 leading-relaxed">
              Sua contribuição ajuda a manter os servidores, APIs externas e o
              desenvolvimento contínuo de novas funcionalidades. Todo valor é bem-vindo!
            </p>

            {/* Suggested values */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {valoresSugeridos.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="glass-subtle rounded-xl p-4 text-center hover:glass-panel transition-all duration-300 group cursor-default"
                  >
                    <Icon className="h-5 w-5 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      {item.label}
                    </p>
                    <p className="text-lg font-bold">{item.valor}</p>
                  </div>
                );
              })}
            </div>

            {/* Divider */}
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/40" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground">
                  Escaneie o QR Code com seu banco
                </span>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="glass-subtle rounded-2xl p-3 inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(CHAVE_PIX)}`}
                  alt="QR Code PIX"
                  className="rounded-xl"
                  width={220}
                  height={220}
                />
              </div>

              {/* PIX Key */}
              <div className="glass-subtle rounded-xl px-5 py-3 flex items-center gap-3 w-full max-w-md">
                <QrCode className="h-5 w-5 text-primary shrink-0" />
                <code className="text-xs font-mono text-muted-foreground break-all flex-1 text-left">
                  {CHAVE_PIX}
                </code>
                <button
                  onClick={handleCopiar}
                  className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 ${
                    copiado
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                  }`}
                >
                  {copiado ? (
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3" /> Copiado!
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Copy className="h-3 w-3" /> Copiar
                    </span>
                  )}
                </button>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              PIX copia e cola · Chave aleatória (UUID) · Qualquer valor
            </p>

            {/* Footer note */}
            <div className="mt-8 pt-6 border-t border-border/20">
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                SentinelaGlobal © 2026 — Gratuito para todos
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="pb-6 px-4">
        <div className="max-w-2xl mx-auto glass-subtle rounded-2xl px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>© 2026 SentinelaGlobal</span>
          <button
            onClick={() => navigate("/")}
            className="underline hover:text-foreground transition-colors"
          >
            Início
          </button>
        </div>
      </footer>
    </motion.div>
  );
}
