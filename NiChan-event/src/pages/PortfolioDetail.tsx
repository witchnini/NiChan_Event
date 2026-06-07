import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Calendar, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-wedding.jpg";
import { normalizeRichTextInput } from "@/lib/richText";
import { getPortfolioItems, getPortfolioBySlug, type PublicPortfolioItem } from "@/services/api";

const formatMonthYear = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  return new Date(value).toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric" });
};

const PortfolioDetail = () => {
  const { slug } = useParams();
  const [project, setProject] = useState<PublicPortfolioItem | null>(null);
  const [otherProjects, setOtherProjects] = useState<PublicPortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [current, allItems] = await Promise.all([
          getPortfolioBySlug(slug!).catch(() => null),
          getPortfolioItems(),
        ]);
        if (cancelled) return;

        setProject(current);
        setOtherProjects(allItems.filter((item) => item.slug !== slug).slice(0, 3));
        if (!current) setError("Không tìm thấy dự án phù hợp từ backend.");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải chi tiết portfolio");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const contentHtml = useMemo(() => (project?.content ? normalizeRichTextInput(project.content) : ""), [project?.content]);

  if (loading) {
    return <div className="min-h-screen pt-24 flex items-center justify-center font-body text-muted-foreground">Đang tải chi tiết portfolio...</div>;
  }

  if (error || !project) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-headline-lg text-foreground mb-4">Không tìm thấy dự án</h1>
          <p className="font-body text-muted-foreground mb-6">{error}</p>
          <Link to="/portfolio">
            <Button variant="hero">Quay lại Portfolio</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24">
      <section className="relative h-[60vh] overflow-hidden">
        <img src={project.coverImageUrl || heroImg} alt={project.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16">
          <div className="container mx-auto">
            <Link to="/portfolio" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 font-body text-sm transition-colors">
              <ArrowLeft size={16} /> Quay lại Portfolio
            </Link>
            <span className="block px-3 py-1 rounded-lg bg-white/20 backdrop-blur-sm font-body text-xs font-semibold text-white w-fit mb-3">{project.category}</span>
            <h1 className="font-serif text-3xl md:text-5xl text-white mb-4">{project.title}</h1>
            <div className="flex flex-wrap items-center gap-6 text-white/80 text-sm font-body">
              <span className="flex items-center gap-2"><Users size={16} /> {project.guestCount ?? 0} khách</span>
              <span className="flex items-center gap-2"><Calendar size={16} /> {formatMonthYear(project.publishedAt)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-10">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="font-serif text-headline-lg text-foreground mb-4">Về dự án</h2>
                {contentHtml ? (
                  <div className="rich-text-content text-lg leading-[1.8]" dangerouslySetInnerHTML={{ __html: contentHtml }} />
                ) : (
                  <p className="font-body text-muted-foreground leading-relaxed">
                    Nội dung chi tiết của portfolio này đang chờ cập nhật.
                  </p>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <h2 className="font-serif text-headline-lg text-foreground mb-6">Hình ảnh sự kiện</h2>
                <div className="grid grid-cols-1 gap-4">
                  <div className="aspect-[16/9] rounded-xl overflow-hidden">
                    <img src={project.coverImageUrl || heroImg} alt={project.title} className="w-full h-full object-cover" />
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="space-y-8">
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-surface-low rounded-2xl p-6">
                <h3 className="font-serif text-headline-md text-foreground mb-4">Thông tin dự án</h3>
                <div className="space-y-4 font-body text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Loại sự kiện</span><span className="text-foreground font-medium">{project.category}</span></div>
                  <div className="border-t border-border" />
                  <div className="flex justify-between"><span className="text-muted-foreground">Số khách</span><span className="text-foreground font-medium">{project.guestCount ?? 0}</span></div>
                  <div className="border-t border-border" />
                  <div className="flex justify-between"><span className="text-muted-foreground">Ngày đăng</span><span className="text-foreground font-medium">{formatMonthYear(project.publishedAt)}</span></div>
                  <div className="border-t border-border" />
                  <div className="flex justify-between"><span className="text-muted-foreground">Lượt xem</span><span className="text-foreground font-medium">{project.viewCount}</span></div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-surface-low rounded-2xl p-6">
                <h3 className="font-serif text-headline-md text-foreground mb-4">Ghi chú</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 font-body text-sm text-foreground">
                    <CheckCircle2 size={16} className="text-primary shrink-0" /> Dữ liệu được lấy từ endpoint công khai /api/public/portfolio
                  </li>
                  <li className="flex items-center gap-3 font-body text-sm text-foreground">
                    <CheckCircle2 size={16} className="text-primary shrink-0" /> Nội dung chính được quản lý từ trang admin
                  </li>
                </ul>
              </motion.div>

              <Link to="/lien-he">
                <Button variant="hero" className="w-full">Liên hệ tư vấn</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-surface-low">
        <div className="container mx-auto px-6">
          <h2 className="font-serif text-headline-lg text-foreground text-center mb-10">Dự án khác</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {otherProjects.map((item) => (
              <Link key={item.id} to={`/portfolio/${item.slug}`} className="group">
                <div className="bg-surface-lowest rounded-xl overflow-hidden shadow-ambient hover:shadow-ambient-lg transition-all duration-500">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img src={item.coverImageUrl || heroImg} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  </div>
                  <div className="p-5">
                    <span className="font-body text-xs text-primary font-semibold">{item.category}</span>
                    <h3 className="font-serif text-headline-sm text-foreground mt-1">{item.title}</h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default PortfolioDetail;
