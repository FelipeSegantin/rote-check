import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth.jsx";
import MapaRota from "../../components/MapaRota.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import AbaColetas from "../../components/AbaColetas.jsx";
import AbaRoteiro from "../../components/AbaRoteiro.jsx";
import RelogioAtual from "../../components/RelogioAtual.jsx";
import { mapaUltimasMensagens, temNaoLida } from "../../lib/chatLeitura.js";

const SECOES = [
  { valor: "coletas", label: "Coletas" },
  { valor: "roteiro", label: "Roteiro" },
  { valor: "rotas", label: "Rotas" },
  { valor: "mapa", label: "Mapa" },
  { valor: "chat", label: "Chat" },
];

function hojeYMD() {
  // Data local, não UTC (mesmo motivo do MapaRota.jsx) — evita o "hoje" ao
  // vivo sumir por algumas horas perto da meia-noite UTC em fusos atrás
  // dela, como o do Brasil.
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export default function DespachanteHome() {
  const { perfil } = useAuth();
  const [secao, setSecao] = useState("coletas");

  const [coletores, setColetores] = useState([]);
  const [selecionado, setSelecionado] = useState(null);

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from("perfis")
        .select("id, nome, dia_iniciado_em")
        .eq("papel", "coletor")
        .eq("aprovado", true);
      setColetores(data || []);
      if (data?.length) setSelecionado(data[0].id);
    }
    carregar();
  }, []);

  // --- Prints do dia (trajeto completo do expediente, gerado quando o
  // coletor aperta "Encerrar o dia") — mesma visão que o gerente tem em
  // Mapa → Prints do dia, agora também disponível pro despachante. ---
  const [dataPrints, setDataPrints] = useState(hojeYMD());
  const [printsRota, setPrintsRota] = useState([]);
  const [carregandoPrints, setCarregandoPrints] = useState(false);
  const [printAmpliado, setPrintAmpliado] = useState(null);

  // Faxina oportunista dos prints com mais de 15 dias (mesma lógica do
  // painel do gerente — modo demo não tem cron rodando sozinho).
  useEffect(() => {
    if (secao !== "mapa") return;
    supabase.rpc("rotecheck_limpar_prints_antigos");
  }, [secao]);

  useEffect(() => {
    if (secao !== "mapa" || !selecionado) {
      setPrintsRota([]);
      return;
    }
    let ativo = true;
    async function carregarPrints() {
      setCarregandoPrints(true);
      const inicioDia = new Date(`${dataPrints}T00:00:00`);
      const fimDia = new Date(`${dataPrints}T23:59:59.999`);
      const { data } = await supabase
        .from("prints_rotas")
        .select("*")
        .eq("coletor_id", selecionado)
        .gte("iniciado_em", inicioDia.toISOString())
        .lte("iniciado_em", fimDia.toISOString())
        .order("iniciado_em", { ascending: false });
      if (ativo) {
        setPrintsRota(data || []);
        setCarregandoPrints(false);
      }
    }
    carregarPrints();
    return () => {
      ativo = false;
    };
  }, [secao, selecionado, dataPrints]);

  // --- Rotas (montar a ordem das paradas de cada coletor) — mesma função
  // que o gerente já tinha em Painel do gerente → Rotas, agora também
  // disponível pro despachante montar/ajustar a rota de qualquer coletor. --
  const [coletorRota, setColetorRota] = useState("");
  const [coletasParaRota, setColetasParaRota] = useState([]);
  const [rotaExistente, setRotaExistente] = useState(null);
  const [ordemRota, setOrdemRota] = useState([]);
  const [carregandoRota, setCarregandoRota] = useState(false);
  const [salvandoRota, setSalvandoRota] = useState(false);
  const [rotaSalva, setRotaSalva] = useState(false);

  useEffect(() => {
    if (secao !== "rotas" || !coletorRota) {
      setColetasParaRota([]);
      setRotaExistente(null);
      setOrdemRota([]);
      return;
    }
    setCarregandoRota(true);
    setRotaSalva(false);
    async function carregar() {
      const inicioDia = new Date();
      inicioDia.setHours(0, 0, 0, 0);
      const { data: coletasDoDia } = await supabase
        .from("coletas")
        .select("*, cliente:cliente_id(nome, estabelecimento)")
        .eq("coletor_id", coletorRota)
        .gte("criado_em", inicioDia.toISOString())
        .order("horario_solicitado", { ascending: true });

      const { data: rotasDoColetor } = await supabase.from("rotas").select("*").eq("coletor_id", coletorRota);
      const rota = rotasDoColetor?.[0] || null;

      const lista = coletasDoDia || [];
      setColetasParaRota(lista);
      setRotaExistente(rota);

      // Começa a partir da ordem já salva (só com coletas que ainda
      // existem hoje), e acrescenta no fim qualquer coleta nova que ainda
      // não estava na rota.
      const idsValidos = new Set(lista.map((c) => c.id));
      const ordemSalva = (rota?.coletas_ordem || []).filter((id) => idsValidos.has(id));
      const faltando = lista.map((c) => c.id).filter((id) => !ordemSalva.includes(id));
      setOrdemRota([...ordemSalva, ...faltando]);
      setCarregandoRota(false);
    }
    carregar();
  }, [secao, coletorRota]);

  function moverParada(index, direcao) {
    setOrdemRota((atual) => {
      const novoIndex = index + direcao;
      if (novoIndex < 0 || novoIndex >= atual.length) return atual;
      const copia = [...atual];
      [copia[index], copia[novoIndex]] = [copia[novoIndex], copia[index]];
      return copia;
    });
    setRotaSalva(false);
  }

  async function salvarRota() {
    setSalvandoRota(true);
    if (rotaExistente) {
      await supabase.from("rotas").update({ coletas_ordem: ordemRota, editado_manualmente: true }).eq("id", rotaExistente.id);
    } else {
      const { data } = await supabase
        .from("rotas")
        .insert({ coletor_id: coletorRota, coletas_ordem: ordemRota, editado_manualmente: true })
        .select();
      if (data?.[0]) setRotaExistente(data[0]);
    }
    setSalvandoRota(false);
    setRotaSalva(true);
  }

  const coletasPorId = Object.fromEntries(coletasParaRota.map((c) => [c.id, c]));

  const [coletasChat, setColetasChat] = useState([]);
  const [carregandoChat, setCarregandoChat] = useState(false);
  const [ultimasMensagensChat, setUltimasMensagensChat] = useState({});
  // Sub-aba dentro de "Chat" — mesmo padrão de Pendentes/Aceitas/etc de
  // Coletas: separa a conversa com cliente da conversa com coletor, pra
  // não empilhar as duas listas na mesma tela.
  const [abaChat, setAbaChat] = useState("clientes");
  const [ultimasMensagensColetores, setUltimasMensagensColetores] = useState({});

  useEffect(() => {
    if (secao !== "chat") return;
    setCarregandoChat(true);
    async function carregar() {
      const { data } = await supabase
        .from("coletas")
        .select("*, cliente:cliente_id(nome, estabelecimento), coletor:coletor_id(nome)")
        .order("criado_em", { ascending: false });
      setColetasChat(data || []);
      setCarregandoChat(false);

      const ids = (data || []).map((c) => c.id);
      if (ids.length) {
        const { data: msgs } = await supabase.from("mensagens").select("*").in("coleta_id", ids);
        setUltimasMensagensChat(mapaUltimasMensagens(msgs || []));
      }

      const coletorIds = coletores.map((c) => c.id);
      if (coletorIds.length) {
        const { data: msgsColetores } = await supabase.from("mensagens").select("*").in("coletor_id", coletorIds);
        setUltimasMensagensColetores(mapaUltimasMensagens(msgsColetores || []));
      }
    }
    carregar();
  }, [secao, coletores]);

  const coletasComNaoLida = coletasChat.filter((c) => temNaoLida(c.id, ultimasMensagensChat[c.id], perfil?.id)).length;
  const coletoresComNaoLida = coletores.filter((c) => temNaoLida(c.id, ultimasMensagensColetores[c.id], perfil?.id)).length;

  return (
    <div className="app-content">
      <RelogioAtual />
      <h1>Painel do despachante</h1>

      <div className="tabs">
        {SECOES.map((s) => (
          <button key={s.valor} className={`tab ${secao === s.valor ? "active" : ""}`} onClick={() => setSecao(s.valor)}>
            {s.label}
            {s.valor === "chat" && coletasComNaoLida + coletoresComNaoLida > 0 && (
              <span className="contador-nao-lido">{coletasComNaoLida + coletoresComNaoLida}</span>
            )}
          </button>
        ))}
      </div>

      {secao === "coletas" && <AbaColetas />}

      {secao === "roteiro" && <AbaRoteiro />}

      {secao === "rotas" && (
        <>
          <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 12 }}>
            Escolha um coletor e defina a ordem das paradas da rota de hoje dele.
          </p>

          <div className="field">
            <label>Coletor</label>
            <select value={coletorRota} onChange={(e) => setColetorRota(e.target.value)}>
              <option value="">Escolher coletor...</option>
              {coletores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {!coletorRota && <p style={{ color: "var(--text-dim)" }}>Escolha um coletor pra montar a rota dele.</p>}
          {coletorRota && carregandoRota && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}
          {coletorRota && !carregandoRota && coletasParaRota.length === 0 && (
            <p style={{ color: "var(--text-dim)" }}>Esse coletor não tem nenhuma coleta atribuída hoje.</p>
          )}

          {coletorRota && !carregandoRota && coletasParaRota.length > 0 && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                {ordemRota.map((id, index) => {
                  const coleta = coletasPorId[id];
                  if (!coleta) return null;
                  return (
                    <div key={id} className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span className="badge-papel">{index + 1}ª</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ overflowWrap: "anywhere" }}>{coleta.local}</strong>
                        <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "2px 0 0" }}>
                          {coleta.cliente?.estabelecimento || coleta.cliente?.nome} · <StatusBadge status={coleta.status} />
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "2px 10px" }}
                          onClick={() => moverParada(index, -1)}
                          disabled={index === 0}
                          aria-label="Mover para cima"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "2px 10px" }}
                          onClick={() => moverParada(index, 1)}
                          disabled={index === ordemRota.length - 1}
                          aria-label="Mover para baixo"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {rotaSalva && <p style={{ color: "var(--accent)", fontSize: 14, marginTop: 10 }}>Rota salva.</p>}

              <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={salvarRota} disabled={salvandoRota}>
                {salvandoRota ? "Salvando..." : "Salvar rota"}
              </button>
            </>
          )}
        </>
      )}

      {secao === "mapa" && (
        <>
          <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 12 }}>
            Acompanhe por onde cada coletor está passando hoje, e reveja os prints do dia de qualquer coletor.
          </p>

          <div className="tabs">
            {coletores.map((c) => (
              <button key={c.id} className={`tab ${selecionado === c.id ? "active" : ""}`} onClick={() => setSelecionado(c.id)}>
                {c.nome}
              </button>
            ))}
          </div>

          {selecionado && <MapaRota coletorId={selecionado} />}
          {!selecionado && <p style={{ color: "var(--text-dim)" }}>Nenhum coletor ativo.</p>}

          {selecionado && (
            <div style={{ marginTop: 20 }}>
              <strong style={{ fontSize: 14 }}>Prints do dia</strong>
              <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 10px" }}>
                Gerado automaticamente quando o coletor aperta "Encerrar o dia" — é o trajeto do expediente inteiro,
                do início ao fim. Fica guardado por 15 dias.
              </p>

              <div className="field" style={{ maxWidth: 200, marginBottom: 10 }}>
                <label>Dia</label>
                <input type="date" value={dataPrints} max={hojeYMD()} onChange={(e) => setDataPrints(e.target.value)} />
              </div>

              {carregandoPrints && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}
              {!carregandoPrints && printsRota.length === 0 && (
                <p style={{ color: "var(--text-dim)" }}>Nenhum print salvo nesse dia.</p>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {printsRota.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="card"
                    style={{ padding: 0, overflow: "hidden", cursor: "pointer", border: "none", width: 160, textAlign: "left" }}
                    onClick={() => setPrintAmpliado(p)}
                  >
                    <img src={p.foto_url} alt="Print do dia" style={{ width: "100%", display: "block" }} />
                    <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "6px 8px" }}>
                      {new Date(p.iniciado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {" – "}
                      {new Date(p.encerrado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {printAmpliado && (
            <div
              role="button"
              tabIndex={0}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
                // Mesmo motivo do painel do gerente: precisa ficar acima
                // dos controles do Leaflet (até z-index 1000).
                zIndex: 2000,
              }}
              onClick={() => setPrintAmpliado(null)}
            >
              <img
                src={printAmpliado.foto_url}
                alt="Print do dia ampliado"
                style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }}
              />
            </div>
          )}
        </>
      )}

      {secao === "chat" && (
        <>
          <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 12 }}>
            Fale com o cliente de cada coleta, ou direto com qualquer coletor da equipe. Não existe chat direto
            entre cliente e coletor.
          </p>

          {/* Sub-abas — mesmo padrão de Pendentes/Aceitas/etc de Coletas:
              separa a conversa com cliente da conversa com coletor, pra
              não empilhar as duas listas na mesma tela. */}
          <div className="tabs">
            <button className={`tab ${abaChat === "clientes" ? "active" : ""}`} onClick={() => setAbaChat("clientes")}>
              Clientes
              {coletasComNaoLida > 0 && <span className="contador-nao-lido">{coletasComNaoLida}</span>}
            </button>
            <button className={`tab ${abaChat === "coletores" ? "active" : ""}`} onClick={() => setAbaChat("coletores")}>
              Coletores
              {coletoresComNaoLida > 0 && <span className="contador-nao-lido">{coletoresComNaoLida}</span>}
            </button>
          </div>

          {abaChat === "clientes" && (
            <>
              {carregandoChat && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}
              {!carregandoChat && coletasChat.length === 0 && (
                <p style={{ color: "var(--text-dim)" }}>Nenhuma coleta registrada ainda.</p>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {coletasChat.map((coleta) => (
                  <div key={coleta.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {coleta.local}
                        {temNaoLida(coleta.id, ultimasMensagensChat[coleta.id], perfil?.id) && (
                          <span className="ponto-nao-lido" title="Mensagem nova no chat" />
                        )}
                      </strong>
                      <StatusBadge status={coleta.status} />
                    </div>
                    <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 10px" }}>
                      Cliente: {(coleta.cliente?.estabelecimento || coleta.cliente?.nome)} · Coletor: {coleta.coletor?.nome || "não atribuído"}
                    </p>
                    <Link to={`/coletas/${coleta.id}`} className="btn btn-secondary" style={{ display: "block", textAlign: "center" }}>
                      Abrir chat
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}

          {abaChat === "coletores" && (
            <>
              {coletores.length === 0 && <p style={{ color: "var(--text-dim)" }}>Nenhum coletor aprovado ainda.</p>}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {coletores.map((c) => (
                  <div key={c.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {c.nome}
                        {temNaoLida(c.id, ultimasMensagensColetores[c.id], perfil?.id) && (
                          <span className="ponto-nao-lido" title="Mensagem nova no chat" />
                        )}
                      </strong>
                      <StatusBadge
                        status={c.dia_iniciado_em ? "dia_iniciado" : "dia_nao_iniciado"}
                        label={
                          c.dia_iniciado_em
                            ? `Iniciou às ${new Date(c.dia_iniciado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                            : "Não iniciou"
                        }
                      />
                    </div>
                    <Link
                      to={`/chat-coletor/${c.id}`}
                      className="btn btn-secondary"
                      style={{ display: "block", textAlign: "center", marginTop: 10 }}
                    >
                      Abrir chat
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
