// Deixa arrastar as listas de abas (".tabs") pro lado com o mouse, não só
// com o dedo — sem isso, num computador sem trackpad/scroll horizontal (só
// mouse comum), não tinha como chegar nas abas que passam da largura da
// tela (ex.: painel do gerente, que tem bastante aba: Rotas, Mapa,
// Histórico, Chat, Usuários, Convites, Veículos, Aprovações...).
//
// Instala os listeners uma vez só, no elemento raiz do app (ver App.jsx),
// e detecta qualquer ".tabs" na tela por delegação — então funciona em
// todas as telas que já têm essa classe, sem precisar mexer em cada uma, e
// continua funcionando em abas novas que apareçam no futuro.
export function instalarArrastoTabs() {
  let elementoAtivo = null;
  let inicioX = 0;
  let scrollInicial = 0;
  let arrastando = false;
  let houveArrasto = false;

  function aoDescerMouse(e) {
    if (e.button !== 0) return; // só botão esquerdo
    const alvo = e.target.closest?.(".tabs");
    if (!alvo) return;
    elementoAtivo = alvo;
    inicioX = e.clientX;
    scrollInicial = alvo.scrollLeft;
    arrastando = true;
    houveArrasto = false;
  }

  function aoMoverMouse(e) {
    if (!arrastando || !elementoAtivo) return;
    const delta = e.clientX - inicioX;
    if (Math.abs(delta) > 4) {
      if (!houveArrasto) elementoAtivo.classList.add("tabs-arrastando");
      houveArrasto = true;
    }
    if (houveArrasto) {
      elementoAtivo.scrollLeft = scrollInicial - delta;
      e.preventDefault();
    }
  }

  function aoSoltarMouse() {
    elementoAtivo?.classList.remove("tabs-arrastando");
    arrastando = false;
    elementoAtivo = null;
  }

  // Depois de um arrasto de verdade (moveu o mouse), cancela o click que o
  // mouseup geraria em cima do que estiver embaixo do cursor — senão,
  // soltar o botão depois de arrastar clicava sem querer numa aba.
  function aoClicar(e) {
    if (!houveArrasto) return;
    e.preventDefault();
    e.stopPropagation();
    houveArrasto = false;
  }

  document.addEventListener("mousedown", aoDescerMouse);
  document.addEventListener("mousemove", aoMoverMouse);
  document.addEventListener("mouseup", aoSoltarMouse);
  document.addEventListener("click", aoClicar, true);

  return () => {
    document.removeEventListener("mousedown", aoDescerMouse);
    document.removeEventListener("mousemove", aoMoverMouse);
    document.removeEventListener("mouseup", aoSoltarMouse);
    document.removeEventListener("click", aoClicar, true);
  };
}
