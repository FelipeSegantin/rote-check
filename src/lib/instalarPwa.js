// Captura o evento "beforeinstallprompt" (só Chrome/Edge/Chromium disparam)
// assim que a página carrega — não dá pra esperar a pessoa chegar na tela
// de instalação pra começar a ouvir, porque o evento pode disparar antes
// disso e, se ninguém tiver capturado, ele se perde (só dispara uma vez
// por carregamento de página). Por isso este módulo é importado logo no
// main.jsx, antes de qualquer rota.
let eventoAdiado = null;
let jaInstalado =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(display-mode: standalone)").matches;
const ouvintes = new Set();

function notificar() {
  ouvintes.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoAdiado = e;
    notificar();
  });

  window.addEventListener("appinstalled", () => {
    jaInstalado = true;
    eventoAdiado = null;
    notificar();
  });
}

export function estadoInstalacao() {
  return { podeInstalar: !!eventoAdiado, jaInstalado };
}

// Componentes usam isto num useEffect pra saber quando podeInstalar/
// jaInstalado mudam (o evento pode chegar depois do primeiro render).
export function inscrever(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

// Só funciona dentro de um clique/gesto do usuário — é uma exigência do
// navegador, não nossa.
export async function instalar() {
  if (!eventoAdiado) return null;
  eventoAdiado.prompt();
  const resultado = await eventoAdiado.userChoice;
  eventoAdiado = null;
  notificar();
  return resultado; // { outcome: "accepted" | "dismissed" }
}
