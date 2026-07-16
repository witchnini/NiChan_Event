import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, MailCheck } from "lucide-react";
import heroImg from "@/assets/hero-wedding.jpg";
import { apiClient } from "@/services/apiClient";
import { ApiException } from "@/services/apiClient";

type VerifyResult = {
  status: "loading" | "success" | "already" | "error";
  message: string;
};

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [result, setResult] = useState<VerifyResult>({
    status: "loading",
    message: "Đang xác thực email...",
  });

  useEffect(() => {
    if (!token) {
      setResult({
        status: "error",
        message: "Liên kết xác thực không hợp lệ. Vui lòng kiểm tra lại email.",
      });
      return;
    }

    apiClient
      .post<{ alreadyVerified: boolean; message: string }>("/auth/verify-email", { token })
      .then((data) => {
        setResult({
          status: data.alreadyVerified ? "already" : "success",
          message: data.message,
        });
      })
      .catch((err) => {
        setResult({
          status: "error",
          message:
            err instanceof ApiException
              ? err.message
              : "Có lỗi xảy ra, vui lòng thử lại.",
        });
      });
  }, [token]);

  const icon = {
    loading: <Loader2 className="text-primary animate-spin" size={28} />,
    success: <CheckCircle2 className="text-primary" size={28} />,
    already: <MailCheck className="text-primary" size={28} />,
    error: <XCircle className="text-destructive" size={28} />,
  };

  const bgColor = {
    loading: "bg-primary/10",
    success: "bg-primary/10",
    already: "bg-primary/10",
    error: "bg-destructive/10",
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
              Xác thực tài khoản của bạn
            </motion.p>
          </div>
        </div>
      </div>

      {/* Right - Content */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className={`w-14 h-14 rounded-2xl ${bgColor[result.status]} flex items-center justify-center mb-5 mx-auto`}>
            {icon[result.status]}
          </div>

          <h2 className="font-serif text-display-sm text-foreground mb-4">
            {result.status === "loading" && "Đang xác thực..."}
            {result.status === "success" && "Xác thực thành công!"}
            {result.status === "already" && "Đã xác thực"}
            {result.status === "error" && "Xác thực thất bại"}
          </h2>

          <p className="font-body text-muted-foreground mb-8">{result.message}</p>

          {result.status === "success" && (
            <Link to="/dang-nhap">
              <Button variant="hero" className="w-full py-6 text-base">
                Đăng nhập ngay
              </Button>
            </Link>
          )}

          {result.status === "already" && (
            <Link to="/dang-nhap">
              <Button variant="hero" className="w-full py-6 text-base">
                Đăng nhập
              </Button>
            </Link>
          )}

          {result.status === "error" && (
            <div className="space-y-3">
              <Link to="/dang-ky">
                <Button variant="hero" className="w-full py-6 text-base">
                  Đăng ký lại
                </Button>
              </Link>
              <Link to="/dang-nhap">
                <Button variant="outline" className="w-full py-6 text-base">
                  Quay lại đăng nhập
                </Button>
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default VerifyEmail;
