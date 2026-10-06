import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { estadoInstalacao, inscrever, instalar } from "../lib/instalarPwa.js";
import Logo from "../components/Logo.jsx";

// Página pública (sem precisar logar) feita pra mandar o link direto pros
// clientes/equipe: "entra em rotecheck.netlify.app/baixar e instala". O
// "instalador" aqui não é um .exe de verdade — é o próprio navegador
// instalando o RoteCheck como app (PWA), o que já deixa ícone na área de
// trabalho/menu iniciar e abre numa janela própria, sem barra de
// endereço. Não precisamos assinar nada nem hospedar arquivo grande.
function navegadorSuportaPrompt() {
  const ua = navigator.userAgent || "";
  return /Edg\/|Chrome\//i.test(ua) && !/Firefox/i.test(ua);
}

function detectarPlataforma() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh|Mac OS/i.test(ua)) return "mac";
  return "outro";
}

export default function Baixar() {
  const [estado, setEstado] = useState(estadoInstalacao());
  const [instalando, setInstalando] = useState(false);
  const [recusado, setRecusado] = useState(false);

  useEffect(() => inscrever(() => setEstado(estadoInstalacao())), []);

  async function clicarInstalar() {
    setInstalando(true);
    setRecusado(false);
    const resultado = await instalar();
    setInstalando(false);
    if (resultado?.outcome === "dismissed") setRecusado(true);
  }

  const suportaPrompt = navegadorSuportaPrompt();
  const plataforma = detectarPlataforma();

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 440, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
          <Logo size={56} />
        </div>
        <h1 style={{ marginTop: 12 }}>Instalar o RoteCheck</h1>
        <p style={{ color: "var(--text-dim)" }}>
          Instala o app no computador (ou celular) pra abrir direto pelo ícone, numa janela própria
          — sem precisar digitar o endereço no navegador toda vez.
        </p>

        {estado.jaInstalado && (
          <p style={{ color: "var(--accent)", marginTop: 20, fontWeight: 600 }}>
            ✓ Já está instalado neste aparelho.
          </p>
        )}

        {!estado.jaInstalado && estado.podeInstalar && (
          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 20 }}
            onClick={clicarInstalar}
            disabled={instalando}
          >
            {instalando ? "Abrindo..." : "Instalar agora"}
          </button>
        )}

        {!estado.jaInstalado && !estado.podeInstalar && suportaPrompt && (
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 20 }}>
            Preparando o botão de instalação... Se não aparecer em alguns segundos, recarregue esta
            página.
          </p>
        )}

        {!estado.jaInstalado && !suportaPrompt && (
          <div
            style={{
              marginTop: 20,
              textAlign: "left",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 14,
            }}
          >
            <p style={{ fontSize: 13, margin: "0 0 8px", color: "var(--text-dim)" }}>
              Pra instalar com um clique, abra este link no <strong>Chrome</strong> ou{" "}
              <strong>Edge</strong>. Ou instale manualmente por aqui:
            </p>
            {plataforma === "ios" && (
              <p style={{ fontSize: 13, margin: 0 }}>
                No Safari: toque no ícone de compartilhar (□↑) e depois em "Adicionar à Tela de
                Início".
              </p>
            )}
            {plataforma === "android" && (
              <p style={{ fontSize: 13, margin: 0 }}>
                No menu do navegador (⋮), toque em "Instalar app" ou "Adicionar à tela inicial".
              </p>
            )}
            {plataforma === "mac" && (
              <p style={{ fontSize: 13, margin: 0 }}>
                No Safari: menu Arquivo → "Adicionar ao Dock".
              </p>
            )}
            {plataforma === "outro" && (
              <p style={{ fontSize: 13, margin: 0 }}>
                No menu do navegador (⋮ ou ≡), procure "Instalar RoteCheck" ou "Adicionar à tela
                inicial".
              </p>
            )}
          </div>
        )}

        {recusado && (
          <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 12 }}>
            Sem problema — o link continua aqui pra instalar quando quiser.
          </p>
        )}

        <p style={{ marginTop: 28, fontSize: 14 }}>
          <Link to="/login">Já tenho o app — ir para o login</Link>
        </p>
      </div>
    </div>
  );
}
