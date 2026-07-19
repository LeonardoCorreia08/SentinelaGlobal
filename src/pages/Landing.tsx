import { motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Globe,
  HeartHandshake,
  Loader2,
  Radar,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { useState } from "react";

const features = [
  {
    icon: Radar,
    title: "Monitoramento Contínuo",
    description: "Análise automática com dados REAIS de USGS, GDACS, NASA FIRMS, Cemaden e Open-Meteo a cada 60 segundos.",
    gradient: "from-indigo-500/20 to-rose-500/20",
  },
  {
    icon: Globe,
    title: "Mapa Interativo",
    description: "Visualize eventos de risco próximos à sua localização em tempo real no mapa Leaflet.",
    gradient: "from-teal-500/20 to-cyan-500/20",
  },
  {
    icon: Bell,
    title: "Alertas Inteligentes",
    description: "Notificações críticas quando o risco ultrapassa 80% com análise detalhada gerada por IA.",
    gradient: "from-amber-500/20 to-orange-500/20",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const } },
};

export default function Landing() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [guestLoading, setGuestLoading] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col"
    >
      {/* ── Navigation ── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl"
      >
        <nav className="glass-panel rounded-2xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/30 to-rose-500/30 flex items-center justify-center">
              <Radar className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm tracking-tight">
              Sentinela<span className="gradient-text">Global</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/auth")}
              className="glass-button rounded-lg px-4 py-1.5 text-sm font-medium flex items-center gap-1.5"
            >
              <HeartHandshake className="h-3.5 w-3.5 text-rose-400" />
              Apoiar
            </button>
            <button
              onClick={() => navigate("/apoiar")}
              className="glass-button rounded-lg px-4 py-1.5 text-sm font-medium"
            >
              Entrar
            </button>
          </div>
        </nav>
      </motion.header>

      {/* ── Hero Section ── */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 pt-28 pb-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-5xl w-full mx-auto"
        >
          {/* Hero glass card */}
          <motion.div variants={itemVariants} className="glass-card rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
            {/* Decorative glow orbs */}
            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-indigo-500/8 blur-3xl pointer-events-none" />

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] as const }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-subtle text-xs font-medium text-muted-foreground mb-8"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Monitoramento de Desastres com IA
            </motion.div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Monitore riscos próximos
              <br />
              <span className="gradient-text">em tempo real</span>
            </h1>

            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              Sistema inteligente que analisa dados de agências de desastres
              (USGS, NOAA, INMET) com IA generativa, calcula o nível de ameaça
              e emite alertas visuais quando o risco ultrapassa 80%.
            </p>

            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7, ease: [0.25, 0.1, 0.25, 1] as const }}
            >
              <button
                onClick={async () => {
                  setGuestLoading(true);
                  try {
                    await signIn("anonymous");
                    navigate("/dashboard");
                  } catch {
                    navigate("/auth");
                  }
                  setGuestLoading(false);
                }}
                disabled={guestLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-8 py-3.5 text-base font-medium transition-all duration-200 shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 flex items-center gap-2 disabled:opacity-60"
              >
                {guestLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Iniciar monitoramento
              </button>
              <button
                onClick={async () => {
                  setGuestLoading(true);
                  try {
                    await signIn("anonymous");
                    navigate("/dashboard");
                  } catch {
                    navigate("/dashboard");
                  }
                  setGuestLoading(false);
                }}
                disabled={guestLoading}
                className="glass-button rounded-xl px-8 py-3.5 text-base font-medium disabled:opacity-60"
              >
                Ver demonstração
              </button>
            </motion.div>
          </motion.div>

          {/* ── Feature Cards ── */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.9 + index * 0.1, ease: [0.25, 0.1, 0.25, 1] as const }}
                  className="glass-subtle rounded-2xl p-6 group hover:glass-panel transition-all duration-300 cursor-default"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="h-5 w-5 text-foreground/80" />
                  </div>
                  <h3 className="font-semibold text-base mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* ── Trusted Sources ── */}
          <motion.div
            variants={itemVariants}
            className="glass-subtle rounded-2xl p-6 mt-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Fontes de dados reais
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["USGS", "GDACS", "NASA FIRMS", "Cemaden"].map((fonte) => (
                <div
                  key={fonte}
                  className="glass-button rounded-xl px-4 py-3 text-sm font-medium text-center hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
                >
                  {fonte}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="pb-6 px-4">
        <div className="max-w-5xl mx-auto glass-subtle rounded-2xl px-6 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>© 2026 SentinelaGlobal</span>
          <span className="hidden sm:block">Powered by Groq + Llama 3 — dados reais de USGS, GDACS, NASA, Cemaden</span>
          <a
            href="https://freebuff.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
          >
            freebuff.com
          </a>
        </div>
      </footer>
    </motion.div>
  );
}
