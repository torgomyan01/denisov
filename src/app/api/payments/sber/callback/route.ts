import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sberGetOrderStatus } from "@/lib/sber/client";
import {
  fulfillSberPaidOrder,
  markSberOrderFailed,
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
        select: { id: true, paymentStatus: true },
      })
    : await prisma.order.findFirst({
        where: { number: orderNumber },
        select: { id: true, paymentStatus: true },
      });

  if (!order) {
    return new NextResponse("ok", { status: 200 });
  }

  if (order.paymentStatus === "paid") {
    return new NextResponse("ok", { status: 200 });
  }

  const sberOrderId =
    mdOrder ||
    (
      await prisma.order.findUnique({
        where: { id: order.id },
        select: { sberOrderId: true },
      })
    )?.sberOrderId ||
    "";

  if (sberOrderId) {
    const gateway = await sberGetOrderStatus({ sberOrderId });
    if (gateway.ok && gateway.deposited) {
      await fulfillSberPaidOrder(order.id);
      return new NextResponse("ok", { status: 200 });
    }
    if (gateway.ok && gateway.declined) {
      await markSberOrderFailed(
        order.id,
        `Оплата отклонена Sber (status ${gateway.orderStatus})`,
      );
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

  if (
    status === "0" ||
    operation === "declinedbytimeout" ||
    operation === "reversed" ||
    operation === "refunded"
  ) {
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
