import { motion } from "framer-motion";

interface SectionHeadingProps {
  label?: string;
  title: string;
  subtitle?: string;
  className?: string;
  align?: "left" | "center";
}

const SectionHeading = ({ label, title, subtitle, className = "", align = "center" }: SectionHeadingProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={`${align === "center" ? "text-center" : "text-left"} mb-16 ${className}`}
    >
      {label && (
        <span className="tracking-editorial text-label-md text-primary font-body font-semibold mb-4 block">
          {label}
        </span>
      )}
      <h2 className="font-serif text-display-sm md:text-display-md text-foreground mb-4">
        {title}
      </h2>
      {subtitle && (
        <p className="text-muted-foreground font-body max-w-2xl mx-auto text-lg leading-relaxed">
          {subtitle}
        </p>
      )}
    </motion.div>
  );
};

export default SectionHeading;
