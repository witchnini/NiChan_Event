# Cấu trúc thư mục dự án NiChan

Tài liệu này mô tả cấu trúc thư mục hiện tại của repo NiChan sau khi đã chuẩn hóa. Cấu trúc ưu tiên tên thư mục thống nhất, dễ import, dễ cấu hình CI/CD và tránh dùng khoảng trắng trong path.

## 1. Cấu trúc tổng

```text
Nichan/
├── docs/                         # Tài liệu phân tích, thiết kế và quản lý dự án
│   ├── srs.docx                  # Tài liệu đặc tả yêu cầu phần mềm
│   ├── folder-structure.md       # Tài liệu cấu trúc thư mục
│   ├── conventions.md            # Quy ước code, Git, naming, commit, review
│   ├── backlogs/                 # Hướng dẫn lưu backlog trong repo khi cần
│   │   └── README.md
│   ├── database/                 # Thiết kế cơ sở dữ liệu
│   │   ├── erd/                  # ERD, database diagram
│   │   └── schema-notes.md       # Ghi chú quan hệ bảng, ràng buộc, index
│   ├── ui-ux/                    # Tài liệu UI/UX
│   │   └── style-guide.md        # Design tokens, màu sắc, typography, spacing
│   └── api/                      # API specification, contract, changelog API
│       ├── frontend/
│       └── backend/
│
├── NiChan-event/                 # Frontend React + Vite
├── NiChan-backend/               # Backend Node.js + Express + Prisma
│
├── tests/                        # Test case tổng, test plan, file kiểm thử ngoài source code
│   ├── manual/                   # Test case thủ công
│   └── e2e/                      # Test kịch bản end-to-end dùng chung nếu cần
│
├── scripts/                      # Script hỗ trợ dev, build, migrate, automation
├── config/                       # Cấu hình dùng chung cho tooling hoặc MCP
│
├── AGENTS.md                     # Rule, workflow, hướng dẫn làm việc cho AI agent
├── CLAUDE.md                     # Hướng dẫn riêng cho Claude Code nếu còn sử dụng
├── package.json                  # Workspace scripts chạy frontend/backend qua Turborepo
├── package-lock.json             # Lockfile npm cấp root
├── turbo.json                    # Cấu hình Turborepo
├── .gitignore
└── .gitattributes
```

### Ghi chú chỉnh sửa so với bản nháp

- Dùng `docs/srs.docx` thay vì `docs/srs.md/` vì SRS hiện có là tài liệu Word; nếu chuyển sang Markdown sau này thì dùng `docs/srs.md`.
- Dùng `conventions.md` thay vì `convention.md` để thể hiện đây là tập hợp quy ước.
- Dùng `database/erd/` thay vì `DB-erd/` để tên thư mục đồng nhất bằng lowercase kebab-case.
- Dùng `ui-ux/style-guide.md` thay vì `UI/UX style guideline/` để tránh dấu `/` và khoảng trắng trong path.
- Dùng `tests/` thay vì `test/` cho thư mục chứa nhiều loại test case.
- Không dùng `code/front end/` và `code/backend/` vì repo hiện tại đã tách trực tiếp thành `NiChan-event/` và `NiChan-backend/`.
- Nên dùng `AGENTS.md` cho rule/workflow AI ở cấp repo. Các cấu hình tool cụ thể có thể để trong `.codex/`, `.claude/` hoặc thư mục riêng của từng agent nếu cần.

## 2. Cấu trúc frontend

```text
NiChan-event/
├── .husky/                       # Git hooks, ví dụ pre-commit lint/typecheck/test
│   └── pre-commit
│
├── public/                       # Asset tĩnh không đi qua bundler
│   ├── favicon.ico
│   ├── robots.txt
│   └── images/
│
├── src/
│   ├── assets/                   # Asset đi qua bundler: ảnh, svg, font local
│   ├── components/               # Component giao diện tái sử dụng
│   │   ├── ui/                   # Base UI/shadcn components: Button, Dialog, Table...
│   │   ├── layout/               # Header, Navbar, Sidebar, Footer
│   │   └── features/             # Component theo nghiệp vụ: contract, chat, event...
│   │
│   ├── pages/                    # Các màn hình chính, nối với React Router
│   │   ├── admin/                # Màn hình cho admin
│   │   ├── customer/             # Màn hình cho customer
│   │   ├── organizer/            # Màn hình cho organizer
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   └── NotFound.tsx
│   │
│   ├── routes/                   # Khai báo React Router
│   │   └── index.tsx
│   │
│   ├── layouts/                  # Layout theo nhóm route
│   │   ├── AdminLayout.tsx
│   │   └── OrganizerLayout.tsx
│   │
│   ├── providers/                # React providers: QueryClient, Theme, Auth...
│   │   └── AppProviders.tsx
│   │
│   ├── contexts/                 # React Context cụ thể, ví dụ AuthContext
│   ├── hooks/                    # Custom hooks
│   ├── services/                 # Hàm gọi API, socket, client HTTP
│   ├── schemas/                  # Zod schemas cho form/input phía frontend
│   ├── store/                    # Global client state nếu dùng Zustand/Redux
│   ├── types/                    # TypeScript types và declaration files
│   ├── constants/                # Hằng số route, role, status, config tĩnh
│   ├── utils/                    # Hàm tiện ích thuần, không phụ thuộc React
│   ├── lib/                      # Wrapper thư viện, helper có tính hạ tầng
│   ├── styles/                   # Global CSS, theme, Tailwind layers
│   ├── test/                     # Setup/unit test gần frontend source
│   │
│   ├── App.tsx                   # Component gốc, bọc providers và routes
│   ├── main.tsx                  # Entry point mount React vào index.html
│   ├── styles/
│   │   ├── global.css            # Global CSS hiện tại
│   │   ├── theme.css             # CSS variables/design tokens
│   │   └── app.css               # CSS cũ từ template, chưa dùng trực tiếp
│   └── vite-env.d.ts
│
├── index.html
├── components.json               # Cấu hình shadcn/ui
├── eslint.config.js              # ESLint config
├── postcss.config.js
├── tailwind.config.ts            # Tailwind theme và design tokens
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── package.json
├── .env.example
├── .env.local                    # Không commit
├── .gitignore
└── README.md
```

### Quy ước đặt file frontend

- `pages/` chỉ chứa component cấp màn hình hoặc layout gắn trực tiếp với route.
- `components/ui/` dùng cho base UI ít phụ thuộc nghiệp vụ.
- `components/features/` dùng cho component nghiệp vụ có liên quan domain như hợp đồng, chat, ngân sách, báo cáo.
- `services/` chứa code giao tiếp bên ngoài như REST API, Socket.IO.
- `lib/` chứa helper hạ tầng hoặc wrapper thư viện như `utils.ts`, PDF helper, rich text helper.
- `utils/` chỉ chứa hàm thuần có thể test độc lập.
- `schemas/` chứa Zod schema để validate form hoặc payload phía client.
- `constants/` chứa hằng số dùng lại nhiều nơi, tránh hard-code role, status, route name.
- `styles/global.css` dùng cho font import, Tailwind layers và style toàn cục.
- `styles/theme.css` dùng cho CSS variables/design tokens như màu sắc, radius, surface và sidebar tokens.

## 3. Cấu trúc backend

```text
NiChan-backend/
├── prisma/                       # Prisma schema, migrations, seed, script dữ liệu
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
│
├── src/
│   ├── config/                   # Đọc và validate biến môi trường
│   ├── lib/                      # Prisma client, JWT, Socket.IO, Cloudinary...
│   ├── middleware/               # Auth, validate request, error handler
│   ├── modules/                  # Module nghiệp vụ theo domain
│   │   ├── auth/
│   │   ├── public/
│   │   ├── customer/
│   │   ├── organizer/
│   │   ├── admin/
│   │   ├── shared/
│   │   └── reports/
│   ├── routes/                   # Gộp và mount router chính
│   ├── types/                    # Type dùng chung backend
│   ├── utils/                    # Helper response, pagination, request
│   ├── app.ts                    # Khởi tạo Express app
│   └── server.ts                 # Entry point HTTP server + Socket.IO
│
├── uploads/                      # File upload local trong dev, không commit nếu là runtime data
├── package.json
├── tsconfig.json
├── .env.example
├── .env                          # Không commit
├── .gitignore
└── README.md
```

### Quy ước đặt file backend

- Mỗi module nghiệp vụ nên đi theo mẫu `*.router.ts`, `*.service.ts`, `*.schema.ts` nếu có validation.
- `router.ts` chỉ định nghĩa endpoint, middleware, parse request và gọi service.
- `service.ts` chứa logic nghiệp vụ và thao tác database.
- `schema.ts` chứa Zod schema validate input.
- Code dùng chung nhiều module đặt trong `shared/`, `utils/` hoặc `lib/` tùy tính chất:
  - `shared/`: nghiệp vụ dùng chung.
  - `utils/`: helper thuần.
  - `lib/`: cấu hình/wrapper thư viện ngoài.

## 4. Trạng thái dọn cấu trúc hiện tại

1. Đã giữ nguyên `NiChan-event/` và `NiChan-backend/` để tránh ảnh hưởng workspace scripts và deployment.
2. Đã chuyển tài liệu API từ `NiChan-event/API_*.md` về `docs/api/frontend/`.
3. Đã chuyển tài liệu kế hoạch backend từ `NiChan-backend/plan/` về `docs/api/backend/` và `docs/database/`.
4. Đã chuẩn hóa tài liệu hiện có trong `docs/`:
   - `TÀI LIỆU SRS HỆ THỐNG TỔ  CHỨC SỰ KIỆN.docx` -> `docs/srs.docx`.
   - `NiChan_Diagram_ERD.xlsx` -> `docs/database/erd/nichan-erd.xlsx`.
5. Đã chuyển layout frontend từ `src/pages/*/*Layout.tsx` sang `src/layouts/`.
6. Đã chuyển component frontend về các nhóm `components/layout/`, `components/features/` và `components/ui/`.
7. Đã chuyển global CSS về `src/styles/global.css` và tách theme tokens sang `src/styles/theme.css`.
8. Đã tách React providers sang `src/providers/AppProviders.tsx` và route config sang `src/routes/index.tsx`.
