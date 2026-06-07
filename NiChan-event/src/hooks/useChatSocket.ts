// ============================================================
// useChatSocket — nhận tin nhắn chat real-time cho 1 sự kiện
// Tham gia room `event:<eventId>` và gọi onMessage mỗi khi có `new_message`.
// ============================================================
import { useEffect, useRef } from "react";
import { getSocket } from "@/services/socket";

export type RealtimeMessage = {
  id: string;
  eventId: string;
  senderUserId: string;
  sender?: { displayName: string } | null;
  messageText: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
  sentAt: string;
};

export function useChatSocket(
  eventId: string | undefined,
  onMessage: (message: RealtimeMessage) => void,
  onMessageDeleted?: (messageId: string) => void,
) {
  // Giữ callback mới nhất mà không phải re-subscribe socket
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  const deleteHandlerRef = useRef(onMessageDeleted);
  deleteHandlerRef.current = onMessageDeleted;

  useEffect(() => {
    if (!eventId) return;

    const socket = getSocket();
    socket.emit("join_event", { eventId });

    const listener = (message: RealtimeMessage) => {
      if (message.eventId === eventId) handlerRef.current(message);
    };
    socket.on("new_message", listener);

    const deleteListener = ({ messageId }: { messageId: string }) => {
      deleteHandlerRef.current?.(messageId);
    };
    socket.on("message_deleted", deleteListener);

    return () => {
      socket.emit("leave_event", { eventId });
      socket.off("new_message", listener);
      socket.off("message_deleted", deleteListener);
    };
  }, [eventId]);
}
