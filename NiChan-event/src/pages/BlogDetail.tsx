import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-wedding.jpg";
import { normalizeRichTextInput } from "@/lib/richText";
import { getBlogPostById, type PublicBlogPost } from "@/services/api";

const formatDate = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  return new Date(value).toLocaleDateString("vi-VN");
};

const BlogDetail = () => {
  const { id } = useParams();
  const [post, setPost] = useState<PublicBlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getBlogPostById(id);
        if (!cancelled) setPost(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải bài viết");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const contentHtml = useMemo(() => (post?.content ? normalizeRichTextInput(post.content) : ""), [post?.content]);

  if (loading) {
    return <div className="min-h-screen pt-24 flex items-center justify-center font-body text-muted-foreground">Đang tải bài viết...</div>;
  }

  if (error || !post) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-headline-lg text-foreground mb-4">Không tìm thấy bài viết</h1>
          <p className="font-body text-muted-foreground mb-6">{error || "Bài viết không tồn tại hoặc đã bị ẩn."}</p>
          <Link to="/blog">
            <Button variant="hero">Quay lại Blog</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24">
      <div className="relative h-[50vh] overflow-hidden">
        <img src={post.coverImageUrl || heroImg} alt={post.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, hsl(var(--on-surface) / 0.8), hsl(var(--on-surface) / 0.2))" }} />
        <div className="absolute inset-0 flex items-end">
          <div className="container mx-auto px-6 pb-12">
            <Link to="/blog" className="inline-flex items-center gap-2 text-primary-foreground/80 font-body text-sm mb-4 hover:text-primary-foreground transition-colors">
              <ArrowLeft size={16} /> Blog
            </Link>
            <span className="tracking-editorial text-label-md text-primary-foreground/80 font-body text-xs block mb-3">{post.category}</span>
            <h1 className="font-serif text-display-sm md:text-display-md text-primary-foreground max-w-3xl">{post.title}</h1>
            <div className="flex items-center gap-4 mt-4 text-primary-foreground/70 font-body text-sm">
              <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(post.publishedAt)}</span>
              <span className="flex items-center gap-1"><Clock size={14} /> {post.viewCount} lượt xem</span>
            </div>
          </div>
        </div>
      </div>

      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            {contentHtml ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rich-text-content text-lg leading-[1.8]"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            ) : (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-body text-foreground leading-[1.8] text-lg mb-6"
              >
                Bài viết này hiện chưa có nội dung chi tiết trong hệ thống.
              </motion.p>
            )}

            <div className="mt-12 pt-8 flex items-center justify-between" style={{ borderTop: "1px solid hsl(var(--outline-variant) / 0.2)" }}>
              <Link to="/blog">
                <Button variant="ghost" className="font-body">← Quay lại Blog</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BlogDetail;
