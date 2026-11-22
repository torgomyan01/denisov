import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sberGetOrderStatus } from "@/lib/sber/client";
import {
  fulfillSberPaidOrder,
  markSberOrderFailed,
  markSberOrderRefunded,
} from "@/lib/sber/fulfill-paid-order";

export const dynamic = "force-dynamic";

/**
 * Sber callback (GET or POST):
 * mdOrder, orderNumber, operation, status (1=ok, 0=fail)
 * Always respond 200 so the gateway stops retrying after we handled it.
 */
const readParams = async (
  request: NextRequest,
): Promise<Record<string, string>> => {
  const out: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    out[key] = value;
  });
  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") || "";
    try {
      if (contentType.includes("application/json")) {
        const json = (await request.json()) as Record<string, unknown>;
        for (const [key, value] of Object.entries(json)) {
          if (value == null) continue;
          out[key] = String(value);
        }
      } else {
        const form = await request.formData();
        form.forEach((value, key) => {
          if (typeof value === "string") out[key] = value;
        });
      }
    } catch {
      /* ignore empty / invalid body */
    }
  }
  return out;
};

const handleCallback = async (request: NextRequest): Promise<NextResponse> => {
  const params = await readParams(request);
  const mdOrder = (params.mdOrder || params.orderId || "").trim();
  const orderNumber = (params.orderNumber || "").trim();
  const operation = (params.operation || "").trim().toLowerCase();
  const status = (params.status || "").trim();

  if (!mdOrder && !orderNumber) {
    return new NextResponse("ok", { status: 200 });
  }

  const order = mdOrder
    ? await prisma.order.findFirst({
        where: { sberOrderId: mdOrder },
        select: { id: true, paymentStatus: true, sberOrderId: true },
      })
    : await prisma.order.findFirst({
        where: { number: orderNumber },
        select: { id: true, paymentStatus: true, sberOrderId: true },
      });

  if (!order) {
    return new NextResponse("ok", { status: 200 });
  }

  if (order.paymentStatus === "refunded") {
    return new NextResponse("ok", { status: 200 });
  }

  const sberOrderId = mdOrder || order.sberOrderId || "";

  const isRefundOp =
    operation === "reversed" ||
    operation === "refunded" ||
    operation === "refund";

  // Post-capture refund/reverse callbacks (also when already paid locally)
  if (isRefundOp) {
    if (sberOrderId) {
      const gateway = await sberGetOrderStatus({ sberOrderId });
      if (
        gateway.ok &&
        (gateway.orderStatus === 3 ||
          gateway.orderStatus === 4 ||
          gateway.paymentState === "REVERSED" ||
          gateway.paymentState === "REFUNDED")
      ) {
        await markSberOrderRefunded(
          order.id,
          `Sber callback: ${operation || "refund"}`.slice(0, 255),
        );
        return new NextResponse("ok", { status: 200 });
      }
    }
    // Without gateway confirm — only trust refund op if we already had a paid order
    if (order.paymentStatus === "paid" && status === "1") {
      await markSberOrderRefunded(
        order.id,
        `Sber callback: ${operation || "refund"}`.slice(0, 255),
      );
    }
    return new NextResponse("ok", { status: 200 });
  }

  if (order.paymentStatus === "paid") {
    return new NextResponse("ok", { status: 200 });
  }

  if (sberOrderId) {
    const gateway = await sberGetOrderStatus({ sberOrderId });
    if (gateway.ok && gateway.deposited) {
      await fulfillSberPaidOrder(order.id);
      return new NextResponse("ok", { status: 200 });
    }
    if (gateway.ok && gateway.declined) {
      // Declined before pay — not a post-capture refund
      if (gateway.orderStatus === 3 || gateway.orderStatus === 4) {
        await markSberOrderRefunded(
          order.id,
          `Sber: статус ${gateway.orderStatus}`,
        );
      } else {
        await markSberOrderFailed(
          order.id,
          `Оплата отклонена Sber (status ${gateway.orderStatus})`,
        );
      }
      return new NextResponse("ok", { status: 200 });
    }
  }

  const successOp =
    operation === "deposited" ||
    operation === "approved" ||
    operation === "payment";
  if (successOp && status === "1") {
    if (sberOrderId) {
      const verify = await sberGetOrderStatus({ sberOrderId });
      if (verify.ok && verify.deposited) {
        await fulfillSberPaidOrder(order.id);
      }
    }
    return new NextResponse("ok", { status: 200 });
  }

  if (status === "0" || operation === "declinedbytimeout") {
    await markSberOrderFailed(
      order.id,
      `Sber callback: ${operation || "fail"} status=${status || "?"}`.slice(
        0,
        255,
      ),
    );
  }

  return new NextResponse("ok", { status: 200 });
};

export async function GET(request: NextRequest) {
  return handleCallback(request);
}

export async function POST(request: NextRequest) {
  return handleCallback(request);
}
