import { Link } from "react-router-dom";
import { Heart, Mail, Phone, MapPin, Instagram, Facebook, Youtube } from "lucide-react";

const Footer = () => {
  return (
    <footer className="relative overflow-hidden">
      {/* Top decorative divider */}
      <div className="h-1 gradient-primary" />

      {/* Main footer */}
      <div className="bg-surface-high text-foreground">
        <div className="container mx-auto px-6 pt-16 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="lg:col-span-1">
              <Link to="/" className="inline-block mb-5">
                <span className="font-serif text-headline-md text-primary font-bold">NiChan</span>
                <span className="font-serif text-headline-md text-foreground font-light"> Events</span>
              </Link>
              <p className="text-muted-foreground font-body leading-relaxed text-sm mb-6">
                Biến mọi khoảnh khắc thành kỷ niệm vĩnh cửu. Chúng tôi tạo nên những sự kiện đẹp như tranh vẽ.
              </p>
              <div className="flex items-center gap-3">
                {[
                  { icon: Facebook, label: "Facebook" },
                  { icon: Instagram, label: "Instagram" },
                  { icon: Youtube, label: "Youtube" },
                ].map(({ icon: Icon, label }) => (
                  <a
                    key={label}
                    href="#"
                    aria-label={label}
                    className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                  >
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-serif text-base font-semibold mb-5 text-foreground tracking-editorial text-xs">Khám phá</h4>
              <ul className="space-y-3">
                {[
                  { label: "Dịch vụ", path: "/dich-vu" },
                  { label: "Portfolio", path: "/portfolio" },
                  { label: "Blog", path: "/blog" },
                  { label: "Giới thiệu", path: "/gioi-thieu" },
                  { label: "Liên hệ", path: "/lien-he" },
                ].map((link) => (
                  <li key={link.path}>
                    <Link
                      to={link.path}
                      className="text-muted-foreground hover:text-primary transition-colors font-body text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-serif text-base font-semibold mb-5 text-foreground tracking-editorial text-xs">Dịch vụ</h4>
              <ul className="space-y-3">
                {["Tiệc cưới", "Khai trương", "Hội nghị", "Gala Dinner", "Road Show"].map((s) => (
                  <li key={s}>
                    <span className="text-muted-foreground font-body text-sm">{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-serif text-base font-semibold mb-5 text-foreground tracking-editorial text-xs">Liên hệ</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin size={14} className="text-primary" />
                  </div>
                  <span className="text-muted-foreground font-body text-sm">Đông Phương - Đông Hưng - Thái Bình</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone size={14} className="text-primary" />
                  </div>
                  <span className="text-muted-foreground font-body text-sm">0123 456 789</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail size={14} className="text-primary" />
                  </div>
                  <span className="text-muted-foreground font-body text-sm">hello@nichanevents.vn</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-14 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-muted-foreground font-body text-xs flex items-center gap-1">
              Made with <Heart size={12} className="text-primary fill-primary" /> by NiChan Events © 2026
            </p>
            <div className="flex items-center gap-6">
              {["Chính sách bảo mật", "Điều khoản sử dụng"].map((text) => (
                <a key={text} href="#" className="text-muted-foreground hover:text-primary transition-colors font-body text-xs">
                  {text}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
