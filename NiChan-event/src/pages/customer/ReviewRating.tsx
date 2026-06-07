import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Star, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import SectionHeading from "@/components/SectionHeading";
import { getEventDisplayName } from "@/lib/eventDisplay";

type CustomerEvent = {
  id: string;
  name: string;
  type?: string | null;
  eventDate?: string | null;
  status: string;
  customerUser?: { displayName: string } | null;
  consultationRequest?: { customerName?: string | null; eventType?: string | null; note?: string | null } | null;
};
type Review = { id: string; eventId: string; event?: { id: string; name: string }; ratingOverall: number; comment: string };
type Criterion = { key: string; label: string };

const ReviewRating = () => {
  const [events, setEvents] = useState<CustomerEvent[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [hoveredStar, setHoveredStar] = useState<Record<string, number>>({});

  const load = async () => {
    try {
      const [eventList, reviewList, criterionList] = await Promise.all([
        apiClient.get<CustomerEvent[]>("/customer/events"),
        apiClient.get<Review[]>("/customer/reviews"),
        apiClient.get<Criterion[]>("/public/review-criteria"),
      ]);
      setEvents(eventList);
      setReviews(reviewList);
      setCriteria(criterionList);
    } catch (error) {
      toast.error("Không tải được dữ liệu đánh giá");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const reviewByEvent = useMemo(() => new Map(reviews.map(review => [review.event?.id ?? review.eventId, review])), [reviews]);
  const reviewableEvents = events.filter(event => event.status === "completed" || reviewByEvent.has(event.id));

  const startReview = (eventId: string) => {
    setActiveEventId(eventId);
    setRatings({});
    setComment("");
  };

  const submitReview = async () => {
    if (!activeEventId) return;
    if (criteria.length > 0 && Object.keys(ratings).length < criteria.length) {
      toast.error("Vui lòng đánh giá tất cả tiêu chí");
      return;
    }
    const scores = Object.values(ratings);
    const avgRating = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 5;
    try {
      await apiClient.post("/customer/reviews", {
        eventId: activeEventId,
        ratingOverall: avgRating,
        comment,
        criteriaScores: criteria.map(c => ({ key: c.key, score: ratings[c.key] ?? avgRating })),
      });
      setActiveEventId(null);
      toast.success("Đã gửi đánh giá thành công");
      await load();
    } catch (error) {
      toast.error("Gửi đánh giá thất bại");
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <section className="py-12 bg-surface-low">
        <div className="container mx-auto px-6">
          <SectionHeading label="Đánh giá" title="Đánh giá & nhận xét" subtitle="Chia sẻ trải nghiệm của bạn sau các sự kiện đã hoàn thành." />
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-6 max-w-3xl space-y-6">
          {reviewableEvents.length === 0 && <p className="font-body text-muted-foreground">Chưa có sự kiện hoàn thành để đánh giá.</p>}
          {reviewableEvents.map((event, i) => {
            const review = reviewByEvent.get(event.id);
            return (
              <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-serif text-headline-md text-foreground">{getEventDisplayName(event)}</h3>
                    <p className="font-body text-sm text-muted-foreground mt-1">Ngày sự kiện: {event.eventDate ? new Date(event.eventDate).toLocaleDateString("vi-VN") : "-"}</p>
                  </div>
                  {review ? (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }, (_, idx) => (
                          <Star key={idx} size={18} className={idx < Math.round(review.ratingOverall) ? "text-amber-500 fill-amber-500" : "text-muted-foreground"} />
                        ))}
                      </div>
                      <span className="font-serif font-bold text-foreground">{review.ratingOverall}</span>
                      <CheckCircle size={16} className="text-secondary" />
                    </div>
                  ) : (
                    <Button variant="hero" size="sm" onClick={() => startReview(event.id)}><Star size={14} /> Đánh giá ngay</Button>
                  )}
                </div>

                {review?.comment && <div className="bg-surface-low rounded-xl p-4"><p className="font-body text-sm italic text-foreground">"{review.comment}"</p></div>}

                {activeEventId === event.id && !review && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-6 space-y-5">
                    <div className="space-y-4">
                      {criteria.map(c => (
                        <div key={c.key} className="flex items-center justify-between bg-surface-low rounded-xl p-4">
                          <span className="font-body text-sm text-foreground">{c.label}</span>
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }, (_, idx) => (
                              <button key={idx} onMouseEnter={() => setHoveredStar(prev => ({ ...prev, [c.key]: idx + 1 }))} onMouseLeave={() => setHoveredStar(prev => ({ ...prev, [c.key]: 0 }))} onClick={() => setRatings(prev => ({ ...prev, [c.key]: idx + 1 }))}>
                                <Star size={22} className={`transition-colors ${idx < (hoveredStar[c.key] || ratings[c.key] || 0) ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`} />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="font-body text-sm text-foreground mb-2 block">Nhận xét của bạn</label>
                      <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Chia sẻ trải nghiệm của bạn..." rows={4} className="w-full rounded-xl bg-surface-low p-4 font-body text-sm text-foreground border-none resize-none focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setActiveEventId(null)} className="flex-1">Hủy</Button>
                      <Button variant="hero" onClick={submitReview} className="flex-1"><Send size={14} /> Gửi đánh giá</Button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default ReviewRating;
