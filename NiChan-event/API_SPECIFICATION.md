# NiChan API Specification

Ban frontend doc nay de doi chieu voi backend.
No khong thay the implementation plan, ma bo sung contract chi tiet cho request, response va error.

## Standard success envelope

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

## Standard error envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body is invalid",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  }
}
```

## Common error codes

- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`
- `INVALID_STATUS_TRANSITION`
- `INTERNAL_SERVER_ERROR`

## Global rules

- Base URL: `/api`
- IDs: UUID string unless legacy business code is exposed as display field
- Timestamps: ISO 8601 UTC
- Pagination query:
  - `page`
  - `pageSize`
  - `sortBy`
  - `sortOrder`

## Module summary

### Public Content

- `GET /api/public/services`
- `GET /api/public/services/:slug`
- `GET /api/public/service-categories`
- `GET /api/public/stats`
- `GET /api/public/testimonials`
- `GET /api/public/portfolio`
- `GET /api/public/blog-posts`
- `GET /api/public/blog-posts/:id`

Key response shape for service list item:

```json
{
  "id": "uuid",
  "title": "Tiệc Cưới Truyền Thống",
  "slug": "tiec-cuoi-truyen-thong",
  "category": "Tiệc cưới",
  "priceRange": {
    "from": 150000000,
    "to": 300000000,
    "label": "150 - 300 triệu"
  },
  "guestRange": {
    "from": 100,
    "to": 300,
    "label": "100-300"
  },
  "location": "TP.HCM",
  "imageUrl": "https://...",
  "shortDescription": "..."
}
```

### Contact / Lead Intake

- `POST /api/public/consultation-requests`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Consultation request body:

```json
{
  "customerName": "Nguyen Van A",
  "phone": "0901234567",
  "email": "a@example.com",
  "eventType": "Tiệc cưới",
  "eventDate": "2026-08-20",
  "guestCount": 300,
  "budgetRange": "200-300tr",
  "location": "TP.HCM",
  "note": "Can venue trong nha"
}
```

### Customer Event Workspace

- `GET /api/customer/dashboard`
- `GET /api/customer/events`
- `GET /api/customer/events/:eventId`
- `GET /api/customer/events/:eventId/milestones`
- `GET /api/customer/events/:eventId/activities`
- `GET /api/customer/events/:eventId/chat-messages`
- `POST /api/customer/events/:eventId/chat-messages`
- `GET /api/customer/contracts`
- `GET /api/customer/contracts/:contractId`
- `GET /api/customer/documents`
- `GET /api/customer/transactions`
- `GET /api/customer/reviews`
- `GET /api/customer/review-criteria`
- `POST /api/customer/reviews`
- `PUT /api/customer/reviews/:reviewId`

Review submit body:

```json
{
  "eventId": "uuid",
  "ratingOverall": 5,
  "comment": "Rat hai long",
  "criteriaScores": [
    { "key": "venue", "score": 5 },
    { "key": "service", "score": 5 }
  ]
}
```

### Organizer

- Dashboard:
  - `GET /api/organizer/dashboard`
  - `GET /api/organizer/notifications`
  - `PATCH /api/organizer/notifications/:id/read`
  - `PATCH /api/organizer/notifications/read-all`
  - `GET /api/organizer/me`
- Projects:
  - `GET /api/organizer/projects`
  - `GET /api/organizer/projects/:projectId`
  - `GET /api/organizer/projects/:projectId/kanban`
  - `GET /api/organizer/projects/:projectId/gantt`
  - `POST /api/organizer/tasks`
  - `PUT /api/organizer/tasks/:taskId`
  - `PATCH /api/organizer/tasks/:taskId/status`
  - `DELETE /api/organizer/tasks/:taskId`
- Staff:
  - `GET /api/organizer/staff`
  - `POST /api/organizer/staff`
  - `PUT /api/organizer/staff/:staffId`
  - `DELETE /api/organizer/staff/:staffId`
  - `GET /api/organizer/shifts`
  - `PUT /api/organizer/shifts/:shiftId`
- Vendors:
  - `GET /api/organizer/vendors`
  - `GET /api/organizer/vendors/:vendorId`
  - `POST /api/organizer/vendors`
  - `PUT /api/organizer/vendors/:vendorId`
  - `DELETE /api/organizer/vendors/:vendorId`
  - `GET /api/organizer/vendor-categories`
- Budget:
  - `GET /api/organizer/budgets`
  - `GET /api/organizer/budgets/:projectId`
  - `POST /api/organizer/budget-items`
  - `PUT /api/organizer/budget-items/:itemId`
  - `DELETE /api/organizer/budget-items/:itemId`
  - `GET /api/organizer/budgets/comparison`
- Reports:
  - `GET /api/organizer/reports/completed-events`
  - `GET /api/organizer/reports/task-completion`
  - `GET /api/organizer/reports/team-kpis`
- Profile:
  - `GET /api/organizer/profile`
  - `PUT /api/organizer/profile`
  - `PUT /api/organizer/profile/password`

Task create body:

```json
{
  "eventId": "uuid",
  "title": "Dat venue",
  "assigneeUserId": "uuid",
  "dueAt": "2026-05-01T09:00:00.000Z",
  "priority": "high",
  "status": "todo"
}
```

### Admin

- Dashboard:
  - `GET /api/admin/dashboard`
  - `GET /api/admin/notifications`
  - `PATCH /api/admin/notifications/:id/read`
  - `PATCH /api/admin/notifications/read-all`
- Requests:
  - `GET /api/admin/requests`
  - `GET /api/admin/requests/:requestId`
  - `POST /api/admin/requests`
  - `PATCH /api/admin/requests/:requestId/status`
  - `PATCH /api/admin/requests/:requestId/assign-manager`
  - `DELETE /api/admin/requests/:requestId`
  - `GET /api/admin/managers`
- Users:
  - `GET /api/admin/users`
  - `GET /api/admin/users/:userId`
  - `POST /api/admin/users`
  - `PUT /api/admin/users/:userId`
  - `PATCH /api/admin/users/:userId/status`
  - `PATCH /api/admin/users/:userId/role`
  - `DELETE /api/admin/users/:userId`
- Contracts:
  - `GET /api/admin/contracts`
  - `GET /api/admin/contracts/:contractId`
  - `POST /api/admin/contracts`
  - `PUT /api/admin/contracts/:contractId`
  - `PATCH /api/admin/contracts/:contractId/send`
  - `DELETE /api/admin/contracts/:contractId`
- Finance:
  - `GET /api/admin/finance/project-summary`
  - `GET /api/admin/finance/monthly-pl`
  - `GET /api/admin/finance/expenses`
- Content:
  - `GET /api/admin/content/portfolio`
  - `POST /api/admin/content/portfolio`
  - `PUT /api/admin/content/portfolio/:id`
  - `PATCH /api/admin/content/portfolio/:id/status`
  - `DELETE /api/admin/content/portfolio/:id`
  - `GET /api/admin/content/blog-posts`
  - `POST /api/admin/content/blog-posts`
  - `PUT /api/admin/content/blog-posts/:id`
  - `DELETE /api/admin/content/blog-posts/:id`
  - `GET /api/admin/content/reviews`
  - `PATCH /api/admin/content/reviews/:id/approve`
  - `DELETE /api/admin/content/reviews/:id`
  - `GET /api/admin/content/service-categories`
  - `POST /api/admin/content/service-categories`
  - `DELETE /api/admin/content/service-categories/:id`
- Projects:
  - `GET /api/admin/projects`
  - `GET /api/admin/projects/:projectId/tasks`
  - `POST /api/admin/projects/:projectId/tasks`
  - `PUT /api/admin/tasks/:taskId`
  - `PATCH /api/admin/tasks/:taskId/status`
  - `DELETE /api/admin/tasks/:taskId`
- Staff:
  - `GET /api/admin/staff`
  - `POST /api/admin/staff`
  - `PUT /api/admin/staff/:staffId`
  - `PATCH /api/admin/staff/:staffId/status`
  - `DELETE /api/admin/staff/:staffId`
  - `GET /api/admin/staff/schedule`
- Vendors:
  - `GET /api/admin/vendors`
  - `POST /api/admin/vendors`
  - `PUT /api/admin/vendors/:vendorId`
  - `PATCH /api/admin/vendors/:vendorId/status`
  - `DELETE /api/admin/vendors/:vendorId`
- Reports:
  - `GET /api/admin/reports/conversion`
  - `GET /api/admin/reports/revenue-by-type`
  - `GET /api/admin/reports/top-events`
  - `GET /api/admin/reports/staff-performance`
- Profile:
  - `GET /api/admin/profile`
  - `PUT /api/admin/profile`
  - `PUT /api/admin/profile/password`

Assign manager body:

```json
{
  "managerUserId": "uuid"
}
```

Contract create body:

```json
{
  "eventId": "uuid",
  "customerUserId": "uuid",
  "totalValue": 250000000,
  "versionLabel": "1.0",
  "scopeText": "Tron goi tiec cuoi 300 khach",
  "paymentTerms": "30-40-30",
  "generalTerms": "..."
}
```

## Important note

`API_IMPLEMENTATION_PLAN.md` is for module order and progress.
This file is for request/response/error contract.
Backend should not implement a module if both docs are still missing details.
