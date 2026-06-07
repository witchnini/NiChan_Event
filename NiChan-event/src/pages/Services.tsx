import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Users, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SectionHeading from "@/components/SectionHeading";
import heroImg from "@/assets/hero-wedding.jpg";
import {
  getAllServices,
  getServiceCategories,
  type PublicService,
  type PublicServiceCategory,
} from "@/services/api";

const formatCurrencyRange = (priceFrom?: string | number | null, priceTo?: string | number | null) => {
  const formatPrice = (value: string | number) =>
    Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 0 });

  if (priceFrom && priceTo) return `${formatPrice(priceFrom)} - ${formatPrice(priceTo)} VND`;
  if (priceFrom) return `Từ ${formatPrice(priceFrom)} VND`;
  if (priceTo) return `Đến ${formatPrice(priceTo)} VND`;
  return "Liên hệ báo giá";
};

const formatGuestRange = (guestFrom?: number | null, guestTo?: number | null) => {
  if (guestFrom && guestTo) return `${guestFrom} - ${guestTo}`;
  if (guestFrom) return `Từ ${guestFrom}`;
  if (guestTo) return `Đến ${guestTo}`;
  return "Theo yêu cầu";
};

const Services = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get("category") || "all";
  const [activeCategory, setActiveCategory] = useState(categoryFromUrl);
  const [searchTerm, setSearchTerm] = useState("");
  const [categories, setCategories] = useState<PublicServiceCategory[]>([]);
  const [services, setServices] = useState<PublicService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync URL ?category= param to activeCategory state
  useEffect(() => {
    setActiveCategory(categoryFromUrl);
  }, [categoryFromUrl]);

  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      try {
        const data = await getServiceCategories();
        if (!cancelled) setCategories(data);
      } catch {
        if (!cancelled) setCategories([]);
      }
    };

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadServices = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAllServices({
          category: activeCategory === "all" ? undefined : activeCategory,
          search: searchTerm || undefined,
        });
        if (!cancelled) setServices(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải danh sách dịch vụ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadServices();
    return () => {
      cancelled = true;
    };
  }, [activeCategory, searchTerm]);

  return (
    <div className="min-h-screen pt-24">
      <section className="py-16 bg-surface-low">
        <div className="container mx-auto px-6">
          <SectionHeading
            label="Khám phá dịch vụ"
            title="Dịch vụ tổ chức sự kiện"
            subtitle="Tìm kiếm gói dịch vụ phù hợp cho sự kiện của bạn từ tiệc cưới đến hội nghị quốc tế."
          />

          <div className="max-w-2xl mx-auto relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm dịch vụ, loại sự kiện..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 py-6 text-base rounded-xl bg-surface-lowest shadow-ambient font-body"
              style={{ border: "none" }}
            />
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap gap-3 mb-12 justify-center">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-5 py-2.5 rounded-xl font-body text-sm transition-all duration-300 ${
                activeCategory === "all"
                  ? "gradient-primary text-primary-foreground shadow-ambient"
                  : "bg-surface-low text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả
            </button>

            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.slug)}
                className={`px-5 py-2.5 rounded-xl font-body text-sm transition-all duration-300 ${
                  activeCategory === category.slug
                    ? "gradient-primary text-primary-foreground shadow-ambient"
                    : "bg-surface-low text-muted-foreground hover:text-foreground"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {loading && <p className="font-body text-muted-foreground text-center py-20">Đang tải dịch vụ...</p>}
          {error && <p className="font-body text-destructive text-center py-20">{error}</p>}

          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.map((service, i) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  layout
                >
                  <Link to={`/dich-vu/${service.slug}`} className="group block">
                    <div className="bg-surface-lowest rounded-xl overflow-hidden shadow-ambient hover:shadow-ambient-lg transition-all duration-500">
                      <div className="aspect-[16/10] overflow-hidden">
                        <img
                          src={service.coverImageUrl || heroImg}
                          alt={service.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-6">
                        <span className="tracking-editorial text-label-md text-primary font-body text-xs">
                          {service.category.name}
                        </span>
                        <h3 className="font-serif text-headline-md text-foreground mt-2 mb-2">{service.title}</h3>
                        <p className="font-body text-muted-foreground text-sm leading-relaxed mb-4 line-clamp-2">
                          {service.shortDescription}
                        </p>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-body text-primary font-semibold text-sm">
                            {formatCurrencyRange(service.priceFrom, service.priceTo)}
                          </span>
                          <div className="flex items-center gap-3 text-muted-foreground text-xs font-body">
                            <span className="flex items-center gap-1"><Users size={12} /> {formatGuestRange(service.guestFrom, service.guestTo)}</span>
                            <span className="flex items-center gap-1"><MapPin size={12} /> {service.locationText || "Toàn quốc"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}

          {!loading && !error && services.length === 0 && (
            <div className="text-center py-20">
              <p className="font-body text-muted-foreground text-lg">
                Không tìm thấy dịch vụ phù hợp. Hãy thử từ khóa khác.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => { setActiveCategory("all"); setSearchTerm(""); }}>
                Xóa bộ lọc
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Services;
