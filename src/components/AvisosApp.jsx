import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth.jsx";
import { statusPush, subscribeToPush } from "../lib/push.js";
import { temVersaoNova } from "../lib/atualizacaoApp.js";

// Faixa de avisos no topo do app: (1) "tem versão nova, toque pra
// atualizar" e (2) lembrete pra ligar as notificações neste aparelho.
// As duas são dispensáveis e nunca bloqueiam o uso do app.

const CHAVE_DISPENSAR_NOTIF = "rotecheck_aviso_notif_ate";
const UM_DIA_MS = 24 * 60 * 60 * 1000;
const DEZ_MIN_MS = 10 * 60 * 1000;

function notifDispensada() {
  try {
    const ate = Number(localStorage.getItem(CHAVE_DISPENSAR_NOTIF) || 0);
    return Date.now() < ate;
  } catch {
    return false;
  }
}

function dispensarNotif() {
  try {
    localStorage.setItem(CHAVE_DISPENSAR_NOTIF, String(Date.now() + UM_DIA_MS));
  } catch {
    // sem localStorage: só some até recarregar
  }
}

function ehIphoneNaoInstalado() {
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/.test(ua);
  const instalado = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches;
  return ios && !instalado;
}

const estiloFaixa = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  padding: "10px 16px",
  background: "var(--surface-alt)",
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
  fontSize: 14,
};

export default function AvisosApp() {
  const { perfil } = useAuth();
  const [versaoNova, setVersaoNova] = useState(false);
  const [push, setPush] = useState(null);
  const [dispensada, setDispensada] = useState(notifDispensada());
  const [ativando, setAtivando] = useState(false);

  // Versão nova: confere ao abrir, ao voltar pra aba/app e a cada 10 min.
  useEffect(() => {
    let vivo = true;
    async function conferir() {
      const nova = await temVersaoNova();
      if (vivo && nova) setVersaoNova(true);
    }
    conferir();
    const intervalo = setInterval(conferir, DEZ_MIN_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") conferir();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);

  // Estado das notificações neste aparelho (só pra quem está logado).
  useEffect(() => {
    if (!perfil?.id) {
      setPush(null);
      return;
    }
    statusPush().then(setPush);
  }, [perfil?.id]);

  async function ativar() {
    if (!perfil?.id) return;
    setAtivando(true);
    try {
      await subscribeToPush(perfil.id);
    } finally {
      setPush(await statusPush());
      setAtivando(false);
    }
  }

  function agoraNao() {
    dispensarNotif();
    setDispensada(true);
  }

  const mostrarAtivar = !!perfil?.id && push?.suportado && !push.inscrito && !push.permissaoNegada && !dispensada;
  const mostrarBloqueado = !!perfil?.id && push?.suportado && !push.inscrito && push.permissaoNegada && !dispensada;
  const mostrarIphone = !!perfil?.id && push && !push.suportado && ehIphoneNaoInstalado() && !dispensada;

  if (!versaoNova && !mostrarAtivar && !mostrarBloqueado && !mostrarIphone) return null;

  return (
    <div role="region" aria-label="Avisos do app">
      {versaoNova && (
        <div style={estiloFaixa} data-aviso="versao-nova">
          <span style={{ flex: 1, minWidth: 200 }}>Tem uma versão nova do RoteCheck disponível.</span>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Atualizar agora
          </button>
        </div>
      )}

      {mostrarAtivar && (
        <div style={estiloFaixa} data-aviso="ativar-notificacoes">
          <span style={{ flex: 1, minWidth: 200 }}>
            Ative as notificações neste aparelho para receber os avisos de coleta na hora.
          </span>
          <button className="btn btn-primary" onClick={ativar} disabled={ativando}>
            {ativando ? "Ativando..." : "Ativar notificações"}
          </button>
          <button className="btn btn-secondary" onClick={agoraNao}>
            Agora não
          </button>
        </div>
      )}

      {mostrarBloqueado && (
        <div style={estiloFaixa} data-aviso="notificacoes-bloqueadas">
          <span style={{ flex: 1, minWidth: 200 }}>
            As notificações estão bloqueadas neste aparelho. Para receber os avisos, libere nas configurações do
            navegador (toque no cadeado ao lado do endereço do site e permita notificações).
          </span>
          <button className="btn btn-secondary" onClick={agoraNao}>
            Entendi
          </button>
        </div>
      )}

      {mostrarIphone && (
        <div style={estiloFaixa} data-aviso="iphone-instalar">
          <span style={{ flex: 1, minWidth: 200 }}>
            No iPhone, para receber notificações: toque em Compartilhar, escolha "Adicionar à Tela de Início" e abra o
            app por lá.
          </span>
          <button className="btn btn-secondary" onClick={agoraNao}>
            Entendi
          </button>
        </div>
      )}
    </div>
  );
}
