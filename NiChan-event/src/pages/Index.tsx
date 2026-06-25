import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppendRole } from "@/hooks/useAppendRole";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Star, Users, ChevronRight } from "lucide-react";
import SectionHeading from "@/components/ui/section-heading";
import heroImg from "@/assets/hero-wedding.jpg";
import {
  getPortfolioItems,
  getPublicServices,
  getStats,
  getTestimonials,
  type PublicPortfolioItem,
  type PublicService,
  type PublicStat,
  type PublicTestimonial,
} from "@/services/api";

const formatNumber = (value: number | string) => {
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  return value;
};

const fallbackPortfolioImage = heroImg;

const defaultStats: PublicStat[] = [
  { number: "500+", label: "Sự kiện thành công" },
  { number: "12+", label: "Năm kinh nghiệm" },
  { number: "98%", label: "Khách hàng hài lòng" },
  { number: "50+", label: "Đối tác tin cậy" },
];

const Index = () => {
  const appendRole = useAppendRole();
  const [services, setServices] = useState<PublicService[]>([]);
  const [stats, setStats] = useState<PublicStat[]>(defaultStats);
  const [testimonials, setTestimonials] = useState<PublicTestimonial[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PublicPortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [servicesData, statsData, testimonialsData, portfolioData] = await Promise.all([
          getPublicServices(),
          getStats(),
          getTestimonials(),
          getPortfolioItems(),
        ]);

        if (cancelled) return;
        setServices(servicesData.slice(0, 6));
        setStats(statsData.length > 0 ? statsData : defaultStats);
        setTestimonials(testimonialsData.slice(0, 3));
        setPortfolioItems(portfolioData.slice(0, 3));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Không thể tải dữ liệu trang chủ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="NiChan Events" className="w-full h-full object-cover" width={1920} height={1080} />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(135deg, hsl(var(--surface) / 0.85), hsl(var(--surface) / 0.4))" }}
          />
        </div>

        <div className="container mx-auto px-6 relative z-10 pt-24">
          <div className="max-w-3xl">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="tracking-editorial text-label-md text-primary font-body font-semibold mb-6 block"
            >
              NiChan Events
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="font-serif text-display-lg md:text-[4.5rem] leading-[1.05] text-foreground mb-8"
            >
              Biến mọi khoảnh khắc thành{" "}
              <span className="text-primary italic">kỷ niệm vĩnh cửu</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="font-body text-lg text-muted-foreground leading-relaxed mb-10 max-w-xl"
            >
              Chúng tôi tạo nên những sự kiện đẹp như tranh vẽ, từ tiệc cưới lãng mạn đến gala dinner sang trọng.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex flex-wrap gap-4"
            >
              <Link to={appendRole("/lien-he")}>
                <Button variant="hero" size="lg" className="text-base px-8 py-6">
                  Bắt đầu câu chuyện của bạn <ArrowRight size={18} />
                </Button>
              </Link>
              <Link to={appendRole("/portfolio")}>
                <Button variant="tertiary" size="lg" className="text-base px-8 py-6">
                  Xem Portfolio
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-surface-low">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <span className="font-serif text-display-sm md:text-display-md text-primary font-bold block">{stat.number}</span>
                <span className="font-body text-muted-foreground text-sm mt-2 block">{stat.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-6">
          <SectionHeading
            label="Dịch vụ của chúng tôi"
            title="Mỗi sự kiện, một tuyệt tác"
            subtitle="Từ lễ cưới thơ mộng đến hội nghị đẳng cấp, chúng tôi mang đến trải nghiệm không thể quên."
          />

          {loading && <p className="font-body text-muted-foreground">Đang tải dịch vụ...</p>}
          {error && <p className="font-body text-destructive">{error}</p>}

          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.map((service, i) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                >
                  <Link to={appendRole(`/dich-vu/${service.slug}`)} className="group block">
                    <div className="relative overflow-hidden rounded-xl shadow-ambient">
                      <div className="aspect-[16/10] overflow-hidden">
                        <img
                          src={service.coverImageUrl || heroImg}
                          alt={service.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <div
                        className="absolute inset-0 flex flex-col justify-end p-8"
                        style={{ background: "linear-gradient(to top, hsl(var(--on-surface) / 0.7), transparent)" }}
                      >
                        <h3 className="font-serif text-headline-lg text-primary-foreground mb-1">{service.title}</h3>
                        <p className="font-body text-primary-foreground/80 text-sm">{service.shortDescription}</p>
                        <span className="mt-3 inline-flex items-center gap-1 text-primary-foreground/90 font-body text-sm group-hover:gap-2 transition-all">
                          Khám phá <ChevronRight size={14} />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}

          {!loading && !error && (
            <div className="text-center mt-12">
              <Link to={appendRole("/dich-vu")}>
                <Button variant="tertiary" size="lg">
                  Xem tất cả dịch vụ <ArrowRight size={16} />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="py-24 bg-surface-low">
        <div className="container mx-auto px-6">
          <SectionHeading
            label="Portfolio"
            title="Câu chuyện qua từng sự kiện"
            subtitle="Những khoảnh khắc đẹp nhất mà chúng tôi đã tạo nên cùng khách hàng."
          />

          {loading && <p className="font-body text-muted-foreground">Đang tải portfolio...</p>}

          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {portfolioItems.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="group"
                >
                  <Link to={appendRole(`/portfolio/${item.slug}`)} className="block h-full">
                    <div className="h-full bg-surface-lowest rounded-xl overflow-hidden shadow-ambient hover:shadow-ambient-lg transition-shadow duration-500 cursor-pointer">
                      <div className="aspect-[4/3] overflow-hidden">
                        <img
                          src={item.coverImageUrl || fallbackPortfolioImage}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-6">
                        <span className="tracking-editorial text-label-md text-primary font-body text-xs">{item.category}</span>
                        <h3 className="font-serif text-headline-md text-foreground mt-2 mb-2">{item.title}</h3>
                        <div className="flex items-center gap-4 text-muted-foreground font-body text-sm">
                          <span className="flex items-center gap-1"><Users size={14} /> {formatNumber(item.guestCount ?? 0)} khách</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <Link to={appendRole("/portfolio")}>
              <Button variant="tertiary" size="lg">
                Xem tất cả dự án <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-6">
          <SectionHeading
            label="Khách hàng nói gì"
            title="Lời tri ân từ trái tim"
          />

          {loading && <p className="font-body text-muted-foreground">Đang tải đánh giá...</p>}

          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="bg-surface-lowest rounded-xl p-8 shadow-ambient"
                >
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: item.rating }).map((_, j) => (
                      <Star key={j} size={16} className="text-primary fill-primary" />
                    ))}
                  </div>
                  <p className="font-body text-foreground leading-relaxed mb-6 italic">"{item.content}"</p>
                  <div>
                    <p className="font-serif font-semibold text-foreground">{item.customerName}</p>
                    <p className="font-body text-sm text-muted-foreground">{item.roleText}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-24 bg-surface-low">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-serif text-display-sm md:text-display-md text-foreground mb-6">
              Sẵn sàng tạo nên
              <br />
              <span className="text-primary italic">câu chuyện của riêng bạn?</span>
            </h2>
            <p className="font-body text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              Hãy để chúng tôi lắng nghe ý tưởng của bạn và biến nó thành hiện thực.
            </p>
            <Link to={appendRole("/lien-he")}>
              <Button variant="hero" size="lg" className="text-base px-10 py-6">
                Gửi yêu cầu báo giá <ArrowRight size={18} />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Index;
