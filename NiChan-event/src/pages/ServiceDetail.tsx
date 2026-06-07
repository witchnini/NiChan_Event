import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Users, Clock, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-wedding.jpg";
import { normalizeRichTextInput } from "@/lib/richText";
import { getServiceBySlug, type PublicService } from "@/services/api";

const formatCurrencyRange = (priceFrom?: string | number | null, priceTo?: string | number | null) => {
  const formatPrice = (value: string | number) =>
    Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 0 });

  if (priceFrom && priceTo) return `${formatPrice(priceFrom)} - ${formatPrice(priceTo)} VND`;
  if (priceFrom) return `Từ ${formatPrice(priceFrom)} VND`;
  if (priceTo) return `Đến ${formatPrice(priceTo)} VND`;
  return "Liên hệ báo giá";
};

const buildIncludes = (service: PublicService) => [
  `Tư vấn và lên concept cho ${service.title.toLowerCase()}`,
  `Kế hoạch triển khai chi tiết theo nhóm ${service.category.name}`,
  "Điều phối nhân sự và vận hành trong ngày diễn ra sự kiện",
  "Báo giá linh hoạt theo quy mô và nhu cầu thực tế",
];

const buildProcess = () => [
  "Tiếp nhận yêu cầu và tư vấn sơ bộ",
  "Khảo sát, đề xuất concept và ngân sách",
  "Thống nhất phạm vi công việc và timeline",
  "Triển khai sản xuất, setup và điều phối sự kiện",
  "Tổng kết và bàn giao sau chương trình",
];

const ServiceDetail = () => {
  const { slug } = useParams();
  const [service, setService] = useState<PublicService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getServiceBySlug(slug);
        if (!cancelled) setService(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải chi tiết dịch vụ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen pt-24 flex items-center justify-center font-body text-muted-foreground">Đang tải chi tiết dịch vụ...</div>;
  }

  if (error || !service) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-headline-lg text-foreground mb-4">Không tìm thấy dịch vụ</h1>
          <p className="font-body text-muted-foreground mb-6">{error || "Dịch vụ này không tồn tại hoặc chưa được xuất bản."}</p>
          <Link to="/dich-vu">
            <Button variant="hero">Quay lại danh sách dịch vụ</Button>
          </Link>
        </div>
      </div>
    );
  }

  const includes = buildIncludes(service);
  const process = buildProcess();
  const descriptionHtml = normalizeRichTextInput(service.description);

  return (
    <div className="min-h-screen pt-24">
      <section className="relative h-[60vh] overflow-hidden">
        <img src={service.coverImageUrl || heroImg} alt={service.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-end" style={{ background: "linear-gradient(to top, hsl(var(--on-surface) / 0.8), transparent)" }}>
          <div className="container mx-auto px-6 pb-12">
            <Link to="/dich-vu" className="inline-flex items-center gap-2 text-primary-foreground/80 font-body text-sm mb-4 hover:text-primary-foreground transition-colors">
              <ArrowLeft size={16} /> Quay lại dịch vụ
            </Link>
            <h1 className="font-serif text-display-md md:text-display-lg text-primary-foreground">{service.title}</h1>
            <p className="font-body text-primary-foreground/80 text-lg mt-2 max-w-2xl">{service.shortDescription}</p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
            <div className="lg:col-span-2">
              {descriptionHtml && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rich-text-content mb-16 text-lg leading-[1.8]" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
              )}

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="font-serif text-headline-lg text-foreground mb-8">Dịch vụ bao gồm</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {includes.map((item) => (
                    <div key={item} className="flex items-start gap-3 p-4 bg-surface-lowest rounded-xl shadow-ambient">
                      <CheckCircle size={20} className="text-secondary shrink-0 mt-0.5" />
                      <span className="font-body text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-16">
                <h2 className="font-serif text-headline-lg text-foreground mb-8">Quy trình làm việc</h2>
                <div className="space-y-6">
                  {process.map((step, i) => (
                    <div key={step} className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-serif font-bold shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 p-4 bg-surface-low rounded-xl">
                        <span className="font-body text-foreground">{step}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <div>
              <div className="bg-surface-lowest rounded-xl p-8 shadow-ambient-lg sticky top-28">
                <span className="tracking-editorial text-label-md text-primary font-body text-xs block mb-4">Giá tham khảo</span>
                <p className="font-serif text-headline-lg text-foreground mb-6">
                  {formatCurrencyRange(service.priceFrom, service.priceTo)}
                </p>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3 text-muted-foreground font-body text-sm">
                    <Clock size={16} className="text-primary" /> Chuẩn bị linh hoạt theo quy mô sự kiện
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground font-body text-sm">
                    <Users size={16} className="text-primary" /> {service.guestFrom || 0} - {service.guestTo || "N"} khách
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground font-body text-sm">
                    <MapPin size={16} className="text-primary" /> {service.locationText || "Toàn quốc"}
                  </div>
                </div>

                <Link to="/lien-he" className="block">
                  <Button variant="hero" size="lg" className="w-full">
                    Yêu cầu báo giá <ArrowRight size={16} />
                  </Button>
                </Link>

                <p className="font-body text-muted-foreground text-xs text-center mt-4">
                  Miễn phí tư vấn • Phản hồi trong 24h
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ServiceDetail;
