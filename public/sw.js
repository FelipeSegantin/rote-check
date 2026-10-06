// Service worker do RoteCheck — recebe pushes vindos da Edge Function
// "send-push" e mostra a notificação nativa do sistema.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = { title: "RoteCheck", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "RoteCheck";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: payload.url || "/",
      coletaId: payload.coletaId || null,
      tipo: payload.tipo || null,
    },
    tag: payload.tag || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clique na notificação: foca uma aba já aberta ou abre uma nova na rota certa.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.postMessage({ type: "notification-click", data: event.notification.data });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
