import { cookies } from "next/headers";

export type FlashTone = "success" | "error";

interface FlashPayload {
  message: string;
  tone: FlashTone;
}

const FLASH_COOKIE_NAME = "ticketing_flash";

export async function setFlashMessage(payload: FlashPayload) {
  const cookieStore = await cookies();

  cookieStore.set(FLASH_COOKIE_NAME, encodeURIComponent(JSON.stringify(payload)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60
  });
}

export async function getFlashMessage(): Promise<FlashPayload | null> {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(FLASH_COOKIE_NAME)?.value;

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<FlashPayload>;

    if (
      typeof parsed.message === "string" &&
      (parsed.tone === "success" || parsed.tone === "error")
    ) {
      return {
        message: parsed.message,
        tone: parsed.tone
      };
    }
  } catch (error) {
    console.error("Unable to parse flash message", error);
  }

  return null;
}

export async function clearFlashMessage() {
  const cookieStore = await cookies();
  cookieStore.delete(FLASH_COOKIE_NAME);
}
