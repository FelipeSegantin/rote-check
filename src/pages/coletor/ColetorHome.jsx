import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth.jsx";
import { registrarPosicaoAtual } from "../../components/MapaRota.jsx";
import { gerarPrintRota } from "../../lib/gerarPrintRota.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import RelogioAtual from "../../components/RelogioAtual.jsx";
import { temNaoLida } from "../../lib/chatLeitura.js";

// Guarda o horário de início do dia de trabalho em andamento no
// localStorage (por coletor), pra sobreviver a um refresh/fechar-e-abrir o
// app no meio do expediente — senão apertar "Encerrar o dia" depois de
// recarregar a página perderia o horário de início. Antes isso era por
// saída (Iniciar/Finalizar rota); agora é um único print por dia inteiro
// de trabalho, do "Iniciar o dia" até o "Encerrar o dia".
const chaveDiaAtivo = (coletorId) => `rotecheck_dia_ativo_${coletorId}`;

const LABEL_VEICULO = { CARRO: "Carro", MOTO: "Moto" };

// Mesmo mapeamento de dias da aba "Roteiro" do despachante/gerente
// (1=segunda ... 6=sábado), mas sem o "cai em segunda" de lá — aqui é a
// rota de hoje de verdade, então domingo (sem roteiro) mostra vazio em vez
// de emprestar a segunda-feira.
const DIA_SEMANA_LABEL = { 1: "segunda-feira", 2: "terça-feira", 3: "quarta-feira", 4: "quinta-feira", 5: "sexta-feira", 6: "sábado" };
function diaSemanaHoje() {
  const d = new Date().getDay(); // 0=domingo...6=sábado
  return d === 0 ? null : d;
}

// Data de hoje no formato "AAAA-MM-DD", em horário local (não usa
// toISOString, que é em UTC e pode "virar o dia" errado perto da
// meia-noite) — é o que identifica, junto com a parada, uma confirmação de
// roteiro fixo do dia.
function dataLocalHojeISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export default function ColetorHome() {
  const { perfil } = useAuth();
  const [coletas, setColetas] = useState([]);
  const [rota, setRota] = useState(null);
  const [erroConfirmar, setErroConfirmar] = useState("");

  // --- Iniciar/encerrar o dia → gera o "print" do trajeto do dia inteiro
  // pro despachante e pro gerente ---
  const [diaAtivoDesde, setDiaAtivoDesde] = useState(null);
  const [salvandoPrint, setSalvandoPrint] = useState(false);
  const [avisoPrint, setAvisoPrint] = useState("");

  // Abas da tela do coletor (só existem depois de iniciar o dia): "Confirmar"
  // é onde ele tira foto e confirma cada parada (fixa ou por demanda);
  // "Roteiro" é só a referência do trajeto fixo de hoje, pra consulta.
  const [abaColetor, setAbaColetor] = useState("confirmar");

  useEffect(() => {
    if (!perfil?.id) return;
    const salvo = localStorage.getItem(chaveDiaAtivo(perfil.id));
    if (salvo) setDiaAtivoDesde(salvo);
  }, [perfil?.id]);

  async function iniciarDia() {
    const agora = new Date().toISOString();
    localStorage.setItem(chaveDiaAtivo(perfil.id), agora);
    setDiaAtivoDesde(agora);
    setAvisoPrint("");
    // Salva no perfil (não só no localStorage deste aparelho) pra
    // despachante e gerente verem, na aba Chat → Coletores, que esse
    // coletor já começou o expediente.
    await supabase.from("perfis").update({ dia_iniciado_em: agora }).eq("id", perfil.id);
  }

  async function encerrarDia() {
    if (!diaAtivoDesde || !perfil?.id) return;
    setSalvandoPrint(true);
    setAvisoPrint("");
    const fimEm = new Date().toISOString();

    const { data: pontos } = await supabase
      .from("posicoes_gps")
      .select("latitude, longitude, registrado_em")
      .eq("coletor_id", perfil.id)
      .gte("registrado_em", diaAtivoDesde)
      .lte("registrado_em", fimEm)
      .order("registrado_em", { ascending: true });

    try {
      // Sem nenhum ponto de GPS nesse intervalo não tem trajeto nenhum pra
      // mostrar — não faz sentido gerar/guardar um print vazio, então nem
      // chama gerarPrintRota nesse caso.
      if (pontos?.length) {
        const imagem = await gerarPrintRota({
          pontos,
          coletorNome: perfil.nome,
          inicioEm: diaAtivoDesde,
          fimEm,
        });

        let salvo = false;
        if (imagem) {
          const caminho = `${perfil.id}/${Date.now()}.png`;
          const { error: erroUpload } = await supabase.storage.from("prints-rotas").upload(caminho, imagem);
          if (!erroUpload) {
            const { data: urlData } = supabase.storage.from("prints-rotas").getPublicUrl(caminho);
            const { error: erroInsert } = await supabase.from("prints_rotas").insert({
              coletor_id: perfil.id,
              iniciado_em: diaAtivoDesde,
              encerrado_em: fimEm,
              foto_url: urlData.publicUrl,
            });
            salvo = !erroInsert;
          }
        }
        setAvisoPrint(
          salvo
            ? "Print do dia salvo! O despachante e o gerente podem ver em Mapa → Prints do dia."
            : "Dia encerrado, mas não deu pra salvar o print dessa vez — tente de novo mais tarde."
        );
      } else {
        setAvisoPrint(
          "Dia encerrado, mas nenhuma posição de GPS foi registrada nesse intervalo — nenhum print foi gerado."
        );
      }
    } finally {
      localStorage.removeItem(chaveDiaAtivo(perfil.id));
      setDiaAtivoDesde(null);
      setSalvandoPrint(false);
      // Mesma sincronização do iniciarDia — volta a mostrar "não iniciado"
      // pra quem está olhando o painel de despachante/gerente.
      await supabase.from("perfis").update({ dia_iniciado_em: null }).eq("id", perfil.id);
    }
  }

  useEffect(() => {
    if (!perfil?.id) return;

    async function carregar() {
      const inicioDia = new Date();
      inicioDia.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("coletas")
        .select("*, cliente:cliente_id(nome, estabelecimento)")
        .eq("coletor_id", perfil.id)
        .gte("criado_em", inicioDia.toISOString())
        .order("horario_solicitado", { ascending: true });

      // A rota do dia (se o despachante/gerente já definiu uma) traz a
      // ordem certa das paradas — quando existe, a lista segue essa
      // ordem em vez de só cronológica.
      const { data: rotas } = await supabase.from("rotas").select("*").eq("coletor_id", perfil.id);
      const rotaDoDia = rotas?.[0] || null;
      setRota(rotaDoDia);

      const lista = data || [];
      if (rotaDoDia?.coletas_ordem?.length) {
        const ordem = rotaDoDia.coletas_ordem;
        const ordenadas = [...lista].sort((a, b) => {
          const ia = ordem.indexOf(a.id);
          const ib = ordem.indexOf(b.id);
          if (ia === -1 && ib === -1) return 0;
          if (ia === -1) return 1; // fora da rota definida vai pro fim
          if (ib === -1) return -1;
          return ia - ib;
        });
        setColetas(ordenadas);
      } else {
        setColetas(lista);
      }
    }
    carregar();

    // Registra a posição a cada 20s enquanto a tela está aberta —
    // alimenta o mapa que despachante/gerente acompanham.
    const intervalo = setInterval(() => registrarPosicaoAtual(perfil.id), 20000);
    registrarPosicaoAtual(perfil.id);

    return () => clearInterval(intervalo);
  }, [perfil?.id]);

  // --- Roteiro fixo de hoje (o mesmo que despachante/gerente cadastram na
  // aba "Roteiro", vindo da planilha) — cada coletor só vê o dele. ---
  const [paradasFixasHoje, setParadasFixasHoje] = useState([]);
  const [carregandoRoteiro, setCarregandoRoteiro] = useState(false);
  const diaSemana = diaSemanaHoje();

  useEffect(() => {
    if (!perfil?.id) return;
    setCarregandoRoteiro(true);
    async function carregarRoteiro() {
      const { data } = await supabase.from("paradas_fixas").select("*").eq("coletor_id", perfil.id).eq("ativa", true);
      setParadasFixasHoje(data || []);
      setCarregandoRoteiro(false);
    }
    carregarRoteiro();
  }, [perfil?.id]);

  // Agrupa por saída (1ª, 2ª...), igual à aba Roteiro — só que já filtrado
  // pro dia de hoje e pra esse coletor.
  const saidasDeHoje = (() => {
    if (!diaSemana) return [];
    const doDia = paradasFixasHoje.filter((p) => (p.dias_semana || []).includes(diaSemana));
    const porSaida = {};
    for (const p of doDia) {
      const chave = p.saida_numero ?? 1;
      if (!porSaida[chave]) porSaida[chave] = { numero: chave, horario: p.horario_saida, veiculo: p.veiculo, paradas: [] };
      porSaida[chave].paradas.push(p);
    }
    return Object.values(porSaida)
      .map((s) => ({ ...s, paradas: [...s.paradas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)) }))
      .sort((a, b) => a.numero - b.numero);
  })();

  // --- Confirmações do roteiro fixo de hoje: cada parada fixa confirmada
  // vira uma linha aqui, uma por parada por dia — é o que "completa" uma
  // coleta do roteiro fixo, igual pras coletas por demanda (ver
  // confirmarColeta/marcarClienteAusente mais abaixo). Confirmar não exige
  // foto — só exige foto quando o cliente não atende (cliente_ausente),
  // como prova de que o coletor esteve no local. ---
  const [confirmacoesHoje, setConfirmacoesHoje] = useState([]);

  useEffect(() => {
    if (!perfil?.id) return;
    async function carregarConfirmacoes() {
      const { data } = await supabase
        .from("confirmacoes_parada_fixa")
        .select("*")
        .eq("coletor_id", perfil.id)
        .eq("data", dataLocalHojeISO());
      setConfirmacoesHoje(data || []);
    }
    carregarConfirmacoes();
  }, [perfil?.id]);

  // Mapa (não só um Set de ids) porque precisa saber, além de "já
  // confirmada", se foi um "cliente ausente" — pra trocar o selo mostrado.
  const confirmacaoPorParadaId = new Map(confirmacoesHoje.map((c) => [c.parada_fixa_id, c]));

  async function confirmarParadaFixa(parada) {
    const dados = {
      parada_fixa_id: parada.id,
      coletor_id: perfil.id,
      data: dataLocalHojeISO(),
      foto_url: null,
      cliente_ausente: false,
      marcado_por: perfil.id,
    };
    const { data: inserida } = await supabase.from("confirmacoes_parada_fixa").insert(dados).select();
    setConfirmacoesHoje((atual) => [...atual, inserida?.[0] || dados]);
  }

  async function marcarParadaFixaClienteAusente(parada, arquivoFoto) {
    let fotoUrl = null;
    if (arquivoFoto) {
      const caminho = `${parada.id}/${Date.now()}-${arquivoFoto.name}`;
      const { error: erroUpload } = await supabase.storage.from("fotos-coletas").upload(caminho, arquivoFoto);
      if (!erroUpload) {
        const { data } = supabase.storage.from("fotos-coletas").getPublicUrl(caminho);
        fotoUrl = data.publicUrl;
      }
    }

    const dados = {
      parada_fixa_id: parada.id,
      coletor_id: perfil.id,
      data: dataLocalHojeISO(),
      foto_url: fotoUrl,
      cliente_ausente: true,
      marcado_por: perfil.id,
    };
    const { data: inserida } = await supabase.from("confirmacoes_parada_fixa").insert(dados).select();
    setConfirmacoesHoje((atual) => [...atual, inserida?.[0] || dados]);
  }

  // --- Chat com a equipe (despachante/gerente) — só depois de apertar
  // "Iniciar o dia", igual à rota e à confirmação de coleta: o coletor só
  // tem acesso às funções da tela depois que o expediente começa. ---
  const [ultimaMsgEquipe, setUltimaMsgEquipe] = useState(null);

  useEffect(() => {
    if (!perfil?.id) return;
    async function carregarUltimaMensagem() {
      const { data } = await supabase
        .from("mensagens")
        .select("*")
        .eq("coletor_id", perfil.id)
        .order("criado_em", { ascending: false });
      setUltimaMsgEquipe(data?.[0] || null);
    }
    carregarUltimaMensagem();
  }, [perfil?.id]);

  const temMensagemNaoLidaDaEquipe = temNaoLida(perfil?.id, ultimaMsgEquipe, perfil?.id);

  // Confirma a coleta por demanda sem precisar de foto — agora que o
  // cliente só consegue pedir dentro do prazo (até o horário da saída, ver
  // janelaPedido.js), não faz mais sentido exigir foto toda vez: quem
  // precisa de foto é só o caso do cliente não estar no local (função
  // abaixo), como prova de que o coletor esteve lá mesmo sem coletar nada.
  async function confirmarColeta(coleta) {
    setErroConfirmar("");
    const { error } = await supabase.from("coletas").update({ status: "coletada" }).eq("id", coleta.id);
    // Antes isso não checava erro nenhum e atualizava a tela mesmo quando o
    // update não salvava de verdade no banco (foi o que deixou um monte de
    // coleta "confirmada" na tela do coletor mas travada em "aceita" pra
    // sempre no banco — por isso sumiam do histórico de Coletadas do
    // despachante/gerente). Agora só atualiza a tela se realmente salvou.
    if (error) {
      setErroConfirmar(`Não deu pra confirmar essa coleta: ${error.message}`);
      return;
    }
    setColetas((atual) => atual.map((c) => (c.id === coleta.id ? { ...c, status: "coletada" } : c)));
  }

  // Cliente não atendeu na hora da coleta — a foto aqui é a prova de que o
  // coletor esteve lá, não uma confirmação de que a coleta aconteceu.
  // Reaproveita o status "recusada" (mesmo que já existia pro
  // despachante/gerente recusar antes de despachar, coisa que não existe
  // mais) pra manter o histórico e os Indicadores consistentes — só que
  // agora todo lugar que mostra esse status usa o rótulo "Não atendida",
  // nunca mais a palavra "recusa" (ver StatusBadge.jsx).
  async function marcarClienteAusente(coleta, arquivoFoto) {
    let fotoUrl = coleta.foto_url;
    if (arquivoFoto) {
      const caminho = `${coleta.id}/${Date.now()}-${arquivoFoto.name}`;
      const { error: erroUpload } = await supabase.storage.from("fotos-coletas").upload(caminho, arquivoFoto);
      if (!erroUpload) {
        const { data } = supabase.storage.from("fotos-coletas").getPublicUrl(caminho);
        fotoUrl = data.publicUrl;
      }
    }

    setErroConfirmar("");
    const dados = { status: "recusada", motivo_recusa: "Cliente não atendeu", foto_url: fotoUrl };
    const { error } = await supabase.from("coletas").update(dados).eq("id", coleta.id);
    if (error) {
      setErroConfirmar(`Não deu pra registrar: ${error.message}`);
      return;
    }
    setColetas((atual) => atual.map((c) => (c.id === coleta.id ? { ...c, ...dados } : c)));
  }

  const ordem = rota?.coletas_ordem || [];

  // Card de uma parada fixa dentro da aba "Confirmar": mostra o status
  // (confirmada, cliente ausente, ou pendente) e, enquanto não confirmada,
  // os dois botões — "Confirmar" sem foto, e "Cliente não atendeu" com
  // foto como prova.
  function CardParadaFixaConfirmar({ p }) {
    const confirmacao = confirmacaoPorParadaId.get(p.id);
    const confirmada = !!confirmacao;
    const ausente = !!confirmacao?.cliente_ausente;
    // Quando quem marcou "sem coleta hoje" não foi o próprio coletor, foi o
    // despachante ou o gerente marcando de longe — avisa aqui pra ele não
    // estranhar já achar a parada marcada sem ter feito nada.
    const marcadoPelaEquipe = ausente && confirmacao?.marcado_por && confirmacao.marcado_por !== perfil.id;
    return (
      <div data-parada-id={p.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="badge-papel">{p.ordem}ª</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ overflowWrap: "anywhere" }}>{p.nome}</strong>
            <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "2px 0 0" }}>{p.endereco}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <StatusBadge
              status={!confirmada ? "pendente" : ausente ? "recusada" : "coletada"}
              label={!confirmada ? "Pendente" : ausente ? "Sem coleta hoje" : "Confirmada"}
            />
            {marcadoPelaEquipe && (
              <span style={{ color: "var(--text-dim)", fontSize: 11 }}>marcado pela equipe</span>
            )}
          </div>
        </div>
        {!confirmada && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={() => confirmarParadaFixa(p)}>
              Confirmar
            </button>
            <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
              Cliente não atendeu — tirar foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && marcarParadaFixaClienteAusente(p, e.target.files[0])}
              />
            </label>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-content">
      <RelogioAtual />
      <h1>Meu dia</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 14 }}>Dia de trabalho</strong>
        <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 10px" }}>
          {diaAtivoDesde
            ? `Expediente em andamento desde ${new Date(diaAtivoDesde).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Ao encerrar, o despachante e o gerente recebem um print do trajeto do dia inteiro.`
            : "Aperte \"Iniciar o dia\" quando começar o expediente — ao encerrar, o despachante e o gerente recebem um print do trajeto do dia inteiro."}
        </p>
        {!diaAtivoDesde && (
          <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={iniciarDia}>
            Iniciar o dia
          </button>
        )}
        {diaAtivoDesde && (
          <button type="button" className="btn btn-danger" style={{ width: "100%" }} onClick={encerrarDia} disabled={salvandoPrint}>
            {salvandoPrint ? "Salvando print..." : "Encerrar o dia"}
          </button>
        )}
        {avisoPrint && <p style={{ color: "var(--accent-text)", fontSize: 13, marginTop: 10 }}>{avisoPrint}</p>}
      </div>

      {!diaAtivoDesde && (
        <p style={{ color: "var(--text-dim)" }}>
          Aperte "Iniciar o dia" acima pra ver sua rota de hoje, confirmar as coletas e falar com a equipe.
        </p>
      )}

      {diaAtivoDesde && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <strong style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              Fale com a equipe
              {temMensagemNaoLidaDaEquipe && <span className="ponto-nao-lido" title="Mensagem nova da equipe" />}
            </strong>
            <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 10px" }}>
              Dúvida, atraso ou qualquer aviso — fale direto com o despachante ou o gerente.
            </p>
            <Link to={`/chat-coletor/${perfil.id}`} className="btn btn-secondary" style={{ display: "block", textAlign: "center" }}>
              Falar com a equipe
            </Link>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={`tab ${abaColetor === "confirmar" ? "active" : ""}`}
              onClick={() => setAbaColetor("confirmar")}
            >
              Confirmar
            </button>
            <button
              type="button"
              className={`tab ${abaColetor === "roteiro" ? "active" : ""}`}
              onClick={() => setAbaColetor("roteiro")}
            >
              Roteiro
            </button>
          </div>

          {abaColetor === "confirmar" && (
            <>
              <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Roteiro fixo de hoje</h2>
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 12 }}>
                Tire uma foto em cada parada pra confirmar a coleta.
              </p>

              {carregandoRoteiro && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}
              {!carregandoRoteiro && !diaSemana && (
                <p style={{ color: "var(--text-dim)", marginBottom: 16 }}>Sem roteiro fixo aos domingos.</p>
              )}
              {!carregandoRoteiro && diaSemana && saidasDeHoje.length === 0 && (
                <p style={{ color: "var(--text-dim)", marginBottom: 16 }}>Nenhuma parada fixa cadastrada pra hoje.</p>
              )}

              {saidasDeHoje.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
                  {saidasDeHoje.map((saida) => (
                    <div key={saida.numero} className="card">
                      <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 10px" }}>
                        {saida.numero}ª saída{saida.horario ? ` · ${saida.horario}` : ""} · {LABEL_VEICULO[saida.veiculo] || saida.veiculo}
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {saida.paradas.map((p) => (
                          <CardParadaFixaConfirmar key={p.id} p={p} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Coletas de hoje (por demanda)</h2>

              {ordem.length > 0 && (
                <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 12 }}>
                  Sua rota de hoje já vem pronta, na ordem definida pelo despachante.
                </p>
              )}

              {erroConfirmar && <p style={{ color: "var(--danger)", fontSize: 14 }}>{erroConfirmar}</p>}

              {coletas.length === 0 && <p style={{ color: "var(--text-dim)" }}>Nenhuma coleta atribuída para hoje.</p>}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {coletas.map((coleta) => {
                  const posicao = ordem.indexOf(coleta.id);
                  return (
                  <div key={coleta.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong>
                        {posicao !== -1 && <span className="badge-papel" style={{ marginRight: 8 }}>{posicao + 1}ª parada</span>}
                        {coleta.local}
                      </strong>
                      <StatusBadge status={coleta.status} />
                    </div>
                    <p style={{ color: "var(--text-dim)", fontSize: 14, margin: "6px 0" }}>
                      {(coleta.cliente?.estabelecimento || coleta.cliente?.nome)} · {coleta.veiculo_tipo} · {coleta.tipo_produto}
                      <br />
                      {new Date(coleta.horario_solicitado).toLocaleString("pt-BR")}
                    </p>

                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {coleta.status === "aceita" && (
                        <>
                          <button type="button" className="btn btn-primary" onClick={() => confirmarColeta(coleta)}>
                            Confirmar coleta
                          </button>
                          <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
                            Cliente não atendeu — tirar foto
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              style={{ display: "none" }}
                              onChange={(e) => e.target.files?.[0] && marcarClienteAusente(coleta, e.target.files[0])}
                            />
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </>
          )}

          {abaColetor === "roteiro" && (
            <>
              <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>
                Seu roteiro fixo{diaSemana ? ` de hoje (${DIA_SEMANA_LABEL[diaSemana]})` : ""}
              </h2>
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 12 }}>
                Igual está na planilha — cada lugar aqui já vem com o horário e a ordem certa, sem precisar escolher
                nada. Endereços que não aparecem aqui são por demanda (pedidos pelo app).
              </p>

              {carregandoRoteiro && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}
              {!carregandoRoteiro && !diaSemana && (
                <p style={{ color: "var(--text-dim)", marginBottom: 16 }}>Sem roteiro fixo aos domingos.</p>
              )}
              {!carregandoRoteiro && diaSemana && saidasDeHoje.length === 0 && (
                <p style={{ color: "var(--text-dim)", marginBottom: 16 }}>Nenhuma parada fixa cadastrada pra hoje.</p>
              )}

              {saidasDeHoje.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {saidasDeHoje.map((saida) => (
                      <div key={saida.numero}>
                        <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 6px" }}>
                          {saida.numero}ª saída{saida.horario ? ` · ${saida.horario}` : ""} · {LABEL_VEICULO[saida.veiculo] || saida.veiculo}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {saida.paradas.map((p) => {
                            const confirmacao = confirmacaoPorParadaId.get(p.id);
                            const confirmada = !!confirmacao;
                            const ausente = !!confirmacao?.cliente_ausente;
                            return (
                              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span className="badge-papel">{p.ordem}ª</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <strong style={{ overflowWrap: "anywhere" }}>{p.nome}</strong>
                                  <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "2px 0 0" }}>{p.endereco}</p>
                                </div>
                                <StatusBadge
                                  status={!confirmada ? "pendente" : ausente ? "recusada" : "coletada"}
                                  label={!confirmada ? "Pendente" : ausente ? "Sem coleta hoje" : "Confirmada"}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Coletas por demanda de hoje</h2>
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 12 }}>
                Pedidos feitos pelo app e já aceitos entram aqui — assim que alguém pede uma coleta e o despachante ou
                o gerente aceita, ela aparece automaticamente na sua rota do dia.
              </p>

              {coletas.length === 0 && <p style={{ color: "var(--text-dim)", marginBottom: 16 }}>Nenhuma coleta por demanda aceita pra hoje.</p>}

              {coletas.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {coletas.map((coleta) => {
                    const posicao = ordem.indexOf(coleta.id);
                    return (
                      <div key={coleta.id} className="card">
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <strong>
                            {posicao !== -1 && <span className="badge-papel" style={{ marginRight: 8 }}>{posicao + 1}ª parada</span>}
                            {coleta.local}
                          </strong>
                          <StatusBadge status={coleta.status} />
                        </div>
                        <p style={{ color: "var(--text-dim)", fontSize: 14, margin: "6px 0" }}>
                          {(coleta.cliente?.estabelecimento || coleta.cliente?.nome)} · {coleta.veiculo_tipo} · {coleta.tipo_produto}
                          <br />
                          {new Date(coleta.horario_solicitado).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
