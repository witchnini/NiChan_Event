import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Mail, CheckCircle2, Send } from "lucide-react";
import heroImg from "@/assets/hero-wedding.jpg";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) {
      setError("Vui lòng nhập email.");
      return;
    }
    setIsLoading(true);
    // Simulate request
    await new Promise((r) => setTimeout(r, 900));
    setIsLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <img src={heroImg} alt="NiChan Events" className="w-full h-full object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.6), hsl(var(--on-surface) / 0.4))" }}
        />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-center">
            <Link to="/">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-serif text-display-md text-primary-foreground mb-4 cursor-pointer hover:opacity-80 transition-opacity"
              >
                NiChan Events
              </motion.h1>
            </Link>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="font-body text-primary-foreground/80 text-lg max-w-md"
            >
              Khôi phục tài khoản nhanh chóng và an toàn
            </motion.p>
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <Link
            to="/dang-nhap"
            className="inline-flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-primary mb-6 transition-colors"
          >
            <ArrowLeft size={16} />
            Quay lại đăng nhập
          </Link>

          {!submitted ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Mail className="text-primary" size={26} />
              </div>
              <h2 className="font-serif text-display-sm text-foreground mb-2">Quên mật khẩu?</h2>
              <p className="font-body text-muted-foreground mb-8">
                Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu cho bạn.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="font-body text-sm text-foreground mb-2 block">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="py-5 rounded-xl bg-surface-lowest font-body border-none"
                    required
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <p className="font-body text-sm text-destructive bg-destructive/10 px-4 py-2.5 rounded-lg">
                    {error}
                  </p>
                )}

                <Button type="submit" variant="hero" className="w-full py-6 text-base" disabled={isLoading}>
                  {isLoading ? "Đang gửi..." : (<>Gửi liên kết đặt lại <Send size={18} /></>)}
                </Button>
              </form>
            </>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <CheckCircle2 className="text-primary" size={28} />
              </div>
              <h2 className="font-serif text-display-sm text-foreground mb-2">Đã gửi email!</h2>
              <p className="font-body text-muted-foreground mb-6">
                Chúng tôi đã gửi liên kết đặt lại mật khẩu đến{" "}
                <span className="text-foreground font-semibold">{email}</span>. Vui lòng kiểm tra hộp thư
                (kể cả mục Spam) và làm theo hướng dẫn.
              </p>
              <div className="bg-surface-lowest rounded-xl p-4 mb-6">
                <p className="font-body text-sm text-muted-foreground">
                  Không nhận được email?{" "}
                  <button
                    onClick={() => setSubmitted(false)}
                    className="text-primary font-semibold hover:underline"
                  >
                    Gửi lại
                  </button>
                </p>
              </div>
              <Link to="/dang-nhap">
                <Button variant="hero" className="w-full py-6 text-base">
                  Quay lại đăng nhập
                </Button>
              </Link>
            </motion.div>
          )}

          <p className="font-body text-sm text-muted-foreground text-center mt-8">
            Chưa có tài khoản?{" "}
            <Link to="/dang-ky" className="text-primary font-semibold hover:underline">
              Đăng ký ngay
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPassword;
