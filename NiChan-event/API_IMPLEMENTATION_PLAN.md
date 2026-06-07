# NiChan API Implementation Plan

## Companion Documents

- Detailed API contract: `API_SPECIFICATION.md`
- Backend database design lives in `NiChan-backend/DATABASE_DESIGN.md`

## Rules

- Only implement **1 module at a time**
- After finishing 1 module: stop, report, let user test
- Status:
  - `[ ]` not started
  - `[-]` in progress
  - `[x]` implemented and handed off for testing
  - `[!]` frontend still uses local page state or direct mock data

## Current State

- Backend now has only `GET /api/health`
- Prisma now has only `User`
- Frontend data comes from:
  - `src/services/api.ts` mock read APIs
  - `src/services/mockData.ts`
  - local page state in many admin/organizer pages for CRUD actions

## Suggested Order

1. Foundation
2. Public Content
3. Contact / Lead Intake
4. Admin Requests
5. Customer Event Workspace
6. Organizer Projects
7. Organizer Dashboard
8. Admin Dashboard
9. Admin Contracts
10. Admin Users
11. Organizer Staff
12. Organizer Budget
13. Admin Content
14. Organizer Vendors
15. Admin Finance
16. Organizer Reports
17. Admin Reports
18. Admin Staff
19. Admin Vendors
20. Customer Profile
21. Organizer Profile
22. Admin Profile

## Backlog

### 0. Foundation

- Status: `[ ]`
- Scope: response format, error handler, validation, pagination/filter/sort, auth-role skeleton, seed strategy
- Endpoints:
  - `GET /api/health`
  - `GET /api/meta/enums`

### 1. Public Content

- Status: `[ ]`
- Frontend pages:
  - `src/pages/Index.tsx`
  - `src/pages/Services.tsx`
  - `src/pages/ServiceDetail.tsx`
  - `src/pages/Portfolio.tsx`
  - `src/pages/Blog.tsx`
  - `src/pages/BlogDetail.tsx`
  - `src/pages/About.tsx`
- Frontend mock APIs:
  - `getPublicServices`
  - `getStats`
  - `getTestimonials`
  - `getPortfolioItems`
  - `getServiceCategories`
  - `getAllServices`
  - `getContentBlogPosts`
- Endpoints:
  - `GET /api/public/services/highlights`
  - `GET /api/public/services`
  - `GET /api/public/services/:slug`
  - `GET /api/public/service-categories`
  - `GET /api/public/stats`
  - `GET /api/public/testimonials`
  - `GET /api/public/portfolio`
  - `GET /api/public/blog-posts`
  - `GET /api/public/blog-posts/:id`

### 2. Contact / Lead Intake

- Status: `[ ]`
- Frontend pages:
  - `src/pages/Contact.tsx`
  - `src/pages/Register.tsx`
  - `src/pages/Login.tsx`
- Notes:
  - contact form needs write API
  - auth is UI-only right now
- Endpoints:
  - `POST /api/public/consultation-requests`
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`

### 3. Customer Event Workspace

- Status: `[ ]`
- Frontend pages:
  - `src/pages/customer/CustomerDashboard.tsx`
  - `src/pages/customer/MyEvents.tsx`
  - `src/pages/customer/EventTracking.tsx`
  - `src/pages/customer/MyContracts.tsx`
  - `src/pages/customer/ReviewRating.tsx`
- Frontend mock APIs:
  - `getCustomerEvents`
  - `getRecentActivities`
  - `getContracts`
  - `getReviews`
  - `getReviewCriteria`
  - `getMilestones`
  - `getChatMessages`
  - `getDocuments`
  - `getTransactions`
- Endpoints:
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

### 4. Customer Profile

- Status: `[ ]`
- Frontend page: `src/pages/customer/CustomerProfile.tsx`
- Endpoints:
  - `GET /api/customer/profile`
  - `PUT /api/customer/profile`
  - `PUT /api/customer/profile/password`

### 5. Organizer Dashboard

- Status: `[ ]`
- Frontend pages:
  - `src/pages/organizer/OrganizerDashboard.tsx`
  - `src/pages/organizer/OrganizerLayout.tsx`
  - `src/pages/organizer/OrganizerNotifications.tsx`
- Frontend mock APIs:
  - `getOrgProjectProgress`
  - `getTasksByStatus`
  - `getWeeklyWorkload`
  - `getUpcomingTasks`
  - `getOrganizerNotifications`
- Direct mock imports: `[!]`
  - `mockOrganizerNotifications`
  - `mockOrganizerAccounts`
- Endpoints:
  - `GET /api/organizer/dashboard`
  - `GET /api/organizer/notifications`
  - `PATCH /api/organizer/notifications/:id/read`
  - `PATCH /api/organizer/notifications/read-all`
  - `GET /api/organizer/me`

### 6. Organizer Projects

- Status: `[ ]`
- Frontend page: `src/pages/organizer/OrganizerProjects.tsx`
- Frontend mock APIs:
  - `getKanbanColumns`
  - `getGanttData`
- Notes: `[!]` UI has local create/edit/delete/move task state
- Endpoints:
  - `GET /api/organizer/projects`
  - `GET /api/organizer/projects/:projectId`
  - `GET /api/organizer/projects/:projectId/kanban`
  - `GET /api/organizer/projects/:projectId/gantt`
  - `POST /api/organizer/tasks`
  - `PUT /api/organizer/tasks/:taskId`
  - `PATCH /api/organizer/tasks/:taskId/status`
  - `DELETE /api/organizer/tasks/:taskId`

### 7. Organizer Staff

- Status: `[ ]`
- Frontend page: `src/pages/organizer/OrganizerStaff.tsx`
- Frontend mock APIs:
  - `getOrgStaff`
  - `getShifts`
- Endpoints:
  - `GET /api/organizer/staff`
  - `POST /api/organizer/staff`
  - `PUT /api/organizer/staff/:staffId`
  - `DELETE /api/organizer/staff/:staffId`
  - `GET /api/organizer/shifts`
  - `PUT /api/organizer/shifts/:shiftId`

### 8. Organizer Vendors

- Status: `[ ]`
- Frontend page: `src/pages/organizer/OrganizerVendors.tsx`
- Frontend mock APIs:
  - `getVendors`
  - `getVendorCategories`
- Endpoints:
  - `GET /api/organizer/vendors`
  - `GET /api/organizer/vendors/:vendorId`
  - `POST /api/organizer/vendors`
  - `PUT /api/organizer/vendors/:vendorId`
  - `DELETE /api/organizer/vendors/:vendorId`
  - `GET /api/organizer/vendor-categories`

### 9. Organizer Budget

- Status: `[ ]`
- Frontend page: `src/pages/organizer/OrganizerBudget.tsx`
- Frontend mock APIs:
  - `getProjectBudgets`
  - `getBudgetComparison`
- Notes: `[!]` UI edits budget items locally
- Endpoints:
  - `GET /api/organizer/budgets`
  - `GET /api/organizer/budgets/:projectId`
  - `POST /api/organizer/budget-items`
  - `PUT /api/organizer/budget-items/:itemId`
  - `DELETE /api/organizer/budget-items/:itemId`
  - `GET /api/organizer/budgets/comparison`

### 10. Organizer Reports

- Status: `[ ]`
- Frontend page: `src/pages/organizer/OrganizerReports.tsx`
- Frontend mock APIs:
  - `getCompletedEvents`
  - `getTaskCompletionData`
  - `getTeamKPIs`
- Endpoints:
  - `GET /api/organizer/reports/completed-events`
  - `GET /api/organizer/reports/task-completion`
  - `GET /api/organizer/reports/team-kpis`

### 11. Organizer Profile

- Status: `[ ]`
- Frontend page: `src/pages/organizer/OrganizerProfile.tsx`
- Direct mock imports: `[!]`
  - `mockOrganizerAccounts`
- Endpoints:
  - `GET /api/organizer/profile`
  - `PUT /api/organizer/profile`
  - `PUT /api/organizer/profile/password`

### 12. Admin Dashboard

- Status: `[ ]`
- Frontend pages:
  - `src/pages/admin/AdminDashboard.tsx`
  - `src/pages/admin/AdminLayout.tsx`
  - `src/pages/admin/AdminNotifications.tsx`
- Frontend mock APIs:
  - `getAdminNotifications`
  - `getMonthlyRevenue`
  - `getEventTypes`
  - `getAdminRecentRequests`
  - `getAdminUpcomingEvents`
- Direct mock imports: `[!]`
  - `mockAdminNotifications`
- Endpoints:
  - `GET /api/admin/dashboard`
  - `GET /api/admin/notifications`
  - `PATCH /api/admin/notifications/:id/read`
  - `PATCH /api/admin/notifications/read-all`

### 13. Admin Requests

- Status: `[ ]`
- Frontend page: `src/pages/admin/AdminRequests.tsx`
- Frontend mock APIs:
  - `getAdminRequests`
  - `getAdminManagers`
- Notes: `[!]` UI supports filter, view, assign manager, change status, delete
- Endpoints:
  - `GET /api/admin/requests`
  - `GET /api/admin/requests/:requestId`
  - `POST /api/admin/requests`
  - `PATCH /api/admin/requests/:requestId/status`
  - `PATCH /api/admin/requests/:requestId/assign-manager`
  - `DELETE /api/admin/requests/:requestId`
  - `GET /api/admin/managers`

### 14. Admin Users

- Status: `[ ]`
- Frontend page: `src/pages/admin/AdminUsers.tsx`
- Frontend mock API:
  - `getAdminUsers`
- Endpoints:
  - `GET /api/admin/users`
  - `GET /api/admin/users/:userId`
  - `POST /api/admin/users`
  - `PUT /api/admin/users/:userId`
  - `PATCH /api/admin/users/:userId/status`
  - `PATCH /api/admin/users/:userId/role`
  - `DELETE /api/admin/users/:userId`

### 15. Admin Contracts

- Status: `[ ]`
- Frontend page: `src/pages/admin/AdminContracts.tsx`
- Frontend mock API:
  - `getAdminContracts`
- Notes: `[!]` UI supports create/edit/delete/view/send
- Endpoints:
  - `GET /api/admin/contracts`
  - `GET /api/admin/contracts/:contractId`
  - `POST /api/admin/contracts`
  - `PUT /api/admin/contracts/:contractId`
  - `PATCH /api/admin/contracts/:contractId/send`
  - `DELETE /api/admin/contracts/:contractId`

### 16. Admin Finance

- Status: `[ ]`
- Frontend page: `src/pages/admin/AdminFinance.tsx`
- Frontend mock APIs:
  - `getProjectFinance`
  - `getMonthlyPL`
  - `getExpenses`
- Endpoints:
  - `GET /api/admin/finance/project-summary`
  - `GET /api/admin/finance/monthly-pl`
  - `GET /api/admin/finance/expenses`

### 17. Admin Content

- Status: `[ ]`
- Frontend page: `src/pages/admin/AdminContent.tsx`
- Frontend mock APIs:
  - `getContentPortfolio`
  - `getContentBlogPosts`
  - `getContentReviews`
- Notes: `[!]` UI supports CRUD portfolio/blog, review approval, service category management
- Endpoints:
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

### 18. Admin Projects

- Status: `[ ]`
- Frontend page: `src/pages/admin/AdminProjects.tsx`
- Notes: `[!]` page uses local kanban/task state
- Endpoints:
  - `GET /api/admin/projects`
  - `GET /api/admin/projects/:projectId/tasks`
  - `POST /api/admin/projects/:projectId/tasks`
  - `PUT /api/admin/tasks/:taskId`
  - `PATCH /api/admin/tasks/:taskId/status`
  - `DELETE /api/admin/tasks/:taskId`

### 19. Admin Staff

- Status: `[ ]`
- Frontend page: `src/pages/admin/AdminStaff.tsx`
- Notes: `[!]` page already has local CRUD and status toggle
- Endpoints:
  - `GET /api/admin/staff`
  - `POST /api/admin/staff`
  - `PUT /api/admin/staff/:staffId`
  - `PATCH /api/admin/staff/:staffId/status`
  - `DELETE /api/admin/staff/:staffId`
  - `GET /api/admin/staff/schedule`

### 20. Admin Vendors

- Status: `[ ]`
- Frontend page: `src/pages/admin/AdminVendors.tsx`
- Endpoints:
  - `GET /api/admin/vendors`
  - `POST /api/admin/vendors`
  - `PUT /api/admin/vendors/:vendorId`
  - `PATCH /api/admin/vendors/:vendorId/status`
  - `DELETE /api/admin/vendors/:vendorId`

### 21. Admin Reports

- Status: `[ ]`
- Frontend page: `src/pages/admin/AdminReports.tsx`
- Frontend mock APIs:
  - `getConversionData`
  - `getRevenueByType`
  - `getTopEvents`
  - `getStaffPerformance`
- Endpoints:
  - `GET /api/admin/reports/conversion`
  - `GET /api/admin/reports/revenue-by-type`
  - `GET /api/admin/reports/top-events`
  - `GET /api/admin/reports/staff-performance`

### 22. Admin Profile

- Status: `[ ]`
- Frontend page: `src/pages/admin/AdminProfile.tsx`
- Endpoints:
  - `GET /api/admin/profile`
  - `PUT /api/admin/profile`
  - `PUT /api/admin/profile/password`

## Delivery Rule For Future Turns

- Mark only one module as `[-]` or `[x]` in each implementation round
- After implementation, report:
  - module name
  - added endpoints
  - changed backend files
  - quick test steps
- Do not continue to the next module until the user confirms
