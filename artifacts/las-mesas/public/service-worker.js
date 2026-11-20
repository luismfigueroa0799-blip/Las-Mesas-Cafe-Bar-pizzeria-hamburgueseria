self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(payload.title || 'Nuevo pedido para cocina', {
    body: payload.body || 'Hay un pedido nuevo. Abre Cocina para verlo.',
    icon: '/assets/logo-las-mesas.jpeg',
    badge: '/assets/logo-las-mesas.jpeg',
    tag: payload.tag || 'pedido-cocina',
    renotify: true,
    requireInteraction: true,
    data: { url: payload.url || '/admin/cocina' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || '/admin/cocina', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
    const existente = clientes.find((cliente) => new URL(cliente.url).origin === self.location.origin);
    if (existente) return existente.focus().then(() => existente.navigate(destino));
    return self.clients.openWindow(destino);
  }));
});
