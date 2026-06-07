import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Phone, Camera, Save, Lock, Eye, EyeOff, Calendar, MapPin, Briefcase, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiClient, ApiException } from "@/services/apiClient";
import { useAuth } from "@/contexts/AuthContext";

type OrganizerProfileResponse = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  phone?: string | null;
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  organizerProfile?: {
    fullName: string;
    jobTitle: string;
    address?: string | null;
    bio?: string | null;
  } | null;
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật";

const OrganizerProfile = () => {
  const { refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    joinDate: "",
    address: "",
    bio: "",
    jobTitle: "",
    lastLoginAt: "",
    avatarUrl: "",
  });

  const [passwords, setPasswords] = useState({ old: "", new: "", confirm: "" });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await apiClient.get<OrganizerProfileResponse>("/organizer/profile");
        if (cancelled) return;
        setProfile({
          name: data.organizerProfile?.fullName || data.displayName || "",
          email: data.email || "",
          phone: data.phone || "",
          role: data.role,
          joinDate: formatDate(data.createdAt),
          address: data.organizerProfile?.address || "",
          bio: data.organizerProfile?.bio || "",
          jobTitle: data.organizerProfile?.jobTitle || "",
          lastLoginAt: formatDate(data.lastLoginAt),
          avatarUrl: data.avatarUrl || "",
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Không thể tải hồ sơ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    try {
      await apiClient.put("/organizer/profile", {
        name: profile.name,
        phone: profile.phone || undefined,
        address: profile.address || null,
        bio: profile.bio || null,
        jobTitle: profile.jobTitle || undefined,
      });
      await refreshUser();
      setEditing(false);
      toast.success("Đã cập nhật thông tin cá nhân");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể cập nhật hồ sơ");
    }
  };

  const handleChangePassword = async () => {
    if (!passwords.old || !passwords.new || !passwords.confirm) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      await apiClient.put("/organizer/profile/password", {
        oldPassword: passwords.old,
        newPassword: passwords.new,
        confirmPassword: passwords.confirm,
      });
      setChangingPassword(false);
      setPasswords({ old: "", new: "", confirm: "" });
      toast.success("Đã đổi mật khẩu thành công");
    } catch (err) {
      const message = err instanceof ApiException ? err.message : "Không thể đổi mật khẩu";
      toast.error(message);
    }
  };

  const stats = useMemo(() => [
    { label: "Ngày tham gia", value: profile.joinDate, icon: Calendar },
    { label: "Vai trò hệ thống", value: profile.role, icon: Shield },
    { label: "Chức danh", value: profile.jobTitle || "Chưa cập nhật", icon: Briefcase },
  ], [profile]);

  if (loading) {
    return <div className="font-body text-muted-foreground">Đang tải hồ sơ...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="font-serif text-headline-lg text-foreground">Hồ sơ cá nhân</h1>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-secondary flex items-center justify-center text-secondary-foreground font-serif text-display-sm font-bold">
              {profile.name.trim().charAt(0).toUpperCase() || "O"}
            </div>
            <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-surface-lowest shadow-ambient flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <Camera size={14} />
            </button>
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-headline-lg text-foreground">{profile.name}</h2>
            <p className="font-body text-sm text-secondary font-semibold mt-1">{profile.jobTitle || "Ban tổ chức"}</p>
            <p className="font-body text-sm text-muted-foreground mt-2">{profile.bio || "Chưa có phần giới thiệu."}</p>
          </div>
          <Button variant={editing ? "hero" : "outline"} size="sm" onClick={() => editing ? handleSave() : setEditing(true)}>
            {editing ? <><Save size={14} /> Lưu</> : "Chỉnh sửa"}
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-surface-lowest rounded-xl p-4 shadow-ambient flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <stat.icon size={18} className="text-secondary" />
            </div>
            <div>
              <p className="font-body text-xs text-muted-foreground">{stat.label}</p>
              <p className="font-body text-sm font-semibold text-foreground">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
        <h3 className="font-serif text-headline-md text-foreground mb-6">Thông tin chi tiết</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="font-body text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><User size={12} /> Họ tên</label>
            {editing ? <Input value={profile.name} onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))} /> : <p className="font-body text-sm text-foreground py-2">{profile.name}</p>}
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><Mail size={12} /> Email</label>
            <p className="font-body text-sm text-foreground py-2">{profile.email}</p>
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><Phone size={12} /> Số điện thoại</label>
            {editing ? <Input value={profile.phone} onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))} /> : <p className="font-body text-sm text-foreground py-2">{profile.phone || "Chưa cập nhật"}</p>}
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><Briefcase size={12} /> Chức danh</label>
            {editing ? <Input value={profile.jobTitle} onChange={(e) => setProfile((prev) => ({ ...prev, jobTitle: e.target.value }))} /> : <p className="font-body text-sm text-foreground py-2">{profile.jobTitle || "Chưa cập nhật"}</p>}
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><MapPin size={12} /> Địa chỉ</label>
            {editing ? <Input value={profile.address} onChange={(e) => setProfile((prev) => ({ ...prev, address: e.target.value }))} /> : <p className="font-body text-sm text-foreground py-2">{profile.address || "Chưa cập nhật"}</p>}
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><Calendar size={12} /> Đăng nhập gần nhất</label>
            <p className="font-body text-sm text-foreground py-2">{profile.lastLoginAt}</p>
          </div>
          <div className="sm:col-span-2">
            <label className="font-body text-xs text-muted-foreground mb-1.5 block">Giới thiệu</label>
            {editing ? (
              <textarea value={profile.bio} onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
                rows={3} className="w-full rounded-xl bg-surface-low p-3 font-body text-sm text-foreground border border-border resize-none focus:outline-none focus:ring-2 focus:ring-secondary/20" />
            ) : <p className="font-body text-sm text-foreground py-2">{profile.bio || "Chưa có phần giới thiệu."}</p>}
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif text-headline-md text-foreground">Bảo mật</h3>
          {!changingPassword && (
            <Button variant="outline" size="sm" onClick={() => setChangingPassword(true)}>
              <Lock size={14} /> Đổi mật khẩu
            </Button>
          )}
        </div>
        {changingPassword ? (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="font-body text-xs text-muted-foreground mb-1.5 block">Mật khẩu hiện tại</label>
              <div className="relative">
                <Input type={showOld ? "text" : "password"} value={passwords.old} onChange={(e) => setPasswords((prev) => ({ ...prev, old: e.target.value }))} />
                <button onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showOld ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              </div>
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground mb-1.5 block">Mật khẩu mới</label>
              <div className="relative">
                <Input type={showNew ? "text" : "password"} value={passwords.new} onChange={(e) => setPasswords((prev) => ({ ...prev, new: e.target.value }))} />
                <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showNew ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              </div>
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground mb-1.5 block">Xác nhận mật khẩu mới</label>
              <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords((prev) => ({ ...prev, confirm: e.target.value }))} />
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
  );
};

export default OrganizerProfile;
