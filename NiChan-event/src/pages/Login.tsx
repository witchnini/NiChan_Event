import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, LogIn } from "lucide-react";
import heroImg from "@/assets/hero-wedding.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { ApiException } from "@/services/apiClient";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const { role } = await login(email, password);
      if (role === "admin") navigate("/admin");
      else if (role === "organizer") navigate("/ban-to-chuc");
      else navigate("/dashboard");
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError("Có lỗi xảy ra, vui lòng thử lại.");
      }
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <img src={heroImg} alt="NiChan Events" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.6), hsl(var(--on-surface) / 0.4))" }} />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-center">
            <Link to="/">
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-serif text-display-md text-primary-foreground mb-4 cursor-pointer hover:opacity-80 transition-opacity">
                NiChan Events
              </motion.h1>
            </Link>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="font-body text-primary-foreground/80 text-lg max-w-md">
              Biến mọi khoảnh khắc thành kỷ niệm vĩnh cửu
            </motion.p>
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md">
          <Link to="/" className="font-serif text-headline-lg text-primary font-bold mb-2 block lg:hidden">
            NiChan Events
          </Link>
          <h2 className="font-serif text-display-sm text-foreground mb-2">Đăng nhập</h2>
          <p className="font-body text-muted-foreground mb-8">Chào mừng bạn trở lại!</p>

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
            <div>
              <label className="font-body text-sm text-foreground mb-2 block">Mật khẩu</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            {error && (
              <p className="font-body text-sm text-destructive bg-destructive/10 px-4 py-2.5 rounded-lg">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-body text-sm text-muted-foreground">
                <input type="checkbox" className="rounded" />
                Ghi nhớ đăng nhập
              </label>
              <Link to="/quen-mat-khau" className="font-body text-sm text-primary hover:underline">
                Quên mật khẩu?
              </Link>
            </div>

            <Button type="submit" variant="hero" className="w-full py-6 text-base" disabled={isLoading}>
              {isLoading ? "Đang đăng nhập..." : (<>Đăng nhập <LogIn size={18} /></>)}
            </Button>
          </form>

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

export default Login;
