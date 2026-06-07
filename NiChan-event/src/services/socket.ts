// ============================================================
// SOCKET CLIENT — NiChan Event
// Singleton kết nối Socket.IO (cùng origin, Vite proxy /socket.io → backend),
// xác thực bằng JWT trong localStorage.
// ============================================================
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

function getToken(): string | null {
  return localStorage.getItem("nichan_token");
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: true,
      auth: { token: getToken() },
      transports: ["websocket", "polling"],
    });
  } else if (!socket.connected) {
    // Cập nhật token (vd. sau khi đăng nhập lại) rồi kết nối lại
    socket.auth = { token: getToken() };
    socket.connect();
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
