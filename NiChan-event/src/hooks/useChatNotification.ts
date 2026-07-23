// ============================================================
// useChatNotification — thông báo tin nhắn chat mới global
// Join TẤT CẢ socket rooms của user, lắng nghe `new_message`,
// hiện toast + browser notification + âm thanh khi nhận tin
// từ đối phương.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/services/socket";
import { apiClient } from "@/services/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { RealtimeMessage } from "./useChatSocket";

// ── Âm thanh thông báo (tone ngắn bằng Web Audio API) ────────
let audioCtx: AudioContext | null = null;

function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    oscillator.frequency.setValueAtTime(1047, audioCtx.currentTime + 0.1); // C6

    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.4);
  } catch {
    // AudioContext may not be available — silently ignore
  }
}

// ── Browser Notification ─────────────────────────────────────
function showBrowserNotification(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/logo2.png",
      tag: "nichan-chat-" + Date.now(),
    });
  } catch {
    // Notification API may fail in some contexts
  }
}

function requestNotificationPermission() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

// ── Singleton guard — đảm bảo chỉ 1 listener active ─────────
// Khi hook được gọi ở nhiều component (vd: Navbar re-render),
// sẽ không bị trùng listener.
let activeListenerId = 0;

// ── Kiểu dữ liệu cho unread tracking ────────────────────────
type UnreadMap = Record<string, number>;

export type ChatNotificationState = {
  /** Map eventId → số tin nhắn chưa đọc */
  unreadByEvent: UnreadMap;
  /** Tổng số tin nhắn chưa đọc trên mọi event */
  totalUnread: number;
  /** Reset unread cho 1 event cụ thể (khi user mở chat event đó) */
  clearUnread: (eventId: string) => void;
  /** Reset toàn bộ */
  clearAll: () => void;
};

/**
 * Hook global lắng nghe `new_message` từ socket.
 * Tự động join TẤT CẢ socket rooms của user (dựa vào role) để nhận
 * tin nhắn real-time xuyên suốt app.
 *
 * ⚠️ CHỈ GỌI MỘT LẦN ở cấp layout (Navbar / OrganizerLayout).
 *    Không gọi lại ở các trang con để tránh duplicate.
 */
export function useChatNotification(): ChatNotificationState {
  const { user } = useAuth();
  const [unreadByEvent, setUnreadByEvent] = useState<UnreadMap>({});
  const userIdRef = useRef(user?.userId);
  userIdRef.current = user?.userId;

  // Xin quyền browser notification lần đầu
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Join tất cả event rooms của user để nhận tin nhắn global
  useEffect(() => {
    if (!user?.userId || !user?.role) return;

    const socket = getSocket();
    let joinedIds: string[] = [];
    let cancelled = false;

    const joinAllRooms = async () => {
      try {
        let ids: string[] = [];

        if (user.role === "organizer") {
          const projects = await apiClient.get<{ id: string }[]>("/organizer/projects");
          ids = projects.map((p) => p.id);
        } else if (user.role === "customer") {
          const events = await apiClient.get<{ id: string }[]>("/customer/events");
          ids = events.map((e) => e.id);
        }

        if (cancelled) return;

        joinedIds = ids;
        ids.forEach((id) => socket.emit("join_event", { eventId: id }));
      } catch {
        // Silently ignore — useChatSocket ở trang chat vẫn join room riêng
      }
    };

    void joinAllRooms();

    // KHÔNG leave_event khi cleanup vì useChatSocket cũng dùng chung socket
    // và leave_event sẽ kick cả listener của useChatSocket.
    // Rooms tự cleanup khi socket disconnect.
    return () => {
      cancelled = true;
    };
  }, [user?.userId, user?.role]);

  // Lắng nghe tin nhắn mới — dùng singleton guard chống trùng
  useEffect(() => {
    if (!user?.userId) return;

    const myId = ++activeListenerId;
    const socket = getSocket();

    const handler = (message: RealtimeMessage) => {
      // Singleton guard: chỉ listener mới nhất mới xử lý
      if (myId !== activeListenerId) return;

      // Bỏ qua tin nhắn do chính mình gửi
      if (message.senderUserId === userIdRef.current) return;

      const senderName = message.sender?.displayName ?? "Người gửi";
      const preview = message.messageText
        ? message.messageText.length > 60
          ? message.messageText.slice(0, 60) + "…"
          : message.messageText
        : message.attachmentName ?? "Đã gửi một tệp đính kèm";

      // Toast notification
      toast("💬 " + senderName, {
        description: preview,
        duration: 5000,
      });

      // Browser notification khi tab bị ẩn
      if (document.hidden) {
        showBrowserNotification(
          `${senderName} đã gửi tin nhắn`,
          preview,
        );
      }

      // Âm thanh
      playNotificationSound();

      // Cập nhật unread count
      setUnreadByEvent((prev) => ({
        ...prev,
        [message.eventId]: (prev[message.eventId] ?? 0) + 1,
      }));
    };

    socket.on("new_message", handler);
    return () => {
      socket.off("new_message", handler);
    };
  }, [user?.userId]);

  const totalUnread = Object.values(unreadByEvent).reduce((sum, count) => sum + count, 0);

  const clearUnread = useCallback((eventId: string) => {
    setUnreadByEvent((prev) => {
      if (!prev[eventId]) return prev;
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setUnreadByEvent({});
  }, []);

  return { unreadByEvent, totalUnread, clearUnread, clearAll };
}
