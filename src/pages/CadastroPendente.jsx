import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { LABEL_PAPEL } from "../lib/papeis.js";
import { statusPush, subscribeToPush, unsubscribeFromPush } from "../lib/push.js";

export default function CadastroPendente() {
  const { session, logout, perfil } = useAuth();
  const papel = perfil?.papel ? LABEL_PAPEL[perfil.papel] || perfil.papel : null;

  // Oferece já ligar as notificações aqui, antes mesmo da aprovação — senão
  // a pessoa só teria acesso a esse botão em Configurações, que só aparece
  // depois de aprovada (ver App.jsx), e perderia justamente o aviso de
  // "seu cadastro foi aprovado" por nunca ter tido como se inscrever antes.
  const [push, setPush] = useState({ suportado: false, inscrito: false, permissaoNegada: false });
  const [mudandoPush, setMudandoPush] = useState(false);

  useEffect(() => {
    if (perfil?.id) statusPush().then(setPush);
  }, [perfil?.id]);

  async function alternarPush(ligar) {
    setMudandoPush(true);
    if (ligar) await subscribeToPush(perfil.id);
    else await unsubscribeFromPush(perfil.id);
    setPush(await statusPush());
    setMudandoPush(false);
  }

  // Depois de clicar em "Sair" a sessão vira null, mas esta página não
  // fica dentro do <ProtectedRoute> (tem que ser acessível justamente
  // sem estar aprovado) — sem isso, o botão "Sair" parecia não fazer nada.
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <h1>Cadastro em análise</h1>
        <p style={{ color: "var(--text-dim)" }}>
          Seu pedido de cadastro{papel ? ` como ${papel}` : ""} está pendente. Um gerente precisa aprovar
          antes que você possa acessar o app.
        </p>

        {push.suportado && (
          <div className="card" style={{ marginTop: 16, textAlign: "left" }}>
            <label className="toggle">
              <input
                type="checkbox"
                checked={push.inscrito}
                disabled={mudandoPush}
                onChange={(e) => alternarPush(e.target.checked)}
              />
              <span className="toggle-trilho" aria-hidden="true" />
              {push.inscrito ? "Aviso ativado" : "Avisar quando aprovar"}
            </label>
            <p style={{ color: "var(--text-dim)", fontSize: 12.5, margin: "8px 0 0" }}>
              Ligue aqui pra receber um aviso neste aparelho assim que o cadastro for aprovado — sem
              precisar ficar voltando aqui pra conferir.
            </p>
            {push.permissaoNegada && !push.inscrito && (
              <p style={{ color: "var(--danger)", fontSize: 12.5, margin: "8px 0 0" }}>
                As notificações estão bloqueadas pra esse site nas configurações do navegador/aparelho —
                libere lá primeiro e tente de novo aqui.
              </p>
            )}
          </div>
        )}

        <button className="btn btn-secondary" onClick={logout} style={{ marginTop: 16 }}>
          Sair
        </button>
      </div>
    </div>
  );
}
