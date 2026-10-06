// Aplica o tema (claro/escuro/sistema) como data-theme no <html>. A
// preferência em si mora no perfil (perfis.tema), então ela viaja com a
// conta — quem escolhe "Claro" no celular vê "Claro" também ao logar no
// computador. Antes do login (sem perfil ainda), ou pra quem nunca mexeu
// nisso, o padrão é "sistema": segue o tema que o aparelho já está usando.
export const OPCOES_TEMA = [
  { valor: "sistema", label: "Seguir o sistema" },
  { valor: "claro", label: "Claro" },
  { valor: "escuro", label: "Escuro" },
];

function resolverTema(preferido) {
  if (preferido === "claro" || preferido === "escuro") return preferido;
  // "sistema" (ou vazio/valor desconhecido) — pergunta pro navegador.
  const prefereClaro = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches;
  return prefereClaro ? "claro" : "escuro";
}

export function aplicarTema(preferido) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolverTema(preferido);
}
