import { motion } from "framer-motion";
import { Award, Heart, Sparkles, Users, Target, Eye } from "lucide-react";
import SectionHeading from "@/components/SectionHeading";
import aboutTeam from "@/assets/about-team.jpg";
import portfolio1 from "@/assets/portfolio-1.jpg";

const values = [
  { icon: Heart, title: "Tận tâm", desc: "Mỗi sự kiện đều được chăm chút như chính sự kiện của gia đình chúng tôi." },
  { icon: Sparkles, title: "Sáng tạo", desc: "Không ngừng đổi mới, mỗi concept là một tác phẩm nghệ thuật độc đáo." },
  { icon: Target, title: "Chuyên nghiệp", desc: "Quy trình chuẩn quốc tế, đội ngũ được đào tạo bài bản." },
  { icon: Eye, title: "Tỉ mỉ", desc: "Từ bông hoa nhỏ nhất đến âm thanh cuối cùng, không chi tiết nào bị bỏ sót." },
];

const milestones = [
  { year: "2014", event: "Thành lập NiChan Events tại TP.HCM" },
  { year: "2016", event: "Mở rộng ra Hà Nội, đạt 100 sự kiện" },
  { year: "2018", event: "Đối tác chiến lược với 20+ venue hàng đầu" },
  { year: "2020", event: "Tiên phong tổ chức sự kiện hybrid & online" },
  { year: "2022", event: "Đạt 400+ sự kiện, mở văn phòng Đà Nẵng" },
  { year: "2024", event: "Giải thưởng Event Agency of the Year" },
  { year: "2026", event: "500+ sự kiện thành công, vươn tầm quốc tế" },
];

const team = [
  { name: "Trần Minh Anh", role: "Founder & CEO", desc: "12 năm kinh nghiệm trong ngành event" },
  { name: "Nguyễn Hoàng Long", role: "Creative Director", desc: "Từng làm việc tại các agency quốc tế" },
  { name: "Lê Thị Phương", role: "Head of Operations", desc: "Chuyên gia quản lý dự án PMP" },
  { name: "Phạm Đức Huy", role: "Technical Director", desc: "15 năm kinh nghiệm âm thanh, ánh sáng" },
];

const About = () => {
  return (
    <div className="min-h-screen pt-24">
      {/* Hero */}
      <section className="py-20 bg-surface-low">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
              <span className="tracking-editorial text-label-md text-primary font-body font-semibold mb-4 block">Về chúng tôi</span>
              <h1 className="font-serif text-display-sm md:text-display-md text-foreground mb-6">
                Kiến tạo kỷ niệm,<br /><span className="text-primary italic">viết nên câu chuyện</span>
              </h1>
              <p className="font-body text-muted-foreground text-lg leading-relaxed mb-6">
                NiChan Events ra đời từ niềm đam mê mãnh liệt với nghệ thuật tổ chức sự kiện. Chúng tôi tin rằng mỗi sự kiện là một câu chuyện — và mỗi câu chuyện xứng đáng được kể một cách đẹp nhất.
              </p>
              <p className="font-body text-muted-foreground leading-relaxed">
                Với hơn 12 năm kinh nghiệm và đội ngũ sáng tạo tài năng, chúng tôi đã mang đến hơn 500 sự kiện thành công cho hàng nghìn khách hàng trên khắp Việt Nam.
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="relative">
              <img src={aboutTeam} alt="Đội ngũ NiChan Events" className="rounded-xl shadow-ambient-lg w-full" loading="lazy" width={1200} height={800} />
              <div className="absolute -bottom-6 -left-6 bg-surface-lowest rounded-xl p-6 shadow-ambient-lg hidden md:block">
                <div className="flex items-center gap-3">
                  <Award size={32} className="text-primary" />
                  <div>
                    <p className="font-serif font-bold text-foreground text-lg">12+ năm</p>
                    <p className="font-body text-muted-foreground text-sm">Kinh nghiệm</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <SectionHeading label="Giá trị cốt lõi" title="Điều làm nên sự khác biệt" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-8 bg-surface-lowest rounded-xl shadow-ambient"
              >
                <div className="w-16 h-16 rounded-full bg-surface-low flex items-center justify-center mx-auto mb-6">
                  <v.icon size={28} className="text-primary" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground mb-3">{v.title}</h3>
                <p className="font-body text-muted-foreground text-sm leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-24 bg-surface-low">
        <div className="container mx-auto px-6">
          <SectionHeading label="Hành trình" title="Từ ý tưởng đến tầm vóc" />
          <div className="max-w-3xl mx-auto">
            {milestones.map((m, i) => (
              <motion.div
                key={m.year}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex gap-6 mb-8"
              >
                <div className="w-20 shrink-0 text-right">
                  <span className="font-serif text-primary font-bold text-lg">{m.year}</span>
                </div>
                <div className="relative">
                  <div className="w-4 h-4 rounded-full gradient-primary absolute -left-2 top-1.5" />
                  {i < milestones.length - 1 && <div className="absolute left-0 top-6 bottom-0 w-0.5 bg-surface-high -mb-8 h-full" />}
                </div>
                <div className="flex-1 pb-8 pl-4">
                  <p className="font-body text-foreground">{m.event}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <SectionHeading label="Đội ngũ" title="Những con người tài năng" subtitle="Đằng sau mỗi sự kiện thành công là một đội ngũ đam mê và tận tụy." />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, i) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-32 h-32 rounded-full gradient-primary mx-auto mb-6 flex items-center justify-center">
                  <span className="font-serif text-primary-foreground text-display-sm font-bold">
                    {member.name.split(" ").pop()?.[0]}
                  </span>
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground">{member.name}</h3>
                <p className="font-body text-primary text-sm font-medium mb-2">{member.role}</p>
                <p className="font-body text-muted-foreground text-sm">{member.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
