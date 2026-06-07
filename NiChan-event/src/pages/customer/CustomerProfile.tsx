import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Phone, Camera, Save, Lock, Eye, EyeOff, Calendar, MapPin, Star, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/services/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const CustomerProfile = () => {
  const { refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", address: "", bio: "" });
  const [statsData, setStatsData] = useState({ events: 0, contracts: 0, reviews: 0 });
  const [passwords, setPasswords] = useState({ old: "", new: "", confirm: "" });

  useEffect(() => {
    const load = async () => {
      try {
        const [profileData, dashboard, reviews] = await Promise.all([
          apiClient.get<any>("/customer/profile"),
          apiClient.get<any>("/customer/dashboard"),
          apiClient.get<any[]>("/customer/reviews"),
        ]);
        setProfile({
          name: profileData.fullName ?? profileData.displayName ?? "",
          email: profileData.email ?? "",
          phone: profileData.phone ?? "",
          address: profileData.address ?? "",
          bio: profileData.note ?? "",
        });
        setStatsData({
          events: dashboard.events?.length ?? 0,
          contracts: dashboard.contracts?.length ?? 0,
          reviews: reviews.length,
        });
      } catch (error) {
        toast.error("Không tải được hồ sơ khách hàng");
      }
    };
    void load();
  }, []);

  const handleSave = async () => {
    try {
      await apiClient.put("/customer/profile", {
        fullName: profile.name,
        phone: profile.phone,
        address: profile.address,
        note: profile.bio,
      });
      await refreshUser();
      setEditing(false);
      toast.success("Đã cập nhật thông tin cá nhân");
    } catch (error) {
      toast.error("Cập nhật hồ sơ thất bại");
    }
  };

  const handleChangePassword = async () => {
    if (!passwords.old || !passwords.new || !passwords.confirm) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }
    if (passwords.new.length < 6) {
      toast.error("Mật khẩu mới phải ít nhất 6 ký tự");
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }
    try {
      await apiClient.put("/customer/profile/password", {
        currentPassword: passwords.old,
        newPassword: passwords.new,
      });
      setChangingPassword(false);
      setPasswords({ old: "", new: "", confirm: "" });
      toast.success("Đã đổi mật khẩu thành công");
    } catch (error) {
      toast.error("Đổi mật khẩu thất bại");
    }
  };

  const stats = useMemo(() => [
    { label: "Sự kiện", value: String(statsData.events), icon: Calendar },
    { label: "Hợp đồng", value: String(statsData.contracts), icon: FileText },
    { label: "Đánh giá", value: String(statsData.reviews), icon: Star },
  ], [statsData]);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-6 max-w-4xl space-y-6">
        <h1 className="font-serif text-display-sm text-foreground">Hồ sơ cá nhân</h1>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground font-serif text-display-sm font-bold">
                {profile.name?.[0] ?? "K"}
              </div>
              <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-surface-lowest shadow-ambient flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <Camera size={14} />
              </button>
            </div>
            <div className="flex-1">
              <h2 className="font-serif text-headline-lg text-foreground">{profile.name || "Khách hàng"}</h2>
              <p className="font-body text-sm text-primary font-semibold mt-1">Khách hàng</p>
              <p className="font-body text-sm text-muted-foreground mt-2">{profile.bio || "Thông tin lấy từ PostgreSQL qua API."}</p>
            </div>
            <Button variant={editing ? "hero" : "outline"} size="sm" onClick={() => editing ? void handleSave() : setEditing(true)}>
              {editing ? <><Save size={14} /> Lưu</> : "Chỉnh sửa"}
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-surface-lowest rounded-xl p-4 shadow-ambient text-center">
              <stat.icon size={20} className="text-primary mx-auto" />
              <p className="font-serif text-headline-lg text-foreground mt-2">{stat.value}</p>
              <p className="font-body text-xs text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <h3 className="font-serif text-headline-md text-foreground mb-6">Thông tin chi tiết</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="font-body text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><User size={12} /> Họ tên</label>
              {editing ? <Input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} /> : <p className="font-body text-sm text-foreground py-2">{profile.name}</p>}
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><Mail size={12} /> Email</label>
              <p className="font-body text-sm text-foreground py-2">{profile.email}</p>
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><Phone size={12} /> Số điện thoại</label>
              {editing ? <Input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} /> : <p className="font-body text-sm text-foreground py-2">{profile.phone || "-"}</p>}
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><MapPin size={12} /> Địa chỉ</label>
              {editing ? <Input value={profile.address} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))} /> : <p className="font-body text-sm text-foreground py-2">{profile.address || "-"}</p>}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-headline-md text-foreground">Bảo mật</h3>
            {!changingPassword && <Button variant="outline" size="sm" onClick={() => setChangingPassword(true)}><Lock size={14} /> Đổi mật khẩu</Button>}
          </div>
          {changingPassword ? (
            <div className="space-y-4 max-w-md">
              <div>
                <label className="font-body text-xs text-muted-foreground mb-1.5 block">Mật khẩu hiện tại</label>
                <div className="relative">
                  <Input type={showOld ? "text" : "password"} value={passwords.old} onChange={e => setPasswords(p => ({ ...p, old: e.target.value }))} />
                  <button onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showOld ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                </div>
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground mb-1.5 block">Mật khẩu mới</label>
                <div className="relative">
                  <Input type={showNew ? "text" : "password"} value={passwords.new} onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))} />
                  <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showNew ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                </div>
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground mb-1.5 block">Xác nhận mật khẩu mới</label>
                <Input type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setChangingPassword(false); setPasswords({ old: "", new: "", confirm: "" }); }}>Hủy</Button>
                <Button variant="hero" onClick={handleChangePassword}><Lock size={14} /> Đổi mật khẩu</Button>
              </div>
            </div>
          ) : (
            <p className="font-body text-sm text-muted-foreground">Mật khẩu đang được quản lý bằng tài khoản thật trên hệ thống.</p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default CustomerProfile;
