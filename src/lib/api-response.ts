import { NextResponse } from 'next/server';

export type ApiMessageParams = Record<string, string | number | boolean | null | undefined>;

export function apiError(
  code: string,
  status: number,
  error: string,
  params?: ApiMessageParams
) {
  return NextResponse.json(
    {
      success: false,
      code,
      error,
      params: params || undefined,
    },
    { status }
  );
}

export function apiSuccess<T extends Record<string, unknown>>(
  payload: T,
  options?: {
    status?: number;
    message?: string;
    messageCode?: string;
    messageParams?: ApiMessageParams;
  }
) {
  return NextResponse.json(
    {
      success: true,
      ...payload,
      message: options?.message,
      messageCode: options?.messageCode,
      messageParams: options?.messageParams,
    },
    { status: options?.status || 200 }
  );
}
