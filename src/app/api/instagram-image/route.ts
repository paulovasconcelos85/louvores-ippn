// app/api/instagram-image/route.ts

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { postUrl } = await request.json();

    if (!postUrl) {
      return NextResponse.json(
        { error: 'URL do post é obrigatória' },
        { status: 400 }
      );
    }

    // Extrai o ID do post
    const postId = postUrl.match(/\/p\/([^\/]+)/)?.[1] || 
                   postUrl.match(/\/reel\/([^\/]+)/)?.[1];

    if (!postId) {
      return NextResponse.json(
        { error: 'URL inválida do Instagram' },
        { status: 400 }
      );
    }

    // Tenta buscar a imagem através da URL pública do Instagram
    // Nota: Isso pode não funcionar sempre devido a restrições do Instagram
    const imageUrl = `https://www.instagram.com/p/${postId}/media/?size=l`;
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error('Não foi possível buscar a imagem');
    }

    const imageBlob = await response.blob();
    const buffer = await imageBlob.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="instagram-${postId}.jpg"`,
      },
    });

  } catch (error) {
    console.error('Erro ao buscar imagem do Instagram:', error);
    return NextResponse.json(
      { error: 'Erro ao processar imagem do Instagram' },
      { status: 500 }
    );
  }
}