import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'O fluxo de convites foi desativado.',
      code: 'INVITES_DISABLED'
    },
    { status: 410 }
  );
}
