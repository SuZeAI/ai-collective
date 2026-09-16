import { motion } from "framer-motion";

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  index,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="glass-card p-5 flex items-start justify-between gap-3"
    >
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 truncate">
          {label}
        </p>
        <p className="text-2xl font-bold tracking-tight">{value || "—"}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1 truncate">{sub}</p>}
      </div>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: `${color}22` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
    </motion.div>
  );
}
