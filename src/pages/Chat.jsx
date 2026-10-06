import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { marcarComoLido } from "../lib/chatLeitura.js";

// Essa tela atende dois tipos de conversa, nunca misturados:
// (1) /coletas/:id       -> chat de uma coleta, entre cliente e equipe
//     (gerente/despachante).
// (2) /chat-coletor/:coletorId -> chat de um coletor com a equipe. Não
//     existe comunicação direta entre cliente e coletor em nenhum dos
//     dois casos.
export default function Chat() {
  const { id: coletaId, coletorId } = useParams();
  const modoColetor = !!coletorId;
  const { perfil } = useAuth();
  const [coleta, setColeta] = useState(null);
  const [coletorAlvo, setColetorAlvo] = useState(null); // só preenchido no modo coletor
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const fimDaLista = useRef(null);

  const ehEquipe = perfil?.papel === "gerente" || perfil?.papel === "despachante";

  // Chave que identifica essa conversa (id da coleta OU id do coletor) —
  // usada pra filtrar mensagens, marcar como lida etc. Cada mensagem só
  // tem coleta_id OU coletor_id preenchido, nunca os dois.
  const chaveConversa = modoColetor ? coletorId : coletaId;
  const colunaFiltro = modoColetor ? "coletor_id" : "coleta_id";

  useEffect(() => {
    if (!chaveConversa) return;

    async function carregar() {
      if (modoColetor) {
        const { data: c } = await supabase
          .from("perfis")
          .select("id, nome, dia_iniciado_em")
          .eq("id", coletorId)
          .single();
        setColetorAlvo(c);
      } else {
        const { data: c } = await supabase
          .from("coletas")
          .select("*, cliente:cliente_id(nome, estabelecimento), coletor:coletor_id(nome)")
          .eq("id", coletaId)
          .single();
        setColeta(c);
      }

      const { data: msgs } = await supabase
        .from("mensagens")
        .select("*, remetente:remetente_id(nome, papel)")
        .eq(colunaFiltro, chaveConversa)
        .order("criado_em", { ascending: true });
      setMensagens(msgs || []);
    }
    carregar();

    const canalRealtime = supabase
      .channel(`mensagens-${modoColetor ? "coletor" : "coleta"}-${chaveConversa}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens", filter: `${colunaFiltro}=eq.${chaveConversa}` },
        (payload) => {
          setMensagens((atual) => {
            if (atual.some((m) => m.id === payload.new.id)) return atual;
            // Se já temos uma versão otimista local dessa mensagem (mesmo
            // texto/remetente), troca ela pela linha real em vez de duplicar.
            const idxLocal = atual.findIndex(
              (m) => m.id.toString().startsWith("local-") && m.texto === payload.new.texto && m.remetente_id === payload.new.remetente_id
            );
            if (idxLocal !== -1) {
              const copia = [...atual];
              copia[idxLocal] = { ...payload.new, remetente: copia[idxLocal].remetente };
              return copia;
            }
            return [...atual, payload.new];
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(canalRealtime);
  }, [chaveConversa, modoColetor, coletaId, coletorId, colunaFiltro]);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length]);

  // Ao ver o chat (e sempre que chegam mensagens novas enquanto ele está
  // aberto), marca como lido — some o indicador de não lida nas telas
  // anteriores.
  useEffect(() => {
    if (!chaveConversa || mensagens.length === 0) return;
    marcarComoLido(chaveConversa);
  }, [chaveConversa, mensagens.length]);

  async function enviar(e) {
    e.preventDefault();
    const textoLimpo = texto.trim();
    if (!textoLimpo) return;

    const rascunho = {
      id: `local-${Date.now()}`,
      [colunaFiltro]: chaveConversa,
      remetente_id: perfil.id,
      texto: textoLimpo,
      criado_em: new Date().toISOString(),
      remetente: { nome: perfil.nome, papel: perfil.papel },
    };

    setTexto("");
    const { error } = await supabase
      .from("mensagens")
      .insert({ [colunaFiltro]: chaveConversa, remetente_id: perfil.id, texto: textoLimpo });

    if (error) {
      console.error("Erro ao enviar mensagem:", error);
      setTexto(textoLimpo);
      return;
    }

    // Adiciona a mensagem localmente assim que o envio é confirmado, em vez
    // de depender só do canal realtime pra ela aparecer (no modo demo o
    // realtime não existe de verdade; em produção o handler acima troca
    // essa versão otimista pela linha real quando ela chegar).
    setMensagens((atual) => [...atual, rascunho]);
  }

  if (modoColetor ? !coletorAlvo : !coleta) return null;

  return (
    <div className="app-content" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 104px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>{modoColetor ? (ehEquipe ? coletorAlvo.nome : "Chat com a equipe") : coleta.local}</h1>
        {!modoColetor && <StatusBadge status={coleta.status} />}
        {modoColetor && ehEquipe && (
          <StatusBadge
            status={coletorAlvo.dia_iniciado_em ? "dia_iniciado" : "dia_nao_iniciado"}
            label={
              coletorAlvo.dia_iniciado_em
                ? `Iniciou às ${new Date(coletorAlvo.dia_iniciado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                : "Não iniciou o dia"
            }
          />
        )}
      </div>
      <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 8px" }}>
        {modoColetor
          ? ehEquipe
            ? `Conversa com o coletor ${coletorAlvo.nome}.`
            : "Conversa com a equipe do RoteCheck (gerente/despachante)."
          : ehEquipe
            ? `Conversa com o cliente: ${(coleta.cliente?.estabelecimento || coleta.cliente?.nome) || "—"}`
            : "Conversa com a equipe do RoteCheck (gerente/despachante)."}
      </p>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
        {mensagens.length === 0 && (
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>Nenhuma mensagem ainda. Escreva para começar.</p>
        )}
        {mensagens.map((m) => (
          <div
            key={m.id}
            className="card"
            style={{
              maxWidth: "80%",
              alignSelf: m.remetente_id === perfil.id ? "flex-end" : "flex-start",
              background: m.remetente_id === perfil.id ? "var(--accent-strong)" : "var(--surface)",
              color: m.remetente_id === perfil.id ? "var(--accent-ink)" : "inherit",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: m.remetente_id === perfil.id ? "var(--accent-ink)" : "var(--text-dim)",
                opacity: m.remetente_id === perfil.id ? 0.7 : 1,
              }}
            >
              {m.remetente?.nome}
            </p>
            <p style={{ margin: "2px 0 0" }}>{m.texto}</p>
          </div>
        ))}
        <div ref={fimDaLista} />
      </div>

      <form onSubmit={enviar} style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="Escreva uma mensagem..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary">
          Enviar
        </button>
      </form>

      <Link to="/" style={{ fontSize: 13, marginTop: 8, textAlign: "center" }}>
        Voltar
      </Link>
    </div>
  );
}
