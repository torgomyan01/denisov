export const assertGatewaySecret = (request: Request): boolean => {
  const expected = process.env.GATEWAY_SECRET?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization")?.trim() ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  const alt = request.headers.get("x-gateway-secret")?.trim() ?? "";
  return bearer === expected || alt === expected;
};
