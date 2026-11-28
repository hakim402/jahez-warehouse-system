import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { authenticatedJson, useSession } from "./session";

export function useWarehouseLive(warehouseId: string | undefined) {
  const { session } = useSession();
  const cache = useQueryClient();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    setConnected(false);
    if (!session || !warehouseId) return;
    let disposed = false;
    const base = new URL(
      import.meta.env.VITE_API_BASE_URL || "/api/v1",
      window.location.origin,
    );
    const socket = io(base.origin, { auth: { token: session.accessToken } });
    const refresh = () => {
      if (disposed) return;
      void cache.invalidateQueries({
        predicate: (query) =>
          [
            "warehouse-data",
            "receiving-queue",
            "dashboard-history",
            "orders",
            "order",
            "findings",
            "receipt",
            "receipt-files",
            "dispatch",
            "dispatch-detail",
            "stock-lots",
          ].includes(String(query.queryKey[0])) &&
          query.queryKey[1] === session.user.tenantId &&
          query.queryKey[2] === session.user.id && query.queryKey[3] === warehouseId,
      });
    };
    const events = [
      "order.confirmed",
      "order.cancelled",
      "receipt.confirmed",
      "finding.resolved",
      "dispatch.confirmed",
      "adjustment.recorded",
    ];
    for (const event of events) socket.on(event, refresh);
    socket.on("connect", () => {
      socket
        .timeout(5_000)
        .emit(
          "subscribe",
          { warehouseId },
          (error: Error | null, result?: { ok: boolean }) => {
            if (disposed) return;
            setConnected(!error && Boolean(result?.ok));
            if (!error && result?.ok) refresh();
          },
        );
    });
    socket.on("disconnect", () => {
      if (!disposed) setConnected(false);
    });
    socket.on("connect_error", (error) => {
      if (error.message === "Unauthorized") {
        // REST performs the same serialized session refresh used by all office requests.
        void authenticatedJson("/auth/sessions")
          .then(() => {
            if (!disposed) socket.connect();
          })
          .catch(() => undefined);
      }
    });
    const retry = window.setInterval(() => {
      if (!socket.connected) socket.connect();
    }, 30_000);
    const catchUp = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", catchUp);
    return () => {
      disposed = true;
      window.clearInterval(retry);
      document.removeEventListener("visibilitychange", catchUp);
      socket.disconnect();
    };
  }, [session?.accessToken, warehouseId, cache]);
  return connected;
}
