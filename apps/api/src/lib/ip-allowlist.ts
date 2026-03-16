import type { Request, RequestHandler } from "express";

type IpAllowlistOptions = {
  allowlist: string[];
};

type IpPattern =
  | {
      kind: "exact";
      value: string;
    }
  | {
      kind: "cidr";
      value: string;
      network: number;
      mask: number;
    };

function normalizeIp(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice("::ffff:".length);
  }

  return trimmed;
}

function parseIpv4(value: string): number | null {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return null;
  }

  let result = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }

    const octet = Number.parseInt(part, 10);
    if (octet < 0 || octet > 255) {
      return null;
    }

    result = (result << 8) | octet;
  }

  return result >>> 0;
}

function parseIpPattern(value: string): IpPattern {
  const normalizedValue = normalizeIp(value);

  if (!normalizedValue.includes("/")) {
    return {
      kind: "exact",
      value: normalizedValue,
    };
  }

  const [ipPart, prefixPart] = normalizedValue.split("/", 2);
  const prefixLength = Number.parseInt(prefixPart, 10);
  const ipNumber = parseIpv4(ipPart);

  if (ipNumber === null || Number.isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
    throw new Error(`Unsupported MANAGER_ALLOWED_IPS entry: ${value}`);
  }

  const mask = prefixLength === 0 ? 0 : ((0xffffffff << (32 - prefixLength)) >>> 0);

  return {
    kind: "cidr",
    value: normalizedValue,
    network: ipNumber & mask,
    mask,
  };
}

function matchesIpPattern(clientIp: string, pattern: IpPattern): boolean {
  if (pattern.kind === "exact") {
    return clientIp === pattern.value;
  }

  const clientIpNumber = parseIpv4(clientIp);
  if (clientIpNumber === null) {
    return false;
  }

  return (clientIpNumber & pattern.mask) === pattern.network;
}

export function parseAllowedIpsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const rawValue = env.MANAGER_ALLOWED_IPS?.trim() ?? "";

  if (rawValue.length === 0) {
    return [];
  }

  return rawValue
    .split(",")
    .map((entry) => normalizeIp(entry))
    .filter((entry) => entry.length > 0);
}

function resolveClientIp(request: Request): string | null {
  const candidates = [request.ip, request.socket.remoteAddress];

  for (const candidate of candidates) {
    if (typeof candidate !== "string" || candidate.trim().length === 0) {
      continue;
    }

    return normalizeIp(candidate);
  }

  return null;
}

export function createIpAllowlistMiddleware(
  options: IpAllowlistOptions | null,
): RequestHandler {
  if (!options || options.allowlist.length === 0) {
    return (_request, _response, next) => next();
  }

  const patterns = options.allowlist.map(parseIpPattern);

  return (request, response, next) => {
    const clientIp = resolveClientIp(request);

    if (clientIp && patterns.some((pattern) => matchesIpPattern(clientIp, pattern))) {
      next();
      return;
    }

    if (request.path.startsWith("/api/")) {
      response.status(403).json({
        error: {
          message: "Manager access denied for this client IP.",
        },
      });
      return;
    }

    response.status(403).type("text/plain").send("Manager access denied for this client IP.");
  };
}
