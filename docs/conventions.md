# Quy ước dự án

## Tên thư mục và file

- Dùng lowercase kebab-case cho tài liệu và thư mục tài liệu: `api-specification.md`, `ui-ux/`.
- Với React component, dùng PascalCase cho component file: `Navbar.tsx`, `ContractPdfButton.tsx`.
- Tránh đặt khoảng trắng, dấu `/`, hoặc ký tự đặc biệt trong path.

## Phân nhóm frontend

- `components/ui/`: component nền tảng, ít phụ thuộc nghiệp vụ.
- `components/layout/`: navbar, footer, sidebar, shell.
- `components/features/`: component theo nghiệp vụ.
- `layouts/`: layout gắn với nhóm route.
- `styles/`: global CSS và theme layer.

## Phân nhóm backend

- `router.ts`: định nghĩa route, middleware và gọi service.
- `service.ts`: logic nghiệp vụ và thao tác database.
- `schema.ts`: Zod schema validate input.
