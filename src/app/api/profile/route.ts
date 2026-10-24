import { NextResponse } from "next/server";
import { getCustomer } from "@/lib/customer-auth";
import {
  getCustomerProfileById,
  updateCustomerProfileById,
} from "@/lib/customer-profile";
import { updateCustomerProfileSchema } from "@/lib/customer-schema";
import { normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * Profile API for the logged-in customer (Node + Prisma).
 * GET  /api/profile — session profile
 * PATCH /api/profile — name, surname, phone, deliveryAddress, fulfillmentMode
 */

export async function GET() {
  try {
    const session = await getCustomer();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Требуется авторизация" },
        { status: 401 },
      );
    }

    const profile = await getCustomerProfileById(session.id);
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Профиль не найден" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка профиля";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getCustomer();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Требуется авторизация" },
        { status: 401 },
      );
    }

    const body: unknown = await request.json().catch(() => null);
    const parsed = updateCustomerProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Некорректные данные",
        },
        { status: 400 },
      );
    }

    const phone = normalizePhone(parsed.data.phone);
    const result = await updateCustomerProfileById(session.id, {
      name: parsed.data.name,
      surname: parsed.data.surname,
      phone,
      deliveryAddress: parsed.data.deliveryAddress ?? null,
      deliveryLat: parsed.data.deliveryLat ?? null,
      deliveryLng: parsed.data.deliveryLng ?? null,
      pickupPointId: parsed.data.pickupPointId ?? null,
      fulfillmentMode: parsed.data.fulfillmentMode,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result.profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка сохранения";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
