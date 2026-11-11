import type { NextApiRequest, NextApiResponse } from 'next';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// CONFIGURACIÓN DE STRIPE - Usar variables de entorno
// Estas deben configurarse en el panel de Vercel o .env.local
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// Interfaz para el cuerpo de la petición
interface CheckoutRequest {
  items: Array<{
    id: string;
    name: string;
    price: string;
    quantity: number;
  }>;
  customerEmail: string;
  customerName: string;
}

// Generar URL de éxito basada en el entorno
const successUrl = process.env.NEXT_PUBLIC_URL 
  ? `${process.env.NEXT_PUBLIC_URL}/compra-exitosa`
  : 'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-cgcz0at74.vercel.app/compra-exitosa';

const cancelUrl = process.env.NEXT_PUBLIC_URL
  ? `${process.env.NEXT_PUBLIC_URL}/carta`
  : 'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-cgcz0at74.vercel.app/carta';

export async function POST(req: Request) {
  try {
    const body: CheckoutRequest = await req.json();

    // Crear sesión de checkout de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: body.items.map((item) => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.name,
          },
          unit_amount: Math.floor(parseFloat(item.price) * 100), // Convertir a centavos (floor para redondear)
        },
        quantity: item.quantity,
      }),
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: body.customerEmail,
      metadata: {
        // Aquí podemos pasar información adicional
        items: JSON.stringify(body.items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity }))),
      },
    });

    return NextResponse.json({ sessionId: session.id }, { status: 200 });
  } catch (error: any) {
    console.error('Error creating Stripe checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Error creating checkout session' },
      { status: 500 }
    );
  }
}

// Para compatibilidad con GET (para que el botón funcione)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const itemsParam = searchParams.get('items');
    const customerEmail = searchParams.get('email');

    // Si tenemos items, crear sesión directamente
    if (itemsParam) {
      const items = JSON.parse(itemsParam);
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: items.map((item: any) => ({
          price_data: {
            currency: 'eur',
            product_data: {
              name: item.name,
            },
            unit_amount: Math.floor(parseFloat(item.price) * 100),
          },
          quantity: item.quantity,
        })),
        mode: 'payment',
        success_url: success_url,
        cancel_url: cancel_url,
        customer_email: customerEmail,
      });

      return NextResponse.json({ sessionId: session.id });
    }

    return NextResponse.json({ error: 'No items provided' }, { status: 400 });
  } catch (error: any) {
    console.error('Error creating Stripe checkout session GET:', error);
    return NextResponse.json(
      { error: error.message || 'Error creating checkout session' },
      { status: 500 }
    );
  }
}