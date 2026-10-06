import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import StatusBadge from "./StatusBadge.jsx";

// Solicitações de "esqueci meu usuário" mandadas por clientes que não
// conseguem mais logar (ver RecuperarUsuario.jsx, acessível pelo link na
// tela de login). A pessoa se identifica por CNPJ + nome do estabelecimento
// (já que não consegue logar pra provar quem é de outro jeito), e aqui o
// gerente/despachante confere e Aceita ou Recusa. Ao aceitar, quem define o
// novo usuário é a PRÓPRIA pessoa — ela volta em "Esqueci meu usuário" com o
// mesmo CNPJ e digita o novo e-mail de login ali (ver rotecheck_trocar_login
// em mockSupabase.js). Esse painel só mostra e decide, não digita por ela.
export default function AbaSolicitacoesUsuario() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [perfis, setPerfis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState("pendentes");
  const [processando, setProcessando] = useState(null);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setCarregando(true);
    const [{ data: sol }, { data: pf }] = await Promise.all([
      supabase.from("solicitacoes_usuario").select("*").order("criado_em", { ascending: false }),
      supabase.from("perfis").select("*"),
    ]);
    setSolicitacoes(sol || []);
    setPerfis(pf || []);
    setCarregando(false);
  }

  function perfilDe(s) {
    return perfis.find((p) => p.id === s.perfil_id);
  }

  async function aceitar(s) {
    setProcessando(s.id);
    await supabase
      .from("solicitacoes_usuario")
      .update({ status: "aceita", atendido_em: new Date().toISOString() })
      .eq("id", s.id);
    await carregar();
    setProcessando(null);
  }

  async function recusar(s) {
    setProcessando(s.id);
    await supabase
      .from("solicitacoes_usuario")
      .update({ status: "recusada", atendido_em: new Date().toISOString() })
      .eq("id", s.id);
    await carregar();
    setProcessando(null);
  }

  const pendentes = solicitacoes.filter((s) => s.status === "pendente");
  const listaAtual = aba === "pendentes" ? pendentes : solicitacoes;

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <strong style={{ fontSize: 14 }}>Solicitações de usuário esquecido</strong>
      <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 10px" }}>
        Cliente que esqueceu o usuário manda um pedido aqui (CNPJ + nome do estabelecimento).
        Aceitando, a própria pessoa define o novo usuário quando voltar em "Esqueci meu usuário" —
        você não precisa digitar nada por ela.
      </p>

      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${aba === "pendentes" ? "active" : ""}`} onClick={() => setAba("pendentes")}>
          Pendentes{pendentes.length > 0 && ` (${pendentes.length})`}
        </button>
        <button className={`tab ${aba === "todas" ? "active" : ""}`} onClick={() => setAba("todas")}>
          Todas
        </button>
      </div>

      {carregando && <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Carregando...</p>}

      {!carregando && listaAtual.length === 0 && (
        <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
          {aba === "pendentes" ? "Nenhuma solicitação pendente." : "Nenhuma solicitação ainda."}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {listaAtual.map((s) => {
          const perfil = perfilDe(s);
          return (
            <div key={s.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong style={{ overflowWrap: "anywhere" }}>{s.estabelecimento}</strong>
                {s.status === "pendente" && <StatusBadge status="pendente" />}
                {s.status === "aceita" && <StatusBadge status="aceita" />}
                {s.status === "recusada" && <StatusBadge status="recusada" label="Recusada" />}
              </div>
              <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 10px" }}>
                CNPJ {s.cnpj} · pedido em {new Date(s.criado_em).toLocaleString("pt-BR")}
              </p>

              {perfil ? (
                <p style={{ fontSize: 13, margin: "0 0 10px", color: "var(--accent)" }}>
                  Cliente encontrado: {perfil.estabelecimento || perfil.nome}
                  {perfil.estabelecimento ? ` (${perfil.nome})` : ""}
                </p>
              ) : (
                <p style={{ fontSize: 13, margin: "0 0 10px", color: "var(--danger)" }}>
                  Nenhum cliente cadastrado com esse CNPJ — confira antes de aceitar.
                </p>
              )}

              {s.status === "aceita" && (
                <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 10px" }}>
                  {s.novo_login
                    ? `Usuário já trocado para: ${s.novo_login}`
                    : "Aguardando a pessoa definir o novo usuário."}
                </p>
              )}

              {s.status === "pendente" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={processando === s.id}
                    onClick={() => aceitar(s)}
                  >
                    {processando === s.id ? "..." : "Aceitar"}
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ flex: 1 }}
                    disabled={processando === s.id}
                    onClick={() => recusar(s)}
                  >
                    {processando === s.id ? "..." : "Recusar"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
