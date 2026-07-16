import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Eye, EyeOff, Lock, CheckCircle2 } from "lucide-react";
import heroImg from "@/assets/hero-wedding.jpg";
import { apiClient, ApiException } from "@/services/apiClient";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Liên kết đặt lại mật khẩu không hợp lệ.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post("/auth/reset-password", {
        token,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiException) setError(err.message);
      else setError("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5 mx-auto">
            <Lock className="text-destructive" size={26} />
          </div>
          <h2 className="font-serif text-display-sm text-foreground mb-2">Liên kết không hợp lệ</h2>
          <p className="font-body text-muted-foreground mb-6">
            Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
          </p>
          <Link to="/quen-mat-khau">
            <Button variant="hero" className="w-full py-6 text-base">
              Yêu cầu liên kết mới
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

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
              Tạo mật khẩu mới cho tài khoản của bạn
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

          {!success ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Lock className="text-primary" size={26} />
              </div>
              <h2 className="font-serif text-display-sm text-foreground mb-2">Đặt lại mật khẩu</h2>
              <p className="font-body text-muted-foreground mb-8">
                Nhập mật khẩu mới cho tài khoản của bạn.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="font-body text-sm text-foreground mb-2 block">Mật khẩu mới *</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Tối thiểu 8 ký tự"
                      className="py-5 rounded-xl bg-surface-lowest font-body border-none pr-12"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="font-body text-sm text-foreground mb-2 block">Xác nhận mật khẩu *</label>
                  <Input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Nhập lại mật khẩu mới"
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
                  {isLoading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
                </Button>
              </form>
            </>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <CheckCircle2 className="text-primary" size={28} />
              </div>
              <h2 className="font-serif text-display-sm text-foreground mb-2">Đã đặt lại mật khẩu!</h2>
              <p className="font-body text-muted-foreground mb-6">
                Mật khẩu của bạn đã được cập nhật thành công. Bạn có thể đăng nhập bằng mật khẩu mới.
              </p>
              <Button
                variant="hero"
                className="w-full py-6 text-base"
                onClick={() => navigate("/dang-nhap")}
              >
                Đăng nhập ngay
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPassword;
