# Kịch bản thuyết trình báo cáo thực tập IOC

> Thay các nội dung trong dấu `[ ... ]` trước khi thuyết trình.
>
> Thời lượng đề xuất: 15–18 phút trình bày, 5–7 phút demo và Q&A.

## Slide 1 — Giới thiệu

**Nội dung cần điền trên slide**

- Họ và tên: `[Họ và tên]`
- Trường/Lớp: `[Trường – Lớp]`
- Thời gian thực tập: `[Tháng/Năm] – [Tháng/Năm]`

**Kịch bản nói**

> Em xin kính chào quý thầy cô và các anh chị trong hội đồng.
>
> Em tên là **[Họ và tên]**, sinh viên **[Trường – Lớp]**. Hôm nay, em xin trình
> bày báo cáo tổng kết kỳ thực tập tại **Internship OneConnect, viết tắt là IOC**,
> với vị trí **Fullstack Developer**.
>
> Trong thời gian từ **[Tháng/Năm] đến [Tháng/Năm]**, em đã thực hiện dự án
> **NiChan Event Management System**, một hệ thống quản lý và tổ chức sự kiện
> trên nền tảng web.
>
> Nội dung trình bày gồm mục tiêu dự án, thiết kế hệ thống, công nghệ sử dụng,
> quá trình quản lý dự án theo Agile/Scrum, phần demo sản phẩm và cuối cùng là
> những kết quả em đã đạt được sau kỳ thực tập.

**Chuyển slide**

> Đầu tiên, em xin giới thiệu bài toán mà dự án NiChan hướng đến.

---

## Slide 2 — Mục tiêu và phạm vi dự án

**Kịch bản nói**

> Trong thực tế, quá trình tổ chức sự kiện thường sử dụng nhiều công cụ rời rạc.
> Thông tin khách hàng có thể được lưu ở một nơi, tiến độ công việc ở một nơi,
> còn hợp đồng, ngân sách và thanh toán lại được theo dõi bằng các file riêng.
> Điều này làm dữ liệu bị phân tán, khó kiểm soát tiến độ và thiếu minh bạch về
> chi phí.
>
> NiChan được xây dựng để số hóa toàn bộ quy trình đó trên một nền tảng duy
> nhất. Hệ thống kết nối ba vai trò chính là **Khách hàng, Organizer và Admin**.
>
> Khách hàng có thể gửi yêu cầu tư vấn, theo dõi sự kiện, phản hồi hợp đồng,
> thanh toán và đánh giá. Organizer quản lý dự án, công việc, nhà cung cấp,
> ngân sách và trao đổi với khách hàng. Admin chịu trách nhiệm quản trị yêu cầu,
> người dùng, hợp đồng, tài chính và nội dung hệ thống.
>
> Đây là một **Solo Project**. Em làm việc độc lập 100% trong toàn bộ vòng đời
> phát triển, từ phân tích yêu cầu, thiết kế UI/UX và cơ sở dữ liệu, xây dựng
> Backend, Frontend, tích hợp hệ thống đến kiểm thử và hoàn thiện sản phẩm.

**Điểm cần nhấn mạnh**

> Phạm vi này giúp em không chỉ học cách viết từng chức năng riêng lẻ mà còn
> hiểu cách một sản phẩm full-stack được thiết kế và vận hành xuyên suốt.

**Chuyển slide**

> Từ phạm vi đó, em xác định các tương tác chính của từng vai trò qua biểu đồ
> Use Case.

---

## Slide 3 — Biểu đồ Use Case

**Kịch bản nói**

> Biểu đồ Use Case thể hiện ba actor chính trong hệ thống.
>
> Với **Khách hàng**, các chức năng quan trọng gồm gửi yêu cầu tư vấn, theo dõi
> tiến độ sự kiện, xem và phản hồi hợp đồng, thanh toán và đánh giá sau sự kiện.
>
> Với **Organizer**, hệ thống hỗ trợ quản lý dự án, quản lý công việc, nhà cung
> cấp, ngân sách và theo dõi báo cáo.
>
> Với **Admin**, các chức năng chính là xử lý yêu cầu tư vấn, quản lý người dùng,
> hợp đồng, tài chính, nội dung và báo cáo thống kê.
>
> Ngoài ra, cả ba vai trò đều sử dụng các chức năng chung như đăng nhập, quản lý
> hồ sơ, nhận thông báo và chat.
>
> Điểm quan trọng của thiết kế này là mỗi vai trò chỉ được truy cập đúng phạm vi
> nghiệp vụ của mình. Việc phân quyền được kiểm tra ở cả giao diện và Backend.

**Chuyển slide**

> Sau khi xác định hành vi người dùng, em chuyển các yêu cầu nghiệp vụ thành mô
> hình dữ liệu.

---

## Slide 4 — Mô hình thực thể kết hợp ERD

**Kịch bản nói**

> Đây là các bảng dữ liệu trọng tâm của hệ thống. **Event** là thực thể trung
> tâm, đại diện cho một sự kiện được khách hàng yêu cầu và Organizer phụ trách.
>
> Bảng **User** liên kết với Event qua hai khóa ngoại:
> `customerUserId` xác định khách hàng sở hữu sự kiện và `organizerUserId` xác
> định Organizer phụ trách.
>
> Một Event có thể có nhiều **Contract**, **PaymentOrder** và
> **ProjectBudget**. Contract lưu trạng thái và tổng giá trị hợp đồng.
> PaymentOrder lưu lệnh thanh toán, còn Transaction ghi nhận giao dịch thực tế
> nhận từ SePay.
>
> Phần ngân sách được tách thành ProjectBudget và BudgetItem để theo dõi chi phí
> dự kiến, chi phí thực tế và nhà cung cấp tương ứng.
>
> Quan hệ giữa Event và Vendor là quan hệ nhiều–nhiều, vì một sự kiện có thể
> sử dụng nhiều nhà cung cấp và một nhà cung cấp có thể tham gia nhiều sự kiện.
> Vì vậy, hệ thống sử dụng bảng nối **EventVendor**.
>
> Thiết kế này giúp dữ liệu ít trùng lặp, dễ truy vấn và hỗ trợ mở rộng thêm các
> module nghiệp vụ sau này.

**Chuyển slide**

> Từ mô hình dữ liệu này, em xây dựng kiến trúc full-stack theo các lớp rõ ràng.

---

## Slide 5 — Sơ đồ kiến trúc hệ thống

**Kịch bản nói**

> Kiến trúc hệ thống gồm bốn phần chính.
>
> Thứ nhất là **người dùng**, gồm Khách hàng, Organizer và Admin, truy cập hệ
> thống thông qua trình duyệt.
>
> Thứ hai là **Frontend**, được xây dựng dưới dạng React SPA. Frontend phụ trách
> giao diện, định tuyến, quản lý trạng thái và gửi yêu cầu đến Backend thông qua
> REST API. Riêng chat và thông báo sử dụng kết nối Socket.IO.
>
> Thứ ba là **Backend Node.js và Express**. Mỗi nhóm nghiệp vụ được tách thành
> router và service riêng. Trước khi xử lý nghiệp vụ, request đi qua các
> middleware xác thực JWT, kiểm tra vai trò và kiểm tra dữ liệu đầu vào.
>
> Backend sử dụng Prisma ORM để truy cập PostgreSQL. Socket.IO chạy trên cùng
> HTTP server để phục vụ chat và thông báo thời gian thực.
>
> Cuối cùng là tầng dữ liệu và dịch vụ ngoài. PostgreSQL lưu dữ liệu chính,
> Cloudinary lưu ảnh và tài liệu, SMTP dùng để gửi email, còn SePay hỗ trợ tạo
> mã QR và gửi webhook khi có giao dịch.
>
> Cách tách lớp này giúp mã nguồn dễ bảo trì, dễ kiểm thử và hạn chế việc giao
> diện phụ thuộc trực tiếp vào cách dữ liệu được lưu trữ.

**Chuyển slide**

> Để hiện thực hóa kiến trúc trên, em sử dụng bộ công nghệ sau.

---

## Slide 6 — Công nghệ sử dụng

**Kịch bản nói**

> Ở Frontend, em sử dụng **React 18 và TypeScript**, kết hợp Vite để phát triển
> và build ứng dụng. React Router xử lý điều hướng, Tailwind CSS và Radix UI hỗ
> trợ xây dựng giao diện, còn React Query quản lý việc gọi API và cache dữ liệu.
>
> Ở Backend, em sử dụng **Node.js, Express và TypeScript**. Prisma ORM làm lớp
> truy cập dữ liệu. JWT và bcrypt được dùng cho xác thực và bảo vệ mật khẩu.
> Socket.IO hỗ trợ chat và thông báo realtime.
>
> Hệ thống sử dụng **PostgreSQL** làm cơ sở dữ liệu. Các dịch vụ tích hợp gồm
> Cloudinary cho upload, Nodemailer cho email và SePay cho thanh toán.
>
> Toàn bộ dự án được tổ chức dưới dạng monorepo bằng npm Workspaces và
> Turborepo. Vitest được sử dụng cho unit test, Playwright cho kiểm thử
> end-to-end và ESLint để kiểm tra chất lượng mã nguồn.
>
> Một điểm thuận lợi là TypeScript được dùng thống nhất từ Frontend đến Backend,
> giúp giảm lỗi kiểu dữ liệu khi tích hợp API.

**Chuyển slide**

> Về cách quản lý tiến độ, em áp dụng tư duy Agile/Scrum và chia quá trình phát
> triển thành các Sprint theo nhóm giá trị.

---

## Slide 7 — Quản lý dự án với Agile/Scrum

**Kịch bản nói**

> Product Backlog được nhóm thành sáu Epic chính: tài khoản và phân quyền, trải
> nghiệm khách hàng, quản lý dự án sự kiện, quản trị hệ thống, hợp đồng và tài
> chính, cùng với giao tiếp thời gian thực.
>
> Từ các Epic này, em chia quá trình triển khai thành **sáu Sprint**.
>
> **Sprint 1** tập trung khởi tạo monorepo, kiến trúc và giao diện nền tảng.
>
> **Sprint 2** hoàn thiện các màn hình cốt lõi như dashboard, hợp đồng, tài chính
> và giao tiếp.
>
> **Sprint 3** tập trung vào nghiệp vụ vận hành, gồm dự án, nhà cung cấp, ngân
> sách và phân công.
>
> **Sprint 4** kết nối API cho các vai trò và bổ sung quy trình hạng mục hợp
> đồng.
>
> **Sprint 5** hoàn thiện xác thực, hợp đồng và chat thời gian thực.
>
> **Sprint 6** tích hợp thanh toán SePay, hoàn thiện phân công và ổn định hệ
> thống.
>
> Sau mỗi giai đoạn, em kiểm tra lại luồng nghiệp vụ và điều chỉnh backlog.
> Do dự án được thực hiện cá nhân, em đồng thời đảm nhiệm Product Owner,
> Developer và Tester. Các Sprint Goal trên được tổng hợp từ lịch sử triển khai
> trong repository.

**Chuyển slide**

> Tiếp theo, em xin demo các luồng nghiệp vụ tiêu biểu của sản phẩm.

---

## Slide 8 — Demo sản phẩm

**Mở đầu phần demo**

> Trong phần demo, thay vì đi qua toàn bộ màn hình, em sẽ tập trung vào một luồng
> nghiệp vụ xuyên suốt từ yêu cầu của khách hàng đến quản lý và thanh toán.

### Luồng demo đề xuất

#### Bước 1 — Khách hàng

> Đầu tiên, em đăng nhập bằng tài khoản Khách hàng.
>
> Tại dashboard, khách hàng có thể xem các sự kiện đang diễn ra và trạng thái
> hiện tại. Em mở một sự kiện để xem tiến độ, các hoạt động gần đây và thông tin
> hợp đồng.
>
> Khách hàng có thể phản hồi hợp đồng, theo dõi các khoản thanh toán và gửi đánh
> giá sau khi sự kiện hoàn tất.

#### Bước 2 — Organizer

> Tiếp theo, em chuyển sang vai trò Organizer.
>
> Organizer có thể xem các dự án được phân công, quản lý công việc và cập nhật
> trạng thái tiến độ. Tại phần Vendor, Organizer lựa chọn nhà cung cấp cho sự
> kiện. Tại phần Budget, Organizer theo dõi chi phí dự kiến và chi phí thực tế.
>
> Em cũng có thể mở phần Communication để gửi tin nhắn. Tin nhắn mới được cập
> nhật theo thời gian thực thông qua Socket.IO.

#### Bước 3 — Admin

> Cuối cùng, em chuyển sang vai trò Admin.
>
> Admin tiếp nhận yêu cầu tư vấn, quản lý người dùng và dự án, tạo hợp đồng,
> theo dõi tình hình tài chính và quản lý nội dung hiển thị công khai.

#### Bước 4 — Thanh toán

> Với luồng thanh toán, hệ thống tạo một PaymentOrder và mã QR chứa đúng số tiền
> cùng nội dung chuyển khoản.
>
> Khi SePay gửi webhook, Backend xác thực dữ liệu, tìm mã đơn trong nội dung giao
> dịch, kiểm tra số tiền và cập nhật PaymentOrder trong một database
> transaction. Sau đó hệ thống gửi thông báo realtime cho các bên liên quan.

**Phương án khi demo gặp lỗi mạng**

> Trong trường hợp dịch vụ ngoài không phản hồi, em sẽ trình bày dữ liệu đã được
> chuẩn bị và giải thích luồng xử lý dựa trên source code, để phần demo không bị
> gián đoạn.

**Chuyển phần**

> Sau phần giao diện, em xin trình bày ngắn gọn cách tổ chức source code.

---

## Slide 9 — Cấu trúc source code

**Kịch bản nói**

> Dự án được tổ chức dưới dạng monorepo gồm hai workspace chính.
>
> Thư mục **NiChan-event** chứa Frontend React. Trong `src`, phần `pages` được
> chia theo Admin, Customer và Organizer. `components` chứa UI dùng chung và
> component theo tính năng. `services` chứa API client, payment và socket.
> `contexts` cùng `hooks` quản lý xác thực và logic tái sử dụng.
>
> Thư mục **NiChan-backend** chứa Backend Express. `src/modules` được chia theo
> domain nghiệp vụ. Mỗi module thường có router để khai báo endpoint và service
> để xử lý nghiệp vụ. `middleware` chứa xác thực, validation và error handler.
> `lib` chứa Prisma, JWT, Socket.IO, email và Cloudinary.
>
> Thư mục `prisma` chứa schema, migration và seed data. Các tài liệu thiết kế,
> API, ERD và slide được lưu trong `docs`.
>
> Cách tổ chức này giúp mỗi domain có phạm vi rõ ràng, dễ tìm kiếm và hạn chế
> việc một file xử lý quá nhiều trách nhiệm.

**Các file nên mở khi trình bày**

1. `NiChan-event/src/services/apiClient.ts`
2. `NiChan-backend/src/routes/index.ts`
3. `NiChan-backend/src/modules/shared/payment.service.ts`
4. `NiChan-backend/src/lib/socket.ts`
5. `NiChan-backend/prisma/schema.prisma`

**Chuyển phần**

> Bên cạnh chức năng, em cũng triển khai một số biện pháp bảo mật ở cả API và
> quy trình thanh toán.

---

## Slide 10 — Bảo mật hệ thống

**Kịch bản nói**

> Về bảo mật, mật khẩu không được lưu trực tiếp mà được băm bằng bcrypt.
> Sau khi đăng nhập, người dùng nhận JWT và gửi token trong header
> Authorization.
>
> Backend kiểm tra cả xác thực và vai trò trước khi cho phép truy cập endpoint.
> Dữ liệu đầu vào được kiểm tra bằng Zod. Helmet bổ sung các HTTP security
> header, còn CORS giới hạn nguồn được phép gọi API.
>
> Prisma sử dụng parameterized query, giúp giảm nguy cơ SQL Injection.
> Thao tác upload giới hạn loại file và dung lượng tối đa.
>
> Đối với SePay webhook, hệ thống kiểm tra API key hoặc nguồn gửi, chống xử lý
> trùng bằng `sepayTransId`, so khớp mã đơn và số tiền trước khi cập nhật trạng
> thái. Các cập nhật liên quan được thực hiện trong database transaction để đảm
> bảo tính nhất quán.
>
> Trong production, các khóa bí mật như JWT secret, SMTP password và SePay API
> key được lưu bằng biến môi trường và không commit vào source code.

**Chuyển slide**

> Sau đây là phần kết luận và những điều em đã tích lũy được từ dự án.

---

## Slide 11 — Kết luận

**Kịch bản nói**

> Sau kỳ thực tập, em đã hoàn thiện một nền tảng quản lý sự kiện full-stack với
> các quy trình chính từ tiếp nhận yêu cầu, quản lý dự án, nhà cung cấp, ngân
> sách, hợp đồng đến thanh toán và đánh giá.
>
> Về sự tiến bộ của bản thân, trước hết em đã hình thành tư duy hệ thống rõ ràng
> hơn. Em biết bắt đầu từ yêu cầu nghiệp vụ, thiết kế dữ liệu, xác định API rồi
> mới triển khai giao diện và tích hợp.
>
> Thứ hai, năng lực full-stack của em đã toàn diện hơn vì em trực tiếp làm việc
> với Frontend, Backend, cơ sở dữ liệu và các dịch vụ bên ngoài.
>
> Thứ ba, khả năng giải quyết vấn đề của em được cải thiện thông qua quá trình
> debug, kiểm thử và xử lý các tình huống liên quan đến xác thực, realtime,
> upload và webhook thanh toán.
>
> Những kiến thức mới em tích lũy được gồm React Query, Prisma, JWT và RBAC,
> Socket.IO, database transaction, Cloudinary, SMTP và tích hợp SePay.
>
> Quan trọng nhất, từ một ý tưởng ban đầu, em đã có thể tự xây dựng một sản phẩm
> end-to-end và sẵn sàng tiếp tục phát triển hệ thống ở quy mô lớn hơn.

**Chuyển slide**

> Trên đây là toàn bộ phần trình bày của em.

---

## Slide 12 — Lời cảm ơn và Q&A

**Kịch bản nói**

> Em xin chân thành cảm ơn Internship OneConnect, các anh chị hướng dẫn và quý
> thầy cô đã tạo điều kiện để em học hỏi và hoàn thành kỳ thực tập.
>
> Em cũng xin cảm ơn hội đồng đã lắng nghe phần trình bày.
>
> Em xin kết thúc báo cáo tại đây và sẵn sàng trả lời các câu hỏi từ hội đồng.

---

# Câu hỏi Q&A dự kiến

## 1. Vì sao chọn kiến trúc monolith thay vì microservices?

> Với phạm vi Solo Project, modular monolith phù hợp hơn vì giảm chi phí triển
> khai và vận hành nhưng vẫn giữ được ranh giới module rõ ràng. Khi lưu lượng
> hoặc đội ngũ tăng, các module như payment, notification hoặc chat có thể được
> tách thành service riêng.

## 2. Vì sao chọn PostgreSQL và Prisma?

> Dữ liệu của hệ thống có nhiều quan hệ chặt chẽ như Event, Contract, Budget và
> Payment nên cơ sở dữ liệu quan hệ phù hợp. PostgreSQL hỗ trợ transaction tốt,
> còn Prisma cung cấp type-safe query và migration thuận tiện với TypeScript.

## 3. Hệ thống phân quyền như thế nào?

> JWT chứa user ID và role. Middleware xác thực token trước, sau đó role guard
> kiểm tra quyền truy cập endpoint. Frontend cũng ẩn route không phù hợp, nhưng
> Backend mới là lớp quyết định cuối cùng.

## 4. Làm sao tránh webhook thanh toán bị xử lý hai lần?

> Hệ thống lưu `sepayTransId` với ràng buộc unique, kiểm tra trạng thái đơn trước
> khi xử lý và thực hiện cập nhật trong database transaction. Vì vậy cùng một
> giao dịch sẽ không được ghi nhận hai lần.

## 5. Vì sao dùng Socket.IO?

> Socket.IO đơn giản hóa kết nối realtime, tự xử lý reconnect và hỗ trợ room.
> Mỗi sự kiện có một room riêng để giới hạn phạm vi phát tin nhắn.

## 6. Khó khăn lớn nhất của dự án là gì?

> Khó khăn lớn nhất là duy trì tính nhất quán giữa nhiều luồng nghiệp vụ có liên
> quan, đặc biệt là hợp đồng, ngân sách và thanh toán. Em giải quyết bằng cách
> tách nghiệp vụ thành service, chuẩn hóa response, kiểm tra quyền truy cập và
> sử dụng transaction cho các cập nhật quan trọng.

## 7. Nếu có thêm thời gian, em sẽ cải tiến gì?

> Em sẽ tăng độ phủ kiểm thử, bổ sung refresh token, rate limiting, audit log,
> background job cho email và notification, CI/CD, monitoring và triển khai
> production bằng container.

## 8. Dự án cá nhân áp dụng Scrum như thế nào?

> Em sử dụng các thành phần phù hợp như Product Backlog, User Story, Sprint Goal,
> triển khai tăng dần và review sau mỗi giai đoạn. Do chỉ có một thành viên, em
> không áp dụng máy móc toàn bộ ceremony của Scrum team mà tập trung vào tính
> minh bạch của backlog và mục tiêu từng Sprint.

