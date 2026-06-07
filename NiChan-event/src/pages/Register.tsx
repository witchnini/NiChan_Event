import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import heroImg from "@/assets/hero-wedding.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { ApiException } from "@/services/apiClient";

const Register = () => {
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", password: "", confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    try {
      await register(formData);
      navigate("/dashboard");
    } catch (err) {
      if (err instanceof ApiException) setError(err.message);
      else setError("Có lỗi xảy ra, vui lòng thử lại.");
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:block lg:w-1/2 relative">
        <img src={heroImg} alt="NiChan Events" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(var(--secondary) / 0.6), hsl(var(--on-surface) / 0.4))" }} />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-center">
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-serif text-display-md text-primary-foreground mb-4">
              Tham gia cùng chúng tôi
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="font-body text-primary-foreground/80 text-lg max-w-md">
              Đăng ký để theo dõi sự kiện và nhận báo giá nhanh chóng
            </motion.p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md">
          <Link to="/" className="font-serif text-headline-lg text-primary font-bold mb-2 block lg:hidden">
            NiChan Events
          </Link>
          <h2 className="font-serif text-display-sm text-foreground mb-2">Đăng ký</h2>
          <p className="font-body text-muted-foreground mb-8">Tạo tài khoản miễn phí</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="font-body text-sm text-foreground mb-2 block">Họ và tên *</label>
              <Input value={formData.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Nguyễn Văn A" className="py-5 rounded-xl bg-surface-lowest font-body border-none" required />
            </div>
            <div>
              <label className="font-body text-sm text-foreground mb-2 block">Email *</label>
              <Input type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="email@example.com" className="py-5 rounded-xl bg-surface-lowest font-body border-none" required />
            </div>
            <div>
              <label className="font-body text-sm text-foreground mb-2 block">Số điện thoại *</label>
              <Input value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="0901 234 567" className="py-5 rounded-xl bg-surface-lowest font-body border-none" required />
            </div>
            <div>
              <label className="font-body text-sm text-foreground mb-2 block">Mật khẩu *</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  className="py-5 rounded-xl bg-surface-lowest font-body border-none pr-12"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="font-body text-sm text-foreground mb-2 block">Xác nhận mật khẩu *</label>
              <Input type="password" value={formData.confirmPassword} onChange={(e) => updateField("confirmPassword", e.target.value)} placeholder="Nhập lại mật khẩu" className="py-5 rounded-xl bg-surface-lowest font-body border-none" required />
            </div>

            {error && (
              <p className="font-body text-sm text-destructive bg-destructive/10 px-4 py-2.5 rounded-lg">
                {error}
              </p>
            )}

            <label className="flex items-start gap-2 font-body text-sm text-muted-foreground">
              <input type="checkbox" className="rounded mt-1" required />
              <span>Tôi đồng ý với <Link to="#" className="text-primary hover:underline">Điều khoản sử dụng</Link> và <Link to="#" className="text-primary hover:underline">Chính sách bảo mật</Link></span>
            </label>

            <Button type="submit" variant="hero" className="w-full py-6 text-base" disabled={isLoading}>
              {isLoading ? "Đang đăng ký..." : (<>Đăng ký <UserPlus size={18} /></>)}
            </Button>
          </form>

          <p className="font-body text-sm text-muted-foreground text-center mt-8">
            Đã có tài khoản?{" "}
            <Link to="/dang-nhap" className="text-primary font-semibold hover:underline">
              Đăng nhập
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
