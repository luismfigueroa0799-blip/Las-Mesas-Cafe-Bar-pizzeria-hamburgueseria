"use client";

import { useState } from 'react';
import { useCart } from '@/CartContext';
import ProductCard from '@/ProductCard';
import { Dish } from '@/App'; // Importar tipo del archivo App

// Página de la Carta con diseño mejorado
export default function CartaPage() {
  // Datos de la carta (podrían venir de getProducts() en el futuro)
  const [activeCategory, setActiveCategory] = useState<'Hamburguesas de carne' | 'Hamburguesas de pollo' | 'Perritos' | 'Pan de ajo' | 'Papas' | 'Platos combinados' | 'Bocadillos calientes' | 'Sándwiches calientes' | 'Pizzas' | 'Cafés e infusiones' | 'Refrescos, aguas y zumos' | 'Cervezas' | 'Licores y destilados' | 'Vinos'>('Hamburguesas de carne');
  
  const { addToCart, total } = useCart();
  
  // Categorías disponibles
  const categories = [
    'Hamburguesas de carne',
    'Hamburguesas de pollo', 
    'Perritos',
    'Pan de ajo',
    'Papas',
    'Platos combinados',
    'Bocadillos calientes',
    'Sándwiches calientes',
    'Pizzas',
    'Cafés e infusiones',
    'Refrescos, aguas y zumos',
    'Cervezas',
    'Licores y destilados',
    'Vinos'
  ];

  // Filtrar platos por categoría
  const carta: Record<string, Dish[]> = {
    'Hamburguesas de carne': [
      { name: 'La suprema', description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', price: '6,50 €', allergens: 'G* · H · L · S*' },
      { name: 'La tradicional', description: 'Queso, cebolla y 3 salsas', price: '3,60 €', allergens: 'G* · L · S*' },
      { name: 'Burger Pizza', description: 'Hamburguesa de carne, huevo frito, bacon, queso, lechuga, tomate natural, cebolla, rúcula y salsa cheddar', price: '12,00 €', allergens: 'G · H · L · S' },
    ],
    'Hamburguesas de pollo': [
      { name: 'La súper', description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', price: '6,50 €', allergens: 'G* · H · L · S*' },
      { name: 'La simple', description: 'Queso, cebolla y 3 salsas', price: '3,60 €', allergens: 'G · L · S' },
    ],
    'Perritos': [
      { name: 'Perrito súper', description: 'Queso, jamón, cebolla y 3 salsas', price: '3,40 €', allergens: 'G* · L · S*' },
      { name: 'Perrito normal', description: 'Cebolla y 3 salsas', price: '3,00 €', allergens: 'G* · S*' },
    ],
    'Pan de ajo': [
      { name: 'Normal', description: 'Pan de ajo hecho con masa de pizza', price: '4,80 €', allergens: 'G' },
      { name: 'Queso', description: 'Pan de ajo hecho con masa de pizza', price: '6,30 €', allergens: 'G · L' },
      { name: 'Jamón y queso', description: 'Pan de ajo hecho con masa de pizza', price: '7,80 €', allergens: 'G · L' },
    ],
    'Papas': [
      { name: 'Cono de papas', description: 'Papas fritas', price: '1,85 €' },
      { name: 'Pequeña', description: 'Papas fritas', price: '3,00 €' },
      { name: 'Grande', description: 'Papas fritas', price: '4,20 €' },
    ],
    'Platos combinados': [
      { name: 'Alitas de pollo al chipotle', description: '6 unidades · con papas fritas y ensalada fresca', price: '10,00 €', allergens: 'S*' },
      { name: 'Nuggets de pollo premium', description: '10 unidades · con papas fritas y ensalada fresca', price: '7,50 €', allergens: 'G · H* · L*' },
    ],
    'Bocadillos calientes': [
      { name: 'El ternera crack', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '4,80 €', allergens: 'G · H · L · MZ*' },
    ],
    'Sándwiches calientes': [
      { name: 'Jamón y queso', description: 'Jamón y queso', price: '2,90 €', allergens: 'G · L' },
    ],
    'Pizzas': [
      { name: 'La bella serrana', description: 'Tomate, mozzarella, jamón serrano, rúcula, aceite de oliva y tomate cherry', price: '11,50 €', allergens: 'G · L' },
    ],
    'Cafés e infusiones': [
      { name: 'Café', price: '1,00 €' },
    ],
    'Refrescos, aguas y zumos': [
      { name: 'Coca-Cola', price: '2,00 €' },
    ],
    'Cervezas': [
      { name: 'Tropical', price: '1,40 €' },
    ],
    'Licores y destilados': [
      { name: 'Ron blanco / oro', price: '1,50 €' },
    ],
    'Vinos': [
      { name: 'Viña Lobón', price: '8,00 €' },
    ],
  };

  const filteredDishes = carta[activeCategory] || [];

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
  };

  return (
    <section className="py-12 bg-background">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header de la carta */}
        <div className="mb-8 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-oliva-600 text-sm font-medium uppercase tracking-wider mb-2">La Carta</p>
              <h1 className="font-serif text-3xl font-medium text-gray-900">
                Nuestra <span className="text-dorado">carta</span>
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-3 py-1.5 text-sm font-medium rounded ${activeCategory === cat ? 'bg-dorado text-negro' : 'text-gray-500 hover:text-dorado transition-colors'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lista de categorías con platos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDishes.map((dish) => (
            <ProductCard
              key={dish.name}
              product: {
                id: dish.name,
                name: dish.name,
                description: dish.description,
                price: dish.price,
                image: `/assets/${dish.name.toLowerCase().replace(/ /g, '-')}.webp`,
                allergens: dish.allergens,
              } as Product,
              onAddToCart,
              selectedSize: 'normal',
              showSizeSelector: false // Para simplificar, quitar selector en esta vista
            />
          ))}
        </div>

        {/* Sección de total */}
        {filteredDishes.length > 0 && (
          <div className="mt-8 pt-8 border-t border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-600">Total</span>
              <span className="font-serif font-bold text-dorado">€{total.toFixed(2)}</span>
            </div>
            <button
              onClick={() => window.alert('Proceder al pago')
              }
              className="w-full bg-dorado text-negro font-semibold py-2 rounded text-transform-uppercase hover:bg-dorado-claro transition-colors"
            >
              Ir a la caja
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// Estilos adicionales (podrían ir en un archivo CSS separado)
export const styles = {
  carta: 'max-w-7xl mx-auto px-4 py-12',
  grid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4',
  productCard: 'bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-medium transition-shadow duration-200',
};