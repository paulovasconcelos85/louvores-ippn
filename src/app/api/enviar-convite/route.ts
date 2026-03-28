import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'O fluxo de convites foi desativado.',
      code: 'INVITES_DISABLED'
    },
    { status: 410 }
  );
}
