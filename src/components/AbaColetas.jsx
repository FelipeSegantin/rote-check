import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import StatusBadge from "./StatusBadge.jsx";
import { casarClienteEsperado } from "../lib/clientesEsperados.js";

const ABAS_COLETA = [
  { valor: "pendente", label: "Pendentes" },
  { valor: "aceita", label: "Aceitas" },
  { valor: "recusada", label: "Não atendidas" },
  { valor: "coletada", label: "Coletadas" },
];

// Aba operacional de aceitar coleta — usada tanto pelo gerente quanto pelo
// despachante, que têm exatamente a mesma responsabilidade aqui. Ao
// aceitar, o coletor é descoberto sozinho a partir do roteiro (mesmo
// casamento por CNPJ/nome do aviso de moto em Nova Coleta — ver
// clientesEsperados.js) — não precisa mais escolher manualmente quem vai
// atender. Só sobra um seletor manual pros casos raros em que o cliente
// ainda não está em nenhuma planilha de roteiro (cliente novo, por
// exemplo), senão não teria como saber qual coletor mandar.
//
// Não recusa mais pedido por aqui — desde que o cliente passou a ter um
// prazo (até o horário da saída, ver janelaPedido.js) pra pedir a coleta,
// não sobra motivo de negar um pedido antes de despachar. "Recusadas"
// continua existindo como aba só pra ver o histórico de antes dessa
// mudança; quem cobre o caso do cliente não estar no local agora é o
// próprio coletor, na hora da coleta (ver ColetorHome.jsx).
export default function AbaColetas() {
  const [aba, setAba] = useState("pendente");
  const [coletas, setColetas] = useState([]);
  const [coletores, setColetores] = useState([]);
  const [clientesEsperados, setClientesEsperados] = useState([]);
  const [escolha, setEscolha] = useState({});
  // Sub-filtro por coletor, dentro de cada aba de status: um <select> (em
  // vez de um botão por coletor, que ocuparia várias linhas conforme a
  // equipe cresce) pra ver só as coletas de um coletor específico sem sair
  // da aba (Pendentes, Aceitas, Não atendidas ou Coletadas). Só entra em
  // jogo quando a coleta já tem coletor_id atribuído (a partir de "aceita"
  // em diante) — em Pendentes, filtrar por coletor não mostra nada porque
  // ainda não foi aceita por ninguém.
  const [coletorFiltroId, setColetorFiltroId] = useState("todos");
  const [erroAceitar, setErroAceitar] = useState("");
  const coletoresEmOrdemAlfabetica = [...coletores].sort((a, b) => a.nome.localeCompare(b.nome));
  const coletasFiltradas =
    coletorFiltroId === "todos" ? coletas : coletas.filter((c) => c.coletor_id === coletorFiltroId);

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from("coletas")
        .select("*, cliente:cliente_id(nome, estabelecimento, cnpj), coletor:coletor_id(nome)")
        .eq("status", aba)
        .order("criado_em", { ascending: false });
      setColetas(data || []);
    }
    carregar();

    const canal = supabase
      .channel("coletas-aceitar-recusar")
      .on("postgres_changes", { event: "*", schema: "public", table: "coletas" }, carregar)
      .subscribe();

    return () => supabase.removeChannel(canal);
  }, [aba]);

  useEffect(() => {
    async function carregarColetores() {
      const { data } = await supabase.from("perfis").select("id, nome").eq("papel", "coletor").eq("aprovado", true);
      setColetores(data || []);
    }
    carregarColetores();

    async function carregarClientesEsperados() {
      const { data } = await supabase.from("clientes_esperados").select("nome, cnpj, coletor_id");
      setClientesEsperados(data || []);
    }
    carregarClientesEsperados();
  }, []);

  // Coletor que o roteiro já indica pra esse cliente (via CNPJ ou nome do
  // estabelecimento) — null quando o cliente não está em nenhuma planilha
  // de roteiro ainda, e aí precisa escolher manualmente.
  function coletorDoRoteiro(coleta) {
    const achado = casarClienteEsperado(coleta.cliente, clientesEsperados);
    return achado?.coletor_id || null;
  }

  async function aceitar(coleta) {
    const coletorId = coletorDoRoteiro(coleta) || escolha[coleta.id];
    if (!coletorId) return;
    setErroAceitar("");
    const { error } = await supabase
      .from("coletas")
      .update({ status: "aceita", coletor_id: coletorId })
      .eq("id", coleta.id);
    // Antes esse erro era ignorado — a coleta parecia "aceita" na hora
    // (o clique acontecia, nada quebrava na tela) mas se o update não
    // salvasse de verdade (RLS, gatilho travando etc.), ela sumia do
    // fluxo: não aparecia mais nem em Pendentes (ao trocar de aba) nem em
    // Aceitas. Agora mostra o motivo em vez de falhar calado.
    if (error) {
      setErroAceitar(`Não deu pra aceitar essa coleta: ${error.message}`);
    }
    // Sem recarregar manualmente aqui: a assinatura realtime no useEffect
    // abaixo (canal "coletas-aceitar-recusar", ouvindo "*" em coletas) já
    // chama carregar() sozinha assim que o update realmente for salvo.
  }

  return (
    <>
      <div className="tabs">
        {ABAS_COLETA.map((a) => (
          <button
            key={a.valor}
            className={`tab tab-compacta ${aba === a.valor ? "active" : ""}`}
            onClick={() => {
              setAba(a.valor);
              setColetorFiltroId("todos");
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Só faz sentido filtrar por coletor no histórico (Aceitas/Não
          atendidas/Coletadas) — em Pendentes é onde o despachante/gerente
          ACEITA a coleta, e nenhuma delas tem coletor definido ainda, então
          o filtro não tinha função ali (só ocupava espaço no meio do fluxo
          de aceitar). */}
      {aba !== "pendente" && (
        <div className="filtro-coletor">
          <label htmlFor="filtro-coletor-select">Coletor</label>
          <select
            id="filtro-coletor-select"
            value={coletorFiltroId}
            onChange={(e) => setColetorFiltroId(e.target.value)}
          >
            <option value="todos">Todos os coletores</option>
            {coletoresEmOrdemAlfabetica.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {erroAceitar && <p style={{ color: "var(--danger)", fontSize: 14 }}>{erroAceitar}</p>}

      {coletasFiltradas.length === 0 && (
        <p style={{ color: "var(--text-dim)" }}>
          {coletorFiltroId === "todos" ? "Nenhuma coleta nesta aba." : "Nenhuma coleta desse coletor nesta aba."}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {coletasFiltradas.map((coleta) => (
          <div key={coleta.id} className="card" style={{ display: "flex", gap: 12 }}>
            {coleta.status === "recusada" &&
              (coleta.foto_url ? (
                <img src={coleta.foto_url} className="foto-miniatura" alt={`Foto do coletor em ${coleta.local}`} />
              ) : (
                <div className="foto-miniatura-vazia">Sem foto</div>
              ))}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{coleta.local}</strong>
                <StatusBadge status={coleta.status} />
              </div>
              <p style={{ color: "var(--text-dim)", fontSize: 14, margin: "6px 0" }}>
                Cliente: {(coleta.cliente?.estabelecimento || coleta.cliente?.nome)} · {coleta.veiculo_tipo} · {coleta.tipo_produto}
                <br />
                {new Date(coleta.horario_solicitado).toLocaleString("pt-BR")}
                {coleta.risco_atraso && <span style={{ color: "var(--amber)" }}> · risco de atraso</span>}
              </p>
              {coleta.observacao && <p style={{ fontSize: 14 }}>Obs.: {coleta.observacao}</p>}
              {coleta.coletor?.nome && <p style={{ fontSize: 14 }}>Coletor: {coleta.coletor.nome}</p>}
              {coleta.status === "recusada" && coleta.motivo_recusa && (
                <p style={{ color: "var(--danger)", fontSize: 14, margin: "6px 0 0" }}>Motivo: {coleta.motivo_recusa}</p>
              )}

            {aba === "pendente" && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {coletorDoRoteiro(coleta) ? (
                  <p style={{ fontSize: 14, margin: 0 }}>
                    Coletor (pelo roteiro):{" "}
                    <strong>{coletores.find((c) => c.id === coletorDoRoteiro(coleta))?.nome || "—"}</strong>
                  </p>
                ) : (
                  <>
                    <p style={{ color: "var(--amber)", fontSize: 13, margin: 0 }}>
                      Esse cliente ainda não está no roteiro — escolha o coletor manualmente.
                    </p>
                    <select
                      value={escolha[coleta.id] || ""}
                      onChange={(e) => setEscolha((s) => ({ ...s, [coleta.id]: e.target.value }))}
                    >
                      <option value="">Escolher coletor...</option>
                      {coletores.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => aceitar(coleta)}
                  disabled={!coletorDoRoteiro(coleta) && !escolha[coleta.id]}
                >
                  Aceitar
                </button>
              </div>
            )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
