import type { NextApiRequest, NextApiResponse } from 'next';

// Tipo para un producto
interface Product {
  id: string;
  name: string;
  description?: string;
  price: string;
  image: string;
  allergens?: string;
}

// Base de datos simulada (en producción se conectaría a Neon)
const products: Product[] = [
  { id: '1', name: 'La suprema', description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', price: '6,50 €', image: '/assets/lagrimas-pollo-crispy.jpg', allergens: 'G* · H · L · S*' },
  { id: '2', name: 'La tradicional', description: 'Queso, cebolla y 3 salsas', price: '3,60 €', image: '/assets/fingers-pollo.jpg', allergens: 'G* · L · S*' },
  { id: '3', name: 'Burger Pizza', description: 'Hamburguesa de carne, huevo frito, bacon, queso, lechuga, tomate natural, cebolla, rúcula y salsa cheddar', price: '12,00 €', image: '/assets/burger-pizza.jpg', allergens: 'G · H · L · S' },
  { id: '4', name: 'La súper', description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', price: '6,50 €', image: '/assets/hamburguesa-pollo-crispy.jpg', allergens: 'G* · H · L · S*' },
  { id: '5', name: 'La simple', description: 'Queso, cebolla y 3 salsas', price: '3,60 €', image: '/assets/platos-compartir.jpg', allergens: 'G · L · S' },
  { id: '6', name: 'Perrito súper', description: 'Queso, jamón, cebolla y 3 salsas', price: '3,40 €', image: '/assets/brochetas-pollo.jpg', allergens: 'G* · L · S*' },
  { id: '7', name: 'Perrito normal', description: 'Cebolla y 3 salsas', price: '3,00 €', image: '/assets/local-billar-1.webp', allergens: 'G* · S*' },
  { id: '8', name: 'Normal', description: 'Pan de ajo hecho con masa de pizza', price: '4,80 €', image: '/assets/hamburguesa-pollo-crispy.jpg', allergens: 'G' },
  { id: '9', name: 'Queso', description: 'Pan de ajo hecho con masa de pizza', price: '6,30 €', image: '/assets/lagrimas-pollo-crispy.jpg', allergens: 'G · L' },
  { id: '10', name: 'Jamón y queso', description: 'Pan de ajo hecho con masa de pizza', price: '7,80 €', image: '/assets/fingers-pollo.jpg', allergens: 'G · L' },
  // ... más productos
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { category } = req.query;
  
  // Filtrar por categoría si se especifica
  const filteredProducts = category 
    ? products.filter(p => p.name.includes(category.split(' ')[0]))
    : products;

  res.status(200).json(filteredProducts);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};