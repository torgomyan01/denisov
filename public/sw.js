/* Denisov Web Push service worker */
self.addEventListener("push", (event) => {
  let data = {
    title: "Денисов",
    body: "Статус заказа обновлён",
    url: "/profile/orders",
    tag: "denisov-order",
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = {
        title: typeof parsed.title === "string" ? parsed.title : data.title,
        body: typeof parsed.body === "string" ? parsed.body : data.body,
        url: typeof parsed.url === "string" ? parsed.url : data.url,
        tag: typeof parsed.tag === "string" ? parsed.tag : data.tag,
      };
    }
  } catch {
    /* keep defaults */
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      renotify: true,
      data: { url: data.url },
      icon: "/favicon-32.png",
      badge: "/favicon-16.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw =
    event.notification.data && typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : "/profile/orders";
  const targetUrl = new URL(raw, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
