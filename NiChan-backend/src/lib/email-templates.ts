import { env } from "../config/env";

// ─── Shared Layout ────────────────────────────────────────────────────────────

const layout = (content: string) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f1ee;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f1ee;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#8b6f4e,#a0845c);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">NiChan Events</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#faf9f7;border-top:1px solid #ece8e1;text-align:center;">
              <p style="margin:0;color:#8c8279;font-size:12px;line-height:1.6;">
                © ${new Date().getFullYear()} NiChan Events — Nền tảng quản lý sự kiện<br/>
                Email này được gửi tự động, vui lòng không trả lời.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const button = (text: string, url: string) => `
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
  <tr>
    <td style="background:linear-gradient(135deg,#8b6f4e,#a0845c);border-radius:8px;padding:0;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.3px;">
        ${text}
      </a>
    </td>
  </tr>
</table>
`;

// ─── Templates ────────────────────────────────────────────────────────────────

export const verifyEmailTemplate = (name: string, token: string) => {
  const verifyUrl = `${env.appUrl}/xac-thuc-email?token=${token}`;

  return layout(`
    <h2 style="margin:0 0 16px;color:#2d2a26;font-size:20px;font-weight:600;">
      Xin chào ${name}! 👋
    </h2>
    <p style="margin:0 0 8px;color:#5a5550;font-size:15px;line-height:1.6;">
      Cảm ơn bạn đã đăng ký tài khoản tại <strong>NiChan Events</strong>.
    </p>
    <p style="margin:0 0 16px;color:#5a5550;font-size:15px;line-height:1.6;">
      Vui lòng nhấn nút bên dưới để xác thực email của bạn:
    </p>
    ${button("Xác thực email", verifyUrl)}
    <p style="margin:0 0 8px;color:#8c8279;font-size:13px;line-height:1.6;">
      Liên kết này có hiệu lực trong <strong>24 giờ</strong>.
    </p>
    <p style="margin:0;color:#8c8279;font-size:13px;line-height:1.6;">
      Nếu bạn không đăng ký tài khoản, vui lòng bỏ qua email này.
    </p>
    <hr style="border:none;border-top:1px solid #ece8e1;margin:24px 0;" />
    <p style="margin:0;color:#a09a94;font-size:12px;line-height:1.5;">
      Nếu nút không hoạt động, sao chép link sau vào trình duyệt:<br/>
      <a href="${verifyUrl}" style="color:#8b6f4e;word-break:break-all;">${verifyUrl}</a>
    </p>
  `);
};

export const resetPasswordTemplate = (name: string, token: string) => {
  const resetUrl = `${env.appUrl}/dat-lai-mat-khau?token=${token}`;

  return layout(`
    <h2 style="margin:0 0 16px;color:#2d2a26;font-size:20px;font-weight:600;">
      Đặt lại mật khẩu
    </h2>
    <p style="margin:0 0 8px;color:#5a5550;font-size:15px;line-height:1.6;">
      Xin chào <strong>${name}</strong>,
    </p>
    <p style="margin:0 0 16px;color:#5a5550;font-size:15px;line-height:1.6;">
      Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn nút bên dưới để tạo mật khẩu mới:
    </p>
    ${button("Đặt lại mật khẩu", resetUrl)}
    <p style="margin:0 0 8px;color:#8c8279;font-size:13px;line-height:1.6;">
      Liên kết này có hiệu lực trong <strong>1 giờ</strong>.
    </p>
    <p style="margin:0;color:#8c8279;font-size:13px;line-height:1.6;">
      Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Mật khẩu của bạn vẫn an toàn.
    </p>
    <hr style="border:none;border-top:1px solid #ece8e1;margin:24px 0;" />
    <p style="margin:0;color:#a09a94;font-size:12px;line-height:1.5;">
      Nếu nút không hoạt động, sao chép link sau vào trình duyệt:<br/>
      <a href="${resetUrl}" style="color:#8b6f4e;word-break:break-all;">${resetUrl}</a>
    </p>
  `);
};

export const consultationReceivedTemplate = (
  customerName: string,
  requestCode: string,
  eventType: string,
) => {
  const dashboardUrl = `${env.appUrl}/dashboard`;

  return layout(`
    <h2 style="margin:0 0 16px;color:#2d2a26;font-size:20px;font-weight:600;">
      Đã nhận yêu cầu tư vấn! ✨
    </h2>
    <p style="margin:0 0 16px;color:#5a5550;font-size:15px;line-height:1.6;">
      Xin chào <strong>${customerName}</strong>, cảm ơn bạn đã gửi yêu cầu tư vấn đến NiChan Events.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="background-color:#faf9f7;border-radius:8px;padding:16px 20px;margin:0 0 16px;width:100%;">
      <tr>
        <td>
          <p style="margin:0 0 8px;color:#5a5550;font-size:14px;">
            <strong>Mã yêu cầu:</strong> ${requestCode}
          </p>
          <p style="margin:0;color:#5a5550;font-size:14px;">
            <strong>Loại sự kiện:</strong> ${eventType}
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px;color:#5a5550;font-size:15px;line-height:1.6;">
      Đội ngũ của chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất để tư vấn chi tiết.
    </p>
    ${button("Xem trạng thái yêu cầu", dashboardUrl)}
  `);
};

export const adminConsultationNotifyTemplate = (
  requestCode: string,
  customerName: string,
  eventType: string,
  phone: string,
  email: string,
) => {
  const adminUrl = `${env.appUrl}/admin/yeu-cau`;

  return layout(`
    <h2 style="margin:0 0 16px;color:#2d2a26;font-size:20px;font-weight:600;">
      Yêu cầu tư vấn mới 📋
    </h2>
    <p style="margin:0 0 16px;color:#5a5550;font-size:15px;line-height:1.6;">
      Có yêu cầu tư vấn mới cần xử lý:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="background-color:#faf9f7;border-radius:8px;padding:16px 20px;margin:0 0 16px;width:100%;">
      <tr>
        <td>
          <p style="margin:0 0 8px;color:#5a5550;font-size:14px;">
            <strong>Mã yêu cầu:</strong> ${requestCode}
          </p>
          <p style="margin:0 0 8px;color:#5a5550;font-size:14px;">
            <strong>Khách hàng:</strong> ${customerName}
          </p>
          <p style="margin:0 0 8px;color:#5a5550;font-size:14px;">
            <strong>Loại sự kiện:</strong> ${eventType}
          </p>
          <p style="margin:0 0 8px;color:#5a5550;font-size:14px;">
            <strong>SĐT:</strong> ${phone}
          </p>
          <p style="margin:0;color:#5a5550;font-size:14px;">
            <strong>Email:</strong> ${email}
          </p>
        </td>
      </tr>
    </table>
    ${button("Xem chi tiết", adminUrl)}
  `);
};

export const eventUpdateTemplate = (
  customerName: string,
  eventName: string,
  message: string,
) => {
  const dashboardUrl = `${env.appUrl}/dashboard`;

  return layout(`
    <h2 style="margin:0 0 16px;color:#2d2a26;font-size:20px;font-weight:600;">
      Cập nhật sự kiện 📣
    </h2>
    <p style="margin:0 0 8px;color:#5a5550;font-size:15px;line-height:1.6;">
      Xin chào <strong>${customerName}</strong>,
    </p>
    <p style="margin:0 0 16px;color:#5a5550;font-size:15px;line-height:1.6;">
      Sự kiện <strong>"${eventName}"</strong> của bạn có cập nhật mới:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="background-color:#faf9f7;border-radius:8px;padding:16px 20px;margin:0 0 16px;width:100%;">
      <tr>
        <td>
          <p style="margin:0;color:#5a5550;font-size:14px;line-height:1.6;">
            ${message}
          </p>
        </td>
      </tr>
    </table>
    ${button("Xem chi tiết sự kiện", dashboardUrl)}
  `);
};
