import type { NextApiRequest, NextApiResponse } from 'next';
import { NextResponse } from 'next/server';

// URL del webhook de n8n (debería venir de variables de entorno en producción)
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://n8n.example.com/webhook/las-mesas-pedidos';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Enviar datos a n8n webhook
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`n8n webhook responded with ${response.status}`);
    }

    const result = await response.json();

    return NextResponse.json(
      { 
        success: true, 
        message: 'Webhook enviado a n8n correctamente',
        n8nResponse: result 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error sending webhook to n8n:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Error sending webhook to n8n' 
      },
      { status: 500 }
    );
  }
}

// Para verificación GET (opcional)
export async function GET(req: Request) {
  return NextResponse.json({
    message: 'Webhook endpoint de n8n activo',
    url: N8N_WEBHOOK_URL,
    method: 'POST'
  });
}