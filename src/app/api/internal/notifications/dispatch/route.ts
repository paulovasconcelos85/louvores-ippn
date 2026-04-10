import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  isValidApnsAuthorizationStatus,
  readApnsConfigFromEnv,
  sendApnsNotification,
} from '@/lib/apns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_DISPATCH_LIMIT = 50;
const DEFAULT_DISPATCH_LIMIT = 50;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type DeliveryRow = {
  id: string;
  notification_id: string;
  tentativas: number;
};

type NotificationRow = {
  id: string;
  usuario_acesso_id: string | null;
  tipo: string;
  titulo: string;
  corpo: string;
  deep_link: string | null;
  payload: Record<string, unknown> | null;
};

type PushDeviceRow = {
  id: string;
  usuario_acesso_id: string | null;
  push_token: string;
  plataforma: string;
  authorization_status: string;
  ambiente: 'development' | 'production';
  ativo: boolean;
};

function getRequestedLimit(body: unknown) {
  if (!body || typeof body !== 'object') {
    return DEFAULT_DISPATCH_LIMIT;
  }

  const rawLimit = 'limit' in body ? Number(body.limit) : DEFAULT_DISPATCH_LIMIT;

  if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
    return DEFAULT_DISPATCH_LIMIT;
  }

  return Math.min(Math.floor(rawLimit), MAX_DISPATCH_LIMIT);
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    throw new Error('CRON_SECRET nao configurada.');
  }

  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim();
  const directHeader = request.headers.get('x-cron-secret')?.trim();

  return bearerToken === secret || directHeader === secret;
}

function summarizeErrors(errors: string[]) {
  return errors.join(' || ').slice(0, 4000);
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 });
    }

    const apnsConfig = readApnsConfigFromEnv();
    const body = await request.json().catch(() => null);
    const limit = getRequestedLimit(body);

    const { data: pendingDeliveries, error: deliveriesError } = await supabaseAdmin
      .from('notification_deliveries')
      .select('id, notification_id, tentativas')
      .eq('status', 'pending')
      .eq('canal', 'push')
      .order('scheduled_at', { ascending: true })
      .limit(limit);

    if (deliveriesError) throw deliveriesError;

    const deliveries = (pendingDeliveries || []) as DeliveryRow[];

    if (deliveries.length === 0) {
      return NextResponse.json({
        ok: true,
        scanned: 0,
        claimed: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
      });
    }

    const notificationIds = Array.from(new Set(deliveries.map((delivery) => delivery.notification_id)));

    const { data: notificationsData, error: notificationsError } = await supabaseAdmin
      .from('notifications')
      .select('id, usuario_acesso_id, tipo, titulo, corpo, deep_link, payload')
      .in('id', notificationIds);

    if (notificationsError) throw notificationsError;

    const notifications = new Map(
      ((notificationsData || []) as NotificationRow[]).map((notification) => [notification.id, notification])
    );

    const usuarioIds = Array.from(
      new Set(
        ((notificationsData || []) as NotificationRow[])
          .map((notification) => notification.usuario_acesso_id)
          .filter(Boolean)
      )
    ) as string[];

    let devicesByUser = new Map<string, PushDeviceRow[]>();

    if (usuarioIds.length > 0) {
      const { data: devicesData, error: devicesError } = await supabaseAdmin
        .from('push_dispositivos')
        .select('id, usuario_acesso_id, push_token, plataforma, authorization_status, ambiente, ativo')
        .in('usuario_acesso_id', usuarioIds)
        .eq('ativo', true)
        .eq('plataforma', 'ios')
        .in('authorization_status', ['authorized', 'provisional', 'ephemeral']);

      if (devicesError) throw devicesError;

      devicesByUser = new Map<string, PushDeviceRow[]>();

      for (const device of (devicesData || []) as PushDeviceRow[]) {
        if (!device.usuario_acesso_id || !isValidApnsAuthorizationStatus(device.authorization_status)) {
          continue;
        }

        const current = devicesByUser.get(device.usuario_acesso_id) || [];
        current.push(device);
        devicesByUser.set(device.usuario_acesso_id, current);
      }
    }

    let claimed = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const delivery of deliveries) {
      const { data: claimedDelivery, error: claimError } = await supabaseAdmin
        .from('notification_deliveries')
        .update({ status: 'processing' })
        .eq('id', delivery.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (claimError) {
        console.error('Erro ao reservar delivery para processamento:', delivery.id, claimError);
        skipped += 1;
        continue;
      }

      if (!claimedDelivery) {
        skipped += 1;
        continue;
      }

      claimed += 1;

      const notification = notifications.get(delivery.notification_id);

      if (!notification) {
        await supabaseAdmin
          .from('notification_deliveries')
          .update({
            status: 'failed',
            tentativas: delivery.tentativas + 1,
            last_error: 'Notification associada nao encontrada.',
          })
          .eq('id', delivery.id);

        failed += 1;
        continue;
      }

      if (!notification.usuario_acesso_id) {
        await supabaseAdmin
          .from('notification_deliveries')
          .update({
            status: 'failed',
            tentativas: delivery.tentativas + 1,
            last_error: 'Notification sem usuario_acesso_id.',
          })
          .eq('id', delivery.id);

        failed += 1;
        continue;
      }

      const devices = devicesByUser.get(notification.usuario_acesso_id) || [];

      if (devices.length === 0) {
        await supabaseAdmin
          .from('notification_deliveries')
          .update({
            status: 'failed',
            tentativas: delivery.tentativas + 1,
            last_error: 'Nenhum push_dispositivo iOS ativo e autorizado encontrado.',
          })
          .eq('id', delivery.id);

        failed += 1;
        continue;
      }

      const tokenErrors: string[] = [];
      let firstSuccessfulToken: string | null = null;
      let firstApnsId: string | null = null;

      for (const device of devices) {
        try {
          const result = await sendApnsNotification({
            token: device.push_token,
            environment: device.ambiente,
            config: apnsConfig,
            notification: {
              notificationId: notification.id,
              tipo: notification.tipo,
              title: notification.titulo,
              body: notification.corpo,
              deepLink: notification.deep_link,
              payload: notification.payload,
            },
          });

          if (result.ok) {
            firstSuccessfulToken ??= device.push_token;
            firstApnsId ??= result.apnsId;
            continue;
          }

          tokenErrors.push(`${device.id}: ${result.error}`);
        } catch (error) {
          tokenErrors.push(
            `${device.id}: ${error instanceof Error ? error.message : 'Erro desconhecido ao enviar push.'}`
          );
        }
      }

      if (firstSuccessfulToken) {
        const { error: sentError } = await supabaseAdmin
          .from('notification_deliveries')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            last_error: null,
            provider: 'apns',
            provider_message_id: firstApnsId,
            destino: firstSuccessfulToken,
          })
          .eq('id', delivery.id);

        if (sentError) {
          console.error('Erro ao marcar delivery como enviada:', delivery.id, sentError);
          failed += 1;
          continue;
        }

        sent += 1;
        continue;
      }

      const { error: failedError } = await supabaseAdmin
        .from('notification_deliveries')
        .update({
          status: 'failed',
          tentativas: delivery.tentativas + 1,
          last_error: summarizeErrors(tokenErrors) || 'Falha ao enviar push para todos os tokens.',
          provider: 'apns',
        })
        .eq('id', delivery.id);

      if (failedError) {
        console.error('Erro ao marcar delivery como falha:', delivery.id, failedError);
      }

      failed += 1;
    }

    return NextResponse.json({
      ok: true,
      scanned: deliveries.length,
      claimed,
      sent,
      failed,
      skipped,
    });
  } catch (error) {
    console.error('Erro ao despachar notificacoes push:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro interno ao despachar notificacoes.',
      },
      { status: 500 }
    );
  }
}
