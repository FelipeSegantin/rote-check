import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import StatusBadge from "../../components/StatusBadge.jsx";
import AbaColetas from "../../components/AbaColetas.jsx";
import AbaRoteiro from "../../components/AbaRoteiro.jsx";
import AbaIndicadores from "../../components/AbaIndicadores.jsx";
import AbaHistorico from "../../components/AbaHistorico.jsx";
import AbaChatEquipe from "../../components/AbaChatEquipe.jsx";
import AbaUsuarios from "../../components/AbaUsuarios.jsx";
import AbaConvites from "../../components/AbaConvites.jsx";
import AbaVeiculos from "../../components/AbaVeiculos.jsx";
import RelogioAtual from "../../components/RelogioAtual.jsx";
import MapaRota from "../../components/MapaRota.jsx";

// "Aprovações" passou a viver dentro da aba "Convites" — as duas são sobre
// a mesma coisa (quem entra como usuário do sistema), então juntar deixa
// menos quadradinho na lista de abas.
const SECOES = [
  { valor: "coletas", label: "Coletas" },
  { valor: "roteiro", label: "Roteiro" },
  { valor: "rotas", label: "Rotas" },
  { valor: "mapa", label: "Mapa" },
  { valor: "indicadores", label: "Indicadores" },
  { valor: "historico", label: "Histórico" },
  { valor: "chat", label: "Chat" },
  { valor: "usuarios", label: "Usuários" },
  { valor: "convites", label: "Convites" },
  { valor: "veiculos", label: "Veículos" },
];

// Com a aba "Indicadores" a lista chegou a 10 abas no topo — pra não ficar
// tudo espremido numa linha só, agrupa por assunto (mesma ideia das
// sub-abas de Chat/Usuários/Convites, só que um nível acima). Nenhuma aba
// foi removida — só reorganizada em 3 grupos.
//
// Cada aba do grupo Acompanhamento/Equipe (menos Coletas/Roteiro/Rotas/
// Mapa, que continuam aqui mesmo) virou seu próprio componente em
// src/components/ — AbaIndicadores.jsx, AbaHistorico.jsx,
// AbaChatEquipe.jsx, AbaUsuarios.jsx, AbaConvites.jsx e AbaVeiculos.jsx —
// mesmo padrão que Coletas e Roteiro já usavam. Esse arquivo cuida só da
// navegação (grupos/abas) e do que sobrou específico do gerente (Rotas e
// Mapa). Chat e Convites reportam pra cá quantos itens têm pendente/não
// lido (onContagemNaoLidas/onContagemPendentes) só pra alimentar os
// números que aparecem ao lado do nome da aba e do grupo, sem precisar
// duplicar a busca dos dados aqui.
const GRUPOS = [
  { chave: "operacao", label: "Operação", secoes: ["coletas", "roteiro", "rotas", "mapa"] },
  { chave: "acompanhamento", label: "Acompanhamento", secoes: ["indicadores", "historico", "chat"] },
  { chave: "equipe", label: "Equipe", secoes: ["usuarios", "convites", "veiculos"] },
];

function grupoDaSecao(valor) {
  return GRUPOS.find((g) => g.secoes.includes(valor))?.chave || GRUPOS[0].chave;
}

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

export default function GerenteHome() {
  const [secao, setSecao] = useState("coletas");
  // Grupo do topo (Operação/Acompanhamento/Equipe) que está com a sub-lista
  // de abas aberta — ver comentário do GRUPOS acima.
  const [grupoAtivo, setGrupoAtivo] = useState(() => grupoDaSecao("coletas"));

  function selecionarGrupo(grupo) {
    setGrupoAtivo(grupo.chave);
    // Ao trocar de grupo, se a aba atual não pertence a ele, abre a
    // primeira aba desse grupo (nunca deixa a tela "sem aba nenhuma").
    if (!grupo.secoes.includes(secao)) {
      setSecao(grupo.secoes[0]);
    }
  }

  // Números que aparecem ao lado do nome da aba/grupo — Chat e Convites
  // reportam pra cá via onContagemNaoLidas/onContagemPendentes (ver
  // comentário do GRUPOS acima). Começam em 0 e só ficam certos depois
  // que a aba correspondente é aberta pelo menos uma vez — mesmo
  // comportamento de antes dessa lógica virar componente separado.
  const [contagemChatNaoLidas, setContagemChatNaoLidas] = useState(0);
  const [contagemPendentesAprovacao, setContagemPendentesAprovacao] = useState(0);

  // A aba "Coletas" (aceitar/recusar) agora vive no componente
  // compartilhado AbaColetas — igual pro gerente e pro despachante. Aqui
  // ainda precisamos de uma lista de coletores própria pras abas "Rotas"
  // e "Mapa", que continuam morando neste arquivo.
  const [coletores, setColetores] = useState([]);

  useEffect(() => {
    async function carregarColetores() {
      const { data } = await supabase
        .from("perfis")
        .select("id, nome, dia_iniciado_em")
        .eq("papel", "coletor")
        .eq("aprovado", true);
      setColetores(data || []);
    }
    carregarColetores();
  }, []);

  // --- Mapa (rota do coletor, ao vivo hoje ou revisitando um dia passado) --
  const [coletorMapa, setColetorMapa] = useState("");
  const [dataMapa, setDataMapa] = useState(hojeYMD());
  const [printsRota, setPrintsRota] = useState([]);
  const [carregandoPrints, setCarregandoPrints] = useState(false);
  const [printAmpliado, setPrintAmpliado] = useState(null);

  // Aproveita a entrada na aba Mapa pra limpar prints com mais de 15 dias —
  // o modo demo não tem um cron rodando sozinho, então isso serve de
  // "faxina" oportunista (no Supabase de verdade quem faz isso é o pg_cron
  // agendado em schema.sql, sem depender de ninguém abrir essa tela).
  useEffect(() => {
    if (secao !== "mapa") return;
    supabase.rpc("rotecheck_limpar_prints_antigos");
  }, [secao]);

  useEffect(() => {
    if (secao !== "mapa" || !coletorMapa) {
      setPrintsRota([]);
      return;
    }
    let ativo = true;
    async function carregarPrints() {
      setCarregandoPrints(true);
      const inicioDia = new Date(`${dataMapa}T00:00:00`);
      const fimDia = new Date(`${dataMapa}T23:59:59.999`);
      const { data } = await supabase
        .from("prints_rotas")
        .select("*")
        .eq("coletor_id", coletorMapa)
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
  }, [secao, coletorMapa, dataMapa]);

  // --- Rotas (montar a ordem das paradas de cada coletor) -----------------
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

  // Quantos avisos pendentes cada aba tem — usado tanto na sub-lista quanto
  // somado no botão do grupo, pra dar pra notar sem precisar abrir o grupo.
  function contadorSecao(valor) {
    if (valor === "convites") return contagemPendentesAprovacao;
    if (valor === "chat") return contagemChatNaoLidas;
    return 0;
  }

  const secoesDoGrupoAtivo = SECOES.filter((s) => GRUPOS.find((g) => g.chave === grupoAtivo)?.secoes.includes(s.valor));

  return (
    <div className="app-content">
      <RelogioAtual />
      <h1>Painel do gerente</h1>

      <div className="grupos-nav">
        {GRUPOS.map((g) => {
          const contador = g.secoes.reduce((soma, valor) => soma + contadorSecao(valor), 0);
          return (
            <button key={g.chave} className={`tab grupo-tab ${grupoAtivo === g.chave ? "active" : ""}`} onClick={() => selecionarGrupo(g)}>
              {g.label}
              {contador > 0 && <span className="contador-nao-lido">{contador}</span>}
            </button>
          );
        })}
      </div>

      <div className="tabs">
        {secoesDoGrupoAtivo.map((s) => (
          <button key={s.valor} className={`tab ${secao === s.valor ? "active" : ""}`} onClick={() => setSecao(s.valor)}>
            {s.label}
            {s.valor === "convites" && contagemPendentesAprovacao > 0 && ` (${contagemPendentesAprovacao})`}
            {s.valor === "chat" && contagemChatNaoLidas > 0 && (
              <span className="contador-nao-lido">{contagemChatNaoLidas}</span>
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
            Veja o trajeto de um coletor ao vivo (hoje) ou revisite qualquer dia
            anterior — os pontos de GPS ficam guardados e nunca são apagados.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div className="field" style={{ flex: "1 1 200px" }}>
              <label>Coletor</label>
              <select value={coletorMapa} onChange={(e) => setColetorMapa(e.target.value)}>
                <option value="">Escolher coletor...</option>
                {coletores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: "1 1 160px" }}>
              <label>Dia</label>
              <input type="date" value={dataMapa} max={hojeYMD()} onChange={(e) => setDataMapa(e.target.value)} />
            </div>
          </div>

          {dataMapa === hojeYMD() && (
            <p style={{ color: "var(--accent)", fontSize: 13, marginBottom: 8 }}>● Ao vivo — atualiza sozinho.</p>
          )}

          {!coletorMapa && <p style={{ color: "var(--text-dim)" }}>Escolha um coletor pra ver o mapa.</p>}
          {coletorMapa && <MapaRota coletorId={coletorMapa} data={dataMapa} />}

          {coletorMapa && (
            <div style={{ marginTop: 20 }}>
              <strong style={{ fontSize: 14 }}>Prints do dia</strong>
              <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 10px" }}>
                Gerado automaticamente quando o coletor aperta "Encerrar o dia" — é o trajeto do expediente inteiro,
                do início ao fim. Fica guardado por 15 dias.
              </p>

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
                    <img src={p.foto_url} alt="Print da rota" style={{ width: "100%", display: "block" }} />
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
                // Precisa ficar acima dos controles do Leaflet (o mapa ao
                // vivo logo acima usa z-index até 1000 nos próprios
                // botões de +/-), senão eles "vazam" por cima do print
                // ampliado em vez de ficarem escondidos atrás dele.
                zIndex: 2000,
              }}
              onClick={() => setPrintAmpliado(null)}
            >
              <img
                src={printAmpliado.foto_url}
                alt="Print da rota ampliado"
                style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }}
              />
            </div>
          )}
        </>
      )}

      {secao === "indicadores" && <AbaIndicadores />}

      {secao === "historico" && <AbaHistorico />}

      {secao === "chat" && <AbaChatEquipe onContagemNaoLidas={setContagemChatNaoLidas} />}

      {secao === "usuarios" && <AbaUsuarios />}

      {secao === "convites" && <AbaConvites onContagemPendentes={setContagemPendentesAprovacao} />}

      {secao === "veiculos" && <AbaVeiculos />}
    </div>
  );
}
