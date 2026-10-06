import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import RelogioAtual from "../../components/RelogioAtual.jsx";
import { mapaUltimasMensagens, temNaoLida } from "../../lib/chatLeitura.js";

// Ordem das seções: primeiro o que ainda está em aberto e pode precisar de
// atenção (pendente aguardando resposta, aceita aguardando o coletor, não
// atendida que talvez precise ser refeita), coletada por último — já
// concluída, é só histórico.
const SECOES_STATUS = [
  { status: "pendente", titulo: "Pendentes" },
  { status: "aceita", titulo: "Aceitas" },
  { status: "recusada", titulo: "Não atendidas" },
  { status: "coletada", titulo: "Coletadas" },
];

export default function ClienteHome() {
  const { perfil } = useAuth();
  const [coletas, setColetas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [ultimasMensagens, setUltimasMensagens] = useState({});
  // Mesmo padrão de abas usado pros dias da semana na aba Roteiro: uma
  // linha de abas, uma selecionada por vez, e só a lista daquela aba
  // aparece embaixo.
  const [statusSelecionado, setStatusSelecionado] = useState("pendente");

  useEffect(() => {
    if (!perfil?.id) return;

    async function carregar() {
      const { data } = await supabase
        .from("coletas")
        .select("*")
        .eq("cliente_id", perfil.id)
        .order("criado_em", { ascending: false });
      setColetas(data || []);
      setCarregando(false);

      const ids = (data || []).map((c) => c.id);
      if (ids.length) {
        const { data: msgs } = await supabase.from("mensagens").select("*").in("coleta_id", ids);
        setUltimasMensagens(mapaUltimasMensagens(msgs || []));
      }
    }
    carregar();

    // Atualiza sozinho quando o gerente aceita/recusa a coleta.
    const canal = supabase
      .channel(`coletas-cliente-${perfil.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "coletas", filter: `cliente_id=eq.${perfil.id}` },
        (payload) => setColetas((atual) => atual.map((c) => (c.id === payload.new.id ? payload.new : c)))
      )
      .subscribe();

    return () => supabase.removeChannel(canal);
  }, [perfil?.id]);

  return (
    <div className="app-content">
      <RelogioAtual />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Suas coletas</h1>
        <Link to="/nova-coleta" className="btn btn-primary" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
          + Nova coleta
        </Link>
      </div>

      {carregando && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}
      {!carregando && coletas.length === 0 && (
        <p style={{ color: "var(--text-dim)" }}>Nenhuma coleta pedida ainda. Toque em "Nova coleta" para começar.</p>
      )}

      {!carregando && coletas.length > 0 && (
        <>
          <div className="tabs">
            {SECOES_STATUS.map(({ status, titulo }) => {
              const qtd = coletas.filter((c) => c.status === status).length;
              return (
                <button
                  key={status}
                  type="button"
                  className={`tab ${statusSelecionado === status ? "active" : ""}`}
                  onClick={() => setStatusSelecionado(status)}
                >
                  {titulo} ({qtd})
                </button>
              );
            })}
          </div>

          {(() => {
            const doStatus = coletas.filter((c) => c.status === statusSelecionado);
            if (doStatus.length === 0) {
              return <p style={{ color: "var(--text-dim)" }}>Nenhuma coleta nessa situação.</p>;
            }
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {doStatus.map((coleta) => (
                  <Link
                    key={coleta.id}
                    to={`/coletas/${coleta.id}`}
                    className="card"
                    style={{ textDecoration: "none", color: "inherit", display: "flex", gap: 12 }}
                  >
                    {coleta.status === "recusada" &&
                      (coleta.foto_url ? (
                        <img src={coleta.foto_url} className="foto-miniatura" alt="Foto do coletor no local" />
                      ) : (
                        <div className="foto-miniatura-vazia">Sem foto</div>
                      ))}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <strong style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {/* O local é sempre o mesmo estabelecimento do cadastro do
                              cliente — mostra só o nome dele em vez do endereço
                              completo repetido em cada card. */}
                          {perfil?.estabelecimento || coleta.local}
                          {temNaoLida(coleta.id, ultimasMensagens[coleta.id], perfil?.id) && (
                            <span className="ponto-nao-lido" title="Mensagem nova no chat" />
                          )}
                        </strong>
                        <StatusBadge status={coleta.status} />
                      </div>
                      <p style={{ color: "var(--text-dim)", fontSize: 14, margin: "6px 0 0" }}>
                        {new Date(coleta.horario_solicitado).toLocaleString("pt-BR")}
                        {coleta.risco_atraso && coleta.status === "pendente" && (
                          <span style={{ color: "var(--amber)" }}> · risco de atraso</span>
                        )}
                      </p>
                      {coleta.status === "recusada" && coleta.motivo_recusa && (
                        <p style={{ color: "var(--danger)", fontSize: 14, margin: "6px 0 0" }}>{coleta.motivo_recusa}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
