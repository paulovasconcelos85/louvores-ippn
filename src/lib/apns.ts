import { createPrivateKey, sign } from 'node:crypto';

const APNS_ALLOWED_DEVICE_STATUSES = new Set(['authorized', 'provisional', 'ephemeral']);

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function normalizePrivateKey(value: string) {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

function decodeBase64PrivateKey(value: string) {
  return Buffer.from(value, 'base64').toString('utf-8');
}

export function isValidApnsAuthorizationStatus(status: string | null | undefined) {
  return !!status && APNS_ALLOWED_DEVICE_STATUSES.has(status);
}

export type ApnsConfig = {
  teamId: string;
  keyId: string;
  privateKey: string;
  topic: string;
};

export type ApnsNotificationPayload = {
  title: string;
  body: string;
  deepLink?: string | null;
  notificationId: string;
  tipo: string;
  payload?: Record<string, unknown> | null;
};

export type ApnsSendInput = {
  token: string;
  environment: 'development' | 'production';
  notification: ApnsNotificationPayload;
  config: ApnsConfig;
};

export type ApnsSendResult =
  | { ok: true; apnsId: string | null }
  | { ok: false; error: string };

function summarizeStack(stack: string | undefined) {
  if (!stack) return null;
  return stack
    .split('\n')
    .slice(0, 4)
    .join(' | ');
}

function formatUnknownError(error: unknown) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const details = [
    error.message,
    'cause' in error && error.cause ? `cause=${String(error.cause)}` : null,
    error.stack ? `stack=${summarizeStack(error.stack)}` : null,
  ].filter(Boolean);

  return details.join(' | ');
}

export function readApnsConfigFromEnv(): ApnsConfig {
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const keyId = process.env.APNS_KEY_ID?.trim();
  const privateKey = process.env.APNS_PRIVATE_KEY?.trim();
  const privateKeyBase64 = process.env.APNS_PRIVATE_KEY_BASE64?.trim();
  const topic = process.env.APNS_BUNDLE_ID?.trim();

  if (!teamId || !keyId || (!privateKey && !privateKeyBase64) || !topic) {
    throw new Error(
      'APNS_TEAM_ID, APNS_KEY_ID, APNS_BUNDLE_ID e APNS_PRIVATE_KEY ou APNS_PRIVATE_KEY_BASE64 precisam estar configuradas.'
    );
  }

  const resolvedPrivateKey = privateKey
    ? normalizePrivateKey(privateKey)
    : normalizePrivateKey(decodeBase64PrivateKey(privateKeyBase64!));

  return {
    teamId,
    keyId,
    privateKey: resolvedPrivateKey,
    topic,
  };
}

function createApnsJwt(config: ApnsConfig) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'ES256', kid: config.keyId }));
  const payload = base64UrlEncode(JSON.stringify({ iss: config.teamId, iat: issuedAt }));
  const unsignedToken = `${header}.${payload}`;

  const signature = sign('sha256', Buffer.from(unsignedToken), {
    key: createPrivateKey(config.privateKey),
    dsaEncoding: 'ieee-p1363',
  });

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

export async function sendApnsNotification({
  token,
  environment,
  notification,
  config,
}: ApnsSendInput): Promise<ApnsSendResult> {
  const apnsToken = createApnsJwt(config);
  const host =
    environment === 'production' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';

  try {
    const response = await fetch(`${host}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${apnsToken}`,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-topic': config.topic,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        aps: {
          alert: {
            title: notification.title,
            body: notification.body,
          },
          sound: 'default',
        },
        notification_id: notification.notificationId,
        tipo: notification.tipo,
        deep_link: notification.deepLink || null,
        payload: notification.payload || {},
      }),
    });

    if (response.ok) {
      return {
        ok: true,
        apnsId: response.headers.get('apns-id'),
      };
    }

    const rawError = await response.text();
    const trimmedError = rawError.trim();

    return {
      ok: false,
      error: `APNs status=${response.status}${trimmedError ? ` body=${trimmedError}` : ''}`,
    };
  } catch (error) {
    return {
      ok: false,
      error: `APNs fetch error: ${formatUnknownError(error)}`,
    };
  }
}
