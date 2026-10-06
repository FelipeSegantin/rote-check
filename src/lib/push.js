import { supabase } from "./supabase";

// Chave pública VAPID — gere o par com `npx web-push generate-vapid-keys`
// e coloque a pública aqui (ou em VITE_VAPID_PUBLIC_KEY) e a privada
// como secret da Edge Function `send-push` (nunca no frontend).
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Registra o service worker (chamar uma vez, no boot do app).
export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

// Pede permissão de notificação, cria a subscription push do navegador
// e salva no Supabase associada ao usuário logado. Chame isto depois
// do login (ex.: assim que o perfil do usuário é carregado).
export async function subscribeToPush(userId) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push notifications não são suportadas neste navegador.");
    return null;
  }
  if (!VAPID_PUBLIC_KEY) {
    console.warn("VITE_VAPID_PUBLIC_KEY não configurada — pulei a inscrição de push.");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const raw = subscription.toJSON();

  // Uma linha por (usuario, endpoint) — upsert evita duplicar quando o
  // navegador renova a subscription.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: raw.endpoint,
      p256dh: raw.keys.p256dh,
      auth: raw.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) console.error("Erro ao salvar push_subscription:", error);
  return subscription;
}

export async function unsubscribeFromPush(userId) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}

// Consulta o estado atual das notificações push nesse aparelho/navegador —
// usado pela tela de Configurações pra saber se mostra o botão ligado ou
// desligado (e se mostra o botão de verdade ou um aviso de "não dá pra
// ativar aqui"). Mesma API (Web Push) tanto no navegador do computador
// quanto no do celular — não precisa de nada diferente por plataforma.
export async function statusPush() {
  const suportado = "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
  if (!suportado) return { suportado: false, inscrito: false, permissaoNegada: false };

  const permissaoNegada = typeof Notification !== "undefined" && Notification.permission === "denied";

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    return { suportado: true, inscrito: !!subscription, permissaoNegada };
  } catch {
    return { suportado: true, inscrito: false, permissaoNegada };
  }
}
