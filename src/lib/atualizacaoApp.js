// Detecta quando existe uma versão nova do app publicada no Netlify
// enquanto a pessoa ainda está com a antiga aberta (ou instalada na tela
// inicial). O jeito mais simples e confiável: o index.html publicado
// aponta pro arquivo principal com um "hash" no nome (ex.:
// /assets/index-CUCe2KO9.js) que muda a cada build. Se o hash que o
// servidor está entregando agora é diferente do que esta página carregou,
// tem versão nova.
//
// Não depende do service worker (que aqui não guarda nada em cache) e não
// faz nada quando não acha o script (modo desenvolvimento, versão de
// demonstração em arquivo único etc.).

export function scriptCarregado() {
  const el = document.querySelector('script[type="module"][src*="/assets/"]');
  return el ? el.getAttribute("src") : null;
}

export async function scriptPublicado() {
  const resposta = await fetch(`/?_=${Date.now()}`, { cache: "no-store" });
  if (!resposta.ok) return null;
  const html = await resposta.text();
  const achado = html.match(/\/assets\/index-[^"'\s>]+\.js/);
  return achado ? achado[0] : null;
}

// Retorna true quando o servidor está com um arquivo principal diferente
// do carregado aqui. Qualquer falha (sem internet etc.) retorna false —
// melhor não avisar do que avisar errado.
export async function temVersaoNova() {
  const atual = scriptCarregado();
  if (!atual) return false;
  try {
    const publicado = await scriptPublicado();
    if (!publicado) return false;
    // O src pode vir com ou sem a origem na frente; compara só o caminho.
    const caminhoAtual = atual.replace(/^https?:\/\/[^/]+/, "");
    return caminhoAtual !== publicado;
  } catch {
    return false;
  }
}
