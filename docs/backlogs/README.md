# Backlogs

Thư mục này chỉ dùng khi team muốn lưu backlog trực tiếp trong repo. Nếu backlog chính đang được quản lý bằng Jira, Trello, Notion hoặc GitHub Issues thì dùng file này như trang điều hướng và đặt link tới nguồn chính, không tạo bản sao trong repo.

## Khi nào tạo sprint trong repo

Tạo thư mục sprint khi cần nộp tài liệu, audit quy trình hoặc muốn version-control planning cùng source code.

Quy ước đặt tên:

```text
docs/backlogs/
├── README.md
└── sprint-YYYY-MM-DD/
    ├── stories.md
    ├── tasks.md
    └── retrospective.md
```

## Mẫu nội dung sprint

### stories.md

```md
# Sprint YYYY-MM-DD

## Goal

Mục tiêu sprint.

## User Stories

| ID | Story | Priority | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- |
| US-001 | Là một ..., tôi muốn ... để ... | High | ... | Todo |
```

### tasks.md

```md
# Tasks

| ID | Task | Owner | Estimate | Status | Related Story |
| --- | --- | --- | --- | --- | --- |
| T-001 | ... | ... | ... | Todo | US-001 |
```

### retrospective.md

```md
# Retrospective

## Went Well

## Could Improve

## Action Items
```
