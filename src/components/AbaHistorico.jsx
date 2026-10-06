import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import StatusBadge from "./StatusBadge.jsx";

// Todas as coletas juntas, de qualquer status — mesma base de dados que
// Indicadores, mas cada aba busca a própria cópia agora que viraram
// componentes separados (só uma fica montada de cada vez).
export default function AbaHistorico() {
  const [historico, setHistorico] = useState([]);
  const [coletores, setColetores] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data } = await supabase
        .from("coletas")
        .select("*, cliente:cliente_id(nome, estabelecimento), coletor:coletor_id(nome)")
        .order("criado_em", { ascending: false });
      setHistorico(data || []);
      setCarregando(false);
    }
    carregar();
  }, []);

  useEffect(() => {
    async function carregarColetores() {
      const { data } = await supabase.from("perfis").select("id, nome").eq("papel", "coletor").eq("aprovado", true);
      setColetores(data || []);
    }
    carregarColetores();
  }, []);

  // Sub-aba por coletor — "Todos" + uma aba com o nome de cada coletor
  // aprovado, pra filtrar a lista e ver só as coletas dele. Ordem
  // alfabética (diferente do ranking de Indicadores, que é por
  // quantidade) porque aqui o objetivo é achar um coletor específico.
  const coletoresEmOrdemAlfabetica = useMemo(
    () => [...coletores].sort((a, b) => a.nome.localeCompare(b.nome)),
    [coletores]
  );
  const [coletorHistoricoId, setColetorHistoricoId] = useState("todos");
  const historicoFiltrado = useMemo(
    () => (coletorHistoricoId === "todos" ? historico : historico.filter((c) => c.coletor_id === coletorHistoricoId)),
    [historico, coletorHistoricoId]
  );

  return (
    <>
      <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 12 }}>
        Todas as coletas juntas, de qualquer status, mais recentes primeiro.
      </p>

      <div className="tabs">
        <button
          className={`tab ${coletorHistoricoId === "todos" ? "active" : ""}`}
          onClick={() => setColetorHistoricoId("todos")}
        >
          Todos
        </button>
        {coletoresEmOrdemAlfabetica.map((c) => (
          <button
            key={c.id}
            className={`tab ${coletorHistoricoId === c.id ? "active" : ""}`}
            onClick={() => setColetorHistoricoId(c.id)}
          >
            {c.nome}
          </button>
        ))}
      </div>

      {carregando && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}
      {!carregando && historicoFiltrado.length === 0 && (
        <p style={{ color: "var(--text-dim)" }}>
          {coletorHistoricoId === "todos" ? "Nenhuma coleta registrada ainda." : "Nenhuma coleta desse coletor ainda."}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {historicoFiltrado.map((coleta) => (
          <div key={coleta.id} className="card" style={{ display: "flex", gap: 12 }}>
            {coleta.foto_url ? (
              <img src={coleta.foto_url} className="foto-miniatura" alt={`Foto da coleta em ${coleta.local}`} />
            ) : (
              <div className="foto-miniatura-vazia">Sem foto</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ overflowWrap: "anywhere" }}>{coleta.local}</strong>
                <StatusBadge status={coleta.status} />
              </div>
              <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 0" }}>
                {(coleta.cliente?.estabelecimento || coleta.cliente?.nome)} {coleta.coletor?.nome ? `→ ${coleta.coletor.nome}` : ""} · {coleta.veiculo_tipo} ·{" "}
                {coleta.tipo_produto}
                <br />
                {new Date(coleta.horario_solicitado).toLocaleString("pt-BR")}
              </p>
              {coleta.status === "recusada" && coleta.motivo_recusa && (
                <p style={{ color: "var(--danger)", fontSize: 13, margin: "4px 0 0" }}>{coleta.motivo_recusa}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
