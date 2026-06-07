import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Clock } from "lucide-react";
import SectionHeading from "@/components/SectionHeading";
import heroImg from "@/assets/hero-wedding.jpg";
import { getBlogPosts, type PublicBlogPost } from "@/services/api";

const formatDate = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  return new Date(value).toLocaleDateString("vi-VN");
};

const Blog = () => {
  const [posts, setPosts] = useState<PublicBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getBlogPosts({ status: "published", pageSize: 9 });
        if (!cancelled) setPosts(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải blog");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="min-h-screen pt-24">
      <section className="py-16 bg-surface-low">
        <div className="container mx-auto px-6">
          <SectionHeading
            label="Blog & Tin tức"
            title="Câu chuyện & cảm hứng"
            subtitle="Từ những ý tưởng sáng tạo đến những khoảnh khắc đáng nhớ, hãy cùng khám phá thế giới tổ chức sự kiện qua ống kính của chúng tôi."
          />
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-6">
          {loading && <p className="font-body text-muted-foreground text-center py-20">Đang tải bài viết...</p>}
          {error && <p className="font-body text-destructive text-center py-20">{error}</p>}

          {!loading && !error && featured && (
            <>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-16">
                <Link to={`/blog/${featured.id}`} className="group block">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-surface-lowest rounded-xl overflow-hidden shadow-ambient-lg">
                    <div className="aspect-[16/10] lg:aspect-auto overflow-hidden">
                      <img src={featured.coverImageUrl || heroImg} alt={featured.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    </div>
                    <div className="p-8 lg:p-12 flex flex-col justify-center">
                      <span className="tracking-editorial text-label-md text-primary font-body text-xs mb-4 block">{featured.category}</span>
                      <h2 className="font-serif text-headline-lg md:text-display-sm text-foreground mb-4 group-hover:text-primary transition-colors">{featured.title}</h2>
                      <p className="font-body text-muted-foreground leading-relaxed mb-6">{featured.excerpt || "Chưa có tóm tắt cho bài viết này."}</p>
                      <div className="flex items-center gap-4 text-muted-foreground font-body text-sm">
                        <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(featured.publishedAt)}</span>
                        <span className="flex items-center gap-1"><Clock size={14} /> {featured.viewCount} lượt xem</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {rest.map((post, i) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Link to={`/blog/${post.id}`} className="group block">
                      <div className="bg-surface-lowest rounded-xl overflow-hidden shadow-ambient hover:shadow-ambient-lg transition-all duration-500">
                        <div className="aspect-[16/10] overflow-hidden">
                          <img src={post.coverImageUrl || heroImg} alt={post.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                        </div>
                        <div className="p-6">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="tracking-editorial text-label-md text-primary font-body text-xs">{post.category}</span>
                            <span className="text-muted-foreground font-body text-xs flex items-center gap-1"><Clock size={12} /> {post.viewCount} lượt xem</span>
                          </div>
                          <h3 className="font-serif text-lg text-foreground mb-2 group-hover:text-primary transition-colors">{post.title}</h3>
                          <p className="font-body text-muted-foreground text-sm line-clamp-2 leading-relaxed">{post.excerpt || "Chưa có tóm tắt."}</p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default Blog;
