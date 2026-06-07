import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Calendar } from "lucide-react";
import { useAppendRole } from "@/hooks/useAppendRole";
import SectionHeading from "@/components/SectionHeading";
import heroImg from "@/assets/hero-wedding.jpg";
import { getPortfolioItems, type PublicPortfolioItem } from "@/services/api";

const formatMonthYear = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  return new Date(value).toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric" });
};

const Portfolio = () => {
  const [active, setActive] = useState("Tất cả");
  const [projects, setProjects] = useState<PublicPortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appendRole = useAppendRole();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getPortfolioItems();
        if (!cancelled) setProjects(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải portfolio");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () => ["Tất cả", ...Array.from(new Set(projects.map((project) => project.category)))],
    [projects],
  );

  const filtered = active === "Tất cả" ? projects : projects.filter((project) => project.category === active);

  return (
    <div className="min-h-screen pt-24">
      <section className="py-16 bg-surface-low">
        <div className="container mx-auto px-6">
          <SectionHeading
            label="Portfolio"
            title="Hành trình sáng tạo"
            subtitle="Mỗi sự kiện là một tác phẩm nghệ thuật, mỗi kỷ niệm là một câu chuyện đáng trân trọng."
          />
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap gap-3 mb-12 justify-center">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`px-5 py-2.5 rounded-xl font-body text-sm transition-all duration-300 ${
                  active === cat ? "gradient-primary text-primary-foreground shadow-ambient" : "bg-surface-low text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading && <p className="font-body text-muted-foreground text-center py-20">Đang tải portfolio...</p>}
          {error && <p className="font-body text-destructive text-center py-20">{error}</p>}

          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filtered.map((project, i) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  layout
                  className="group"
                >
                  <Link to={appendRole(`/portfolio/${project.slug}`)}>
                    <div className="bg-surface-lowest rounded-xl overflow-hidden shadow-ambient hover:shadow-ambient-lg transition-all duration-500 cursor-pointer">
                      <div className="aspect-[4/3] overflow-hidden relative">
                        <img src={project.coverImageUrl || heroImg} alt={project.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                        <div className="absolute top-4 left-4">
                          <span className="px-3 py-1 rounded-lg glass font-body text-xs font-semibold text-foreground">{project.category}</span>
                        </div>
                      </div>
                      <div className="p-6">
                        <h3 className="font-serif text-headline-md text-foreground mb-2">{project.title}</h3>
                        <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-xs font-body">
                          <span className="flex items-center gap-1"><Users size={12} /> {project.guestCount ?? 0} khách</span>
                          <span className="flex items-center gap-1"><Calendar size={12} /> {formatMonthYear(project.publishedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Portfolio;
