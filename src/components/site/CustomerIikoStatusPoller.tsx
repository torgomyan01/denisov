"use client";

import { useEffect, useRef } from "react";
import { syncOpenSiteOrdersFromIikoAction } from "@/actions/orders";

const POLL_MS = 30_000;
export const CUSTOMER_AUTH_EVENT = "denisov-customer-auth";
export const ORDERS_SYNCED_EVENT = "denisov-orders-synced";

/**
 * Any visitor (guest or logged-in) — sync open order statuses from iiko
 * immediately on load, then every 30s on any page.
 * Server throttles so many tabs don't spam iiko.
 */
export const CustomerIikoStatusPoller = () => {
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const runSync = async () => {
      if (cancelled || inFlight.current) return;
      inFlight.current = true;
      try {
        const result = await syncOpenSiteOrdersFromIikoAction();
        if (cancelled || !result.success) return;
        if (!result.data?.throttled) {
          window.dispatchEvent(new Event(ORDERS_SYNCED_EVENT));
        }
      } catch {
        /* network / action errors — next tick retries */
      } finally {
        inFlight.current = false;
      }
    };

    const startPolling = () => {
      void runSync();
      if (timer != null) window.clearInterval(timer);
      timer = window.setInterval(() => {
        void runSync();
      }, POLL_MS);
    };

    startPolling();

    const onAuth = () => {
      void runSync();
    };
    const onFocus = () => {
      void runSync();
    };

    window.addEventListener(CUSTOMER_AUTH_EVENT, onAuth);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (timer != null) window.clearInterval(timer);
      window.removeEventListener(CUSTOMER_AUTH_EVENT, onAuth);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
};
