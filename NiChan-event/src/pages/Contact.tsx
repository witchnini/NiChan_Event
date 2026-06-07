import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Phone, Mail, MapPin, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SectionHeading from "@/components/SectionHeading";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

const eventTypes = ["Tiệc cưới", "Khai trương", "Gala Dinner", "Hội nghị", "Road Show", "Kỷ niệm", "Online Event", "Khác"];
const budgetRanges = ["Dưới 50 triệu", "50 - 100 triệu", "100 - 300 triệu", "300 - 500 triệu", "Trên 500 triệu"];

const Contact = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", company: "",
    eventType: "", eventName: "", date: "", location: "",
    guests: "", budget: "", requirements: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submittedCode, setSubmittedCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const normalizePhone = (value: string) => value.replace(/[^\d]/g, "");

  const parseGuestCount = (value: string) => {
    const normalized = value.replace(/[^\d]/g, "");
    return normalized ? Number(normalized) : null;
  };

  const buildNote = () => {
    const parts = [
      formData.company.trim() ? `Cong ty: ${formData.company.trim()}` : null,
      formData.eventName.trim() ? `Ten su kien: ${formData.eventName.trim()}` : null,
      formData.requirements.trim() ? `Yeu cau: ${formData.requirements.trim()}` : null,
    ].filter(Boolean);

    return parts.length ? parts.join("\n") : null;
  };

  const validateStep = (currentStep = step) => {
    if (currentStep === 1) {
      const phone = normalizePhone(formData.phone);
      if (!formData.name.trim() || !formData.email.trim() || !phone) {
        toast.error("Vui long nhap ho ten, email va so dien thoai");
        return false;
      }
      if (!/^0[3-9]\d{8}$/.test(phone)) {
        toast.error("So dien thoai khong dung dinh dang Viet Nam");
        return false;
      }
    }

    if (currentStep === 2 && !formData.eventType.trim()) {
      toast.error("Vui long chon loai su kien");
      return false;
    }

    if (currentStep === 3 && !formData.budget.trim()) {
      toast.error("Vui long chon ngan sach du kien");
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep()) setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    setSubmitting(true);
    try {
      const data = await apiClient.post<{ requestCode: string }>("/public/consultation-requests", {
        customerName: formData.name.trim(),
        phone: normalizePhone(formData.phone),
        email: formData.email.trim(),
        eventType: formData.eventType,
        eventDate: formData.date ? new Date(`${formData.date}T00:00:00`).toISOString() : null,
        guestCount: parseGuestCount(formData.guests),
        budgetRange: formData.budget || null,
        location: formData.location.trim() || null,
        note: buildNote(),
      });

      setSubmittedCode(data.requestCode);
      setSubmitted(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gui yeu cau that bai");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-lg mx-auto px-6">
          <CheckCircle size={64} className="text-secondary mx-auto mb-6" />
          <h2 className="font-serif text-display-sm text-foreground mb-4">Cảm ơn bạn!</h2>
          <p className="font-body text-muted-foreground text-lg leading-relaxed">
            Yêu cầu của bạn đã được gửi thành công. Chúng tôi sẽ liên hệ lại trong vòng 24 giờ.
          </p>
          {submittedCode && (
            <p className="font-body text-sm text-primary font-semibold mt-4">Ma yeu cau: {submittedCode}</p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24">
      <section className="py-16 bg-surface-low">
        <div className="container mx-auto px-6">
          <SectionHeading
            label="Liên hệ"
            title="Bắt đầu câu chuyện của bạn"
            subtitle="Hãy cho chúng tôi biết về sự kiện của bạn, chúng tôi sẽ biến ý tưởng thành hiện thực."
          />
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
            {/* Form */}
            <div className="lg:col-span-2">
              {/* Progress */}
              <div className="flex items-center gap-4 mb-12">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-serif font-bold text-sm shrink-0 transition-all ${
                      step >= s ? "gradient-primary text-primary-foreground" : "bg-surface-low text-muted-foreground"
                    }`}>
                      {s}
                    </div>
                    <span className="font-body text-sm text-muted-foreground hidden sm:block">
                      {s === 1 ? "Thông tin" : s === 2 ? "Sự kiện" : "Chi tiết"}
                    </span>
                    {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? "bg-primary" : "bg-surface-high"}`} />}
                  </div>
                ))}
              </div>

              <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                {step === 1 && (
                  <div className="space-y-6">
                    <h3 className="font-serif text-headline-md text-foreground mb-6">Thông tin liên hệ</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="font-body text-sm text-foreground mb-2 block">Họ và tên *</label>
                        <Input value={formData.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Nguyễn Văn A" className="py-5 rounded-xl bg-surface-lowest font-body" style={{ border: 'none' }} />
                      </div>
                      <div>
                        <label className="font-body text-sm text-foreground mb-2 block">Email *</label>
                        <Input value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="email@example.com" className="py-5 rounded-xl bg-surface-lowest font-body" style={{ border: 'none' }} />
                      </div>
                      <div>
                        <label className="font-body text-sm text-foreground mb-2 block">Số điện thoại *</label>
                        <Input value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="0901 234 567" className="py-5 rounded-xl bg-surface-lowest font-body" style={{ border: 'none' }} />
                      </div>
                      <div>
                        <label className="font-body text-sm text-foreground mb-2 block">Công ty</label>
                        <Input value={formData.company} onChange={(e) => updateField("company", e.target.value)} placeholder="Tên công ty (nếu có)" className="py-5 rounded-xl bg-surface-lowest font-body" style={{ border: 'none' }} />
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <h3 className="font-serif text-headline-md text-foreground mb-6">Thông tin sự kiện</h3>
                    <div>
                      <label className="font-body text-sm text-foreground mb-3 block">Loại sự kiện *</label>
                      <div className="flex flex-wrap gap-3">
                        {eventTypes.map((type) => (
                          <button
                            key={type}
                            onClick={() => updateField("eventType", type)}
                            className={`px-4 py-2.5 rounded-xl font-body text-sm transition-all ${
                              formData.eventType === type ? "gradient-primary text-primary-foreground" : "bg-surface-lowest text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="font-body text-sm text-foreground mb-2 block">Tên sự kiện</label>
                        <Input value={formData.eventName} onChange={(e) => updateField("eventName", e.target.value)} placeholder="VD: Tiệc cưới Minh & Hà" className="py-5 rounded-xl bg-surface-lowest font-body" style={{ border: 'none' }} />
                      </div>
                      <div>
                        <label className="font-body text-sm text-foreground mb-2 block">Ngày dự kiến</label>
                        <Input type="date" value={formData.date} onChange={(e) => updateField("date", e.target.value)} className="py-5 rounded-xl bg-surface-lowest font-body" style={{ border: 'none' }} />
                      </div>
                      <div>
                        <label className="font-body text-sm text-foreground mb-2 block">Địa điểm dự kiến</label>
                        <Input value={formData.location} onChange={(e) => updateField("location", e.target.value)} placeholder="VD: TP.HCM" className="py-5 rounded-xl bg-surface-lowest font-body" style={{ border: 'none' }} />
                      </div>
                      <div>
                        <label className="font-body text-sm text-foreground mb-2 block">Số lượng khách</label>
                        <Input value={formData.guests} onChange={(e) => updateField("guests", e.target.value)} placeholder="VD: 200" className="py-5 rounded-xl bg-surface-lowest font-body" style={{ border: 'none' }} />
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <h3 className="font-serif text-headline-md text-foreground mb-6">Chi tiết & ngân sách</h3>
                    <div>
                      <label className="font-body text-sm text-foreground mb-3 block">Ngân sách dự kiến *</label>
                      <div className="flex flex-wrap gap-3">
                        {budgetRanges.map((range) => (
                          <button
                            key={range}
                            onClick={() => updateField("budget", range)}
                            className={`px-4 py-2.5 rounded-xl font-body text-sm transition-all ${
                              formData.budget === range ? "gradient-primary text-primary-foreground" : "bg-surface-lowest text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="font-body text-sm text-foreground mb-2 block">Yêu cầu đặc biệt</label>
                      <Textarea
                        value={formData.requirements}
                        onChange={(e) => updateField("requirements", e.target.value)}
                        placeholder="Mô tả phong cách, concept mong muốn, các yêu cầu đặc biệt..."
                        rows={5}
                        className="rounded-xl bg-surface-lowest font-body resize-none"
                        style={{ border: 'none' }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Navigation */}
              <div className="flex justify-between mt-10">
                {step > 1 ? (
                  <Button variant="ghost" onClick={() => setStep(step - 1)} className="font-body">
                    ← Quay lại
                  </Button>
                ) : <div />}
                {step < 3 ? (
                  <Button variant="hero" onClick={handleNext}>
                    Tiếp theo <ArrowRight size={16} />
                  </Button>
                ) : (
                  <Button variant="hero" onClick={handleSubmit} disabled={submitting}>
                    Gửi yêu cầu <Send size={16} />
                  </Button>
                )}
              </div>
            </div>

            {/* Contact info */}
            <div>
              <div className="bg-surface-lowest rounded-xl p-8 shadow-ambient sticky top-28">
                <h3 className="font-serif text-headline-md text-foreground mb-6">Liên hệ trực tiếp</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-low flex items-center justify-center shrink-0">
                      <Phone size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-body text-sm text-muted-foreground">Hotline</p>
                      <p className="font-body font-semibold text-foreground">0901 234 567</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-low flex items-center justify-center shrink-0">
                      <Mail size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-body text-sm text-muted-foreground">Email</p>
                      <p className="font-body font-semibold text-foreground">hello@eternalevents.vn</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-low flex items-center justify-center shrink-0">
                      <MapPin size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-body text-sm text-muted-foreground">Văn phòng</p>
                      <p className="font-body font-semibold text-foreground">123 Nguyễn Huệ, Q.1, TP.HCM</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-surface-low rounded-xl">
                  <p className="font-body text-sm text-foreground font-semibold mb-2">⏰ Giờ làm việc</p>
                  <p className="font-body text-sm text-muted-foreground">Thứ 2 - Thứ 6: 8:00 - 18:00</p>
                  <p className="font-body text-sm text-muted-foreground">Thứ 7: 8:00 - 12:00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
