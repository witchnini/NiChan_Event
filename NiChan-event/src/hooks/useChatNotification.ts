// ============================================================
// useChatNotification — global hook lắng nghe tin nhắn chat mới
// Hiển thị toast, browser notification, phát âm thanh khi có
// tin nhắn mới từ bất kỳ event nào mà user tham gia.
// ============================================================
import { useEffect, useCallback, useRef, useState } from "react";
import { getSocket } from "@/services/socket";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { RealtimeMessage } from "@/hooks/useChatSocket";

// Phát âm thanh thông báo bằng Web Audio API
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio context không khả dụng — bỏ qua
  }
}

export function useChatNotification() {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const mountedRef = useRef(true);

  const clearAll = useCallback(() => {
    setUnreadCounts({});
  }, []);

  const clearEvent = useCallback((eventId: string) => {
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  }, []);

  const totalUnread = Object.values(unreadCounts).reduce((s, c) => s + c, 0);

  useEffect(() => {
    mountedRef.current = true;
    if (!user) return;

    const socket = getSocket();

    const handleNewMessage = (message: RealtimeMessage) => {
      // Bỏ qua tin nhắn do chính mình gửi
      if (message.senderUserId === user.id) return;

      if (!mountedRef.current) return;

      // Tăng unread count cho event
      setUnreadCounts((prev) => ({
        ...prev,
        [message.eventId]: (prev[message.eventId] ?? 0) + 1,
      }));

      // Hiện toast
      const senderName = message.sender?.displayName ?? "Ai đó";
      const preview =
        message.messageText.length > 60
          ? message.messageText.slice(0, 60) + "…"
          : message.messageText;

      toast.info(`${senderName}: ${preview}`, {
        duration: 4000,
      });

      // Phát âm thanh
      playNotificationSound();

      // Browser notification (nếu được cho phép)
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        document.hidden
      ) {
        new Notification(`Tin nhắn mới từ ${senderName}`, {
          body: preview,
          tag: `chat-${message.id}`,
        });
      }
    };

    socket.on("new_message", handleNewMessage);

    // Xin quyền browser notification
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }

    return () => {
      mountedRef.current = false;
      socket.off("new_message", handleNewMessage);
    };
  }, [user]);

  return { totalUnread, unreadCounts, clearAll, clearEvent };
}
