import { createHmac, timingSafeEqual } from "crypto";
import { ProviderError } from "@/lib/errors/provider-errors";

export function verifyMetaWebhookSignature(
  signature: string | null,
  rawBody: string,
  appSecret: string
): void {
  if (!signature?.startsWith("sha256=")) {
    throw new ProviderError("webhook_invalid_signature", "Missing signature");
  }
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = signature.slice("sha256=".length);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ProviderError("webhook_invalid_signature", "Invalid signature");
  }
}
