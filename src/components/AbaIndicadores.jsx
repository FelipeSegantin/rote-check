import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import StatusBadge from "./StatusBadge.jsx";
import { PERIODOS, filtrarNoPeriodo } from "../lib/periodoIndicadores.js";

// Números de todas as coletas já registradas (mesma base de dados do
// Histórico — mas agora que cada aba é seu próprio componente, cada uma
// busca a própria cópia; como só uma fica montada de cada vez, não chega
// a duplicar requisição de verdade).

export default function AbaIndicadores() {
  const [historico, setHistorico] = useState([]);
  const [coletores, setColetores] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Filtro de período — pedido do Felipe: ver os indicadores só de hoje,
  // da semana, do mês ou do ano, em vez de sempre "desde sempre".
  const [periodo, setPeriodo] = useState("tudo");
  const historicoNoPeriodo = useMemo(() => filtrarNoPeriodo(historico, periodo), [historico, periodo]);

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

  const totalPedidas = historicoNoPeriodo.length;
  const totalColetadas = historicoNoPeriodo.filter((c) => c.status === "coletada").length;
  const totalPendentes = historicoNoPeriodo.filter((c) => c.status === "pendente").length;
  const totalAceitas = historicoNoPeriodo.filter((c) => c.status === "aceita").length;
  const totalRecusadas = historicoNoPeriodo.filter((c) => c.status === "recusada").length;
  const taxaConclusao = totalPedidas > 0 ? Math.round((totalColetadas / totalPedidas) * 100) : 0;

  // Quantas coletas cada cliente já pediu (independente do status), do
  // maior pro menor.
  const indicadoresPorCliente = useMemo(() => {
    const mapa = new Map();
    for (const c of historicoNoPeriodo) {
      const chave = c.cliente_id || "sem-cliente";
      const nome = c.cliente?.estabelecimento || c.cliente?.nome || "Cliente sem cadastro";
      if (!mapa.has(chave)) mapa.set(chave, { chave, nome, total: 0, coletada: 0, recusada: 0 });
      const item = mapa.get(chave);
      item.total += 1;
      if (c.status === "coletada") item.coletada += 1;
      if (c.status === "recusada") item.recusada += 1;
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [historicoNoPeriodo]);

  // Mesma lista de clientes, mas em ordem alfabética — usada só no seletor
  // "ver coletas de um cliente" (pra ranking geral, quem pediu mais primeiro
  // faz mais sentido; pra achar um cliente específico, alfabética é melhor).
  const clientesEmOrdemAlfabetica = useMemo(
    () => [...indicadoresPorCliente].sort((a, b) => a.nome.localeCompare(b.nome)),
    [indicadoresPorCliente]
  );

  // Detalhe de um cliente específico, sem sair da visão geral acima —
  // escolhe um cliente no seletor e vê só as coletas dele.
  const [clienteDetalheId, setClienteDetalheId] = useState("");
  const statsClienteDetalhe = indicadoresPorCliente.find((c) => c.chave === clienteDetalheId) || null;
  const coletasClienteDetalhe = useMemo(
    () => (clienteDetalheId ? historicoNoPeriodo.filter((c) => (c.cliente_id || "sem-cliente") === clienteDetalheId) : []),
    [historicoNoPeriodo, clienteDetalheId]
  );

  // Quantas coletas cada coletor já concluiu — começa já com todo mundo
  // aprovado (mesmo quem ainda não coletou nada), pra não sumir da lista.
  const indicadoresPorColetor = useMemo(() => {
    const mapa = new Map();
    for (const c of coletores) {
      mapa.set(c.id, { chave: c.id, nome: c.nome, total: 0, coletada: 0 });
    }
    for (const c of historicoNoPeriodo) {
      if (!c.coletor_id) continue;
      if (!mapa.has(c.coletor_id)) {
        mapa.set(c.coletor_id, { chave: c.coletor_id, nome: c.coletor?.nome || "Coletor", total: 0, coletada: 0 });
      }
      const item = mapa.get(c.coletor_id);
      item.total += 1;
      if (c.status === "coletada") item.coletada += 1;
    }
    return [...mapa.values()].sort((a, b) => b.coletada - a.coletada);
  }, [historicoNoPeriodo, coletores]);

  return (
    <>
      <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 12 }}>
        Números das coletas já registradas (mesma base do Histórico).
      </p>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {PERIODOS.map((p) => (
          <button key={p.valor} className={`tab ${periodo === p.valor ? "active" : ""}`} onClick={() => setPeriodo(p.valor)}>
            {p.label}
          </button>
        ))}
      </div>

      {carregando && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}

      {!carregando && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
            <div className="card" style={{ flex: "1 1 110px", textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{totalPedidas}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{periodo === "tudo" ? "Pedidas ao todo" : "Pedidas no período"}</div>
            </div>
            <div className="card" style={{ flex: "1 1 110px", textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--accent-text)" }}>{totalColetadas}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Coletadas</div>
            </div>
            <div className="card" style={{ flex: "1 1 110px", textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{totalPendentes + totalAceitas}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Em aberto</div>
            </div>
            <div className="card" style={{ flex: "1 1 110px", textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--danger)" }}>{totalRecusadas}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Não atendidas</div>
            </div>
            <div className="card" style={{ flex: "1 1 110px", textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{taxaConclusao}%</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Taxa de conclusão</div>
            </div>
          </div>

          <strong style={{ fontSize: 14 }}>Coletas por cliente</strong>
          <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 10px" }}>
            Quantas coletas cada cliente já pediu, do maior pro menor. Toque num cliente pra ver as coletas dele
            uma por uma.
          </p>
          {indicadoresPorCliente.length === 0 && (
            <p style={{ color: "var(--text-dim)" }}>
              {periodo === "tudo" ? "Nenhuma coleta registrada ainda." : "Nenhuma coleta nesse período."}
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            {indicadoresPorCliente.map((item) => (
              <button
                key={item.chave}
                type="button"
                className="card"
                onClick={() => setClienteDetalheId((atual) => (atual === item.chave ? "" : item.chave))}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  borderColor: clienteDetalheId === item.chave ? "var(--accent)" : "var(--border)",
                }}
              >
                <strong style={{ overflowWrap: "anywhere" }}>{item.nome}</strong>
                <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--text-dim)" }}>
                  <span>
                    <strong style={{ color: "var(--text)" }}>{item.total}</strong> pedidas
                  </span>
                  <span>
                    <strong style={{ color: "var(--accent-text)" }}>{item.coletada}</strong> coletadas
                  </span>
                  {item.recusada > 0 && (
                    <span>
                      <strong style={{ color: "var(--danger)" }}>{item.recusada}</strong> não atendidas
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Ver coletas de um cliente específico</label>
              <select value={clienteDetalheId} onChange={(e) => setClienteDetalheId(e.target.value)}>
                <option value="">Escolher cliente...</option>
                {clientesEmOrdemAlfabetica.map((c) => (
                  <option key={c.chave} value={c.chave}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {statsClienteDetalhe && (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, color: "var(--text-dim)", margin: "14px 0 4px" }}>
                  <span>
                    <strong style={{ color: "var(--text)" }}>{statsClienteDetalhe.total}</strong> pedidas
                  </span>
                  <span>
                    <strong style={{ color: "var(--accent-text)" }}>{statsClienteDetalhe.coletada}</strong> coletadas
                  </span>
                  <span>
                    <strong style={{ color: "var(--danger)" }}>{statsClienteDetalhe.recusada}</strong> não atendidas
                  </span>
                  <span>
                    {statsClienteDetalhe.total > 0
                      ? Math.round((statsClienteDetalhe.coletada / statsClienteDetalhe.total) * 100)
                      : 0}
                    % concluído
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                  {coletasClienteDetalhe.map((coleta) => (
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
                          {coleta.coletor?.nome ? `Coletor: ${coleta.coletor.nome}` : "Sem coletor atribuído"}
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
            )}
          </div>

          <strong style={{ fontSize: 14 }}>Coletas por coletor</strong>
          <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 10px" }}>
            Quantas coletas cada coletor já concluiu (inclui coletores aprovados sem nenhuma ainda).
          </p>
          {indicadoresPorColetor.length === 0 && (
            <p style={{ color: "var(--text-dim)" }}>Nenhum coletor aprovado ainda.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {indicadoresPorColetor.map((item) => {
              const taxa = item.total > 0 ? Math.round((item.coletada / item.total) * 100) : 0;
              return (
                <div
                  key={item.chave}
                  className="card"
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                >
                  <strong style={{ overflowWrap: "anywhere" }}>{item.nome}</strong>
                  <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--text-dim)" }}>
                    <span>
                      <strong style={{ color: "var(--accent-text)" }}>{item.coletada}</strong> coletadas
                    </span>
                    <span>{item.total} atribuídas</span>
                    <span>{taxa}% concluído</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
