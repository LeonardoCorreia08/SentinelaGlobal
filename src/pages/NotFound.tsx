import { motion } from "framer-motion";
import { Home, SearchX } from "lucide-react";
import { useNavigate } from "react-router";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col"
    >
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="glass-card rounded-3xl p-12 md:p-16 text-center max-w-md w-full relative overflow-hidden"
        >
          <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-indigo-500/8 blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <SearchX className="h-7 w-7 text-foreground/70" />
          </div>

          <h1 className="text-6xl font-bold tracking-tight mb-2 gradient-text">
            404
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Página não encontrada
          </p>

          <button
            onClick={() => navigate("/")}
            className="glass-button rounded-xl px-6 py-3 text-sm font-medium inline-flex items-center gap-2 mx-auto"
          >
            <Home className="h-4 w-4" />
            Voltar ao início
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
