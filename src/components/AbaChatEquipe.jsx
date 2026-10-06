import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth.jsx";
import StatusBadge from "./StatusBadge.jsx";
import { mapaUltimasMensagens, temNaoLida } from "../lib/chatLeitura.js";

// Chat da equipe: uma conversa por coleta (cliente com a equipe) e uma
// conversa por coletor (coletor com a equipe). Não existe chat direto
// entre cliente e coletor.
//
// onContagemNaoLidas: avisa quem usa esse componente quantas mensagens
// não lidas tem ao todo, pra mostrar o número certo no badge da aba (e do
// grupo "Acompanhamento") mesmo antes de abrir o Chat — mesmo padrão que
// já existia quando essa lógica morava dentro de GerenteHome.jsx.
export default function AbaChatEquipe({ onContagemNaoLidas }) {
  const { perfil } = useAuth();
  const [coletas, setColetas] = useState([]);
  const [coletores, setColetores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [ultimasMensagens, setUltimasMensagens] = useState({});
  const [ultimasMensagensColetores, setUltimasMensagensColetores] = useState({});
  // Sub-aba dentro de "Chat" — mesmo padrão de Pendentes/Aceitas/etc de
  // Coletas: separa a conversa com cliente da conversa com coletor, pra
  // não empilhar as duas listas na mesma tela.
  const [aba, setAba] = useState("clientes");

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

  useEffect(() => {
    setCarregando(true);
    async function carregar() {
      const { data } = await supabase
        .from("coletas")
        .select("*, cliente:cliente_id(nome, estabelecimento), coletor:coletor_id(nome)")
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
  }, []);

  useEffect(() => {
    async function carregarMensagensColetores() {
      const coletorIds = coletores.map((c) => c.id);
      if (!coletorIds.length) return;
      const { data } = await supabase.from("mensagens").select("*").in("coletor_id", coletorIds);
      setUltimasMensagensColetores(mapaUltimasMensagens(data || []));
    }
    carregarMensagensColetores();
  }, [coletores]);

  const coletasComNaoLida = coletas.filter((c) => temNaoLida(c.id, ultimasMensagens[c.id], perfil?.id)).length;
  const coletoresComNaoLida = coletores.filter((c) => temNaoLida(c.id, ultimasMensagensColetores[c.id], perfil?.id)).length;

  useEffect(() => {
    onContagemNaoLidas?.(coletasComNaoLida + coletoresComNaoLida);
  }, [coletasComNaoLida, coletoresComNaoLida, onContagemNaoLidas]);

  return (
    <>
      <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 12 }}>
        Fale com o cliente de cada coleta, ou direto com qualquer coletor da equipe. Não existe chat direto
        entre cliente e coletor.
      </p>

      <div className="tabs">
        <button className={`tab ${aba === "clientes" ? "active" : ""}`} onClick={() => setAba("clientes")}>
          Clientes
          {coletasComNaoLida > 0 && <span className="contador-nao-lido">{coletasComNaoLida}</span>}
        </button>
        <button className={`tab ${aba === "coletores" ? "active" : ""}`} onClick={() => setAba("coletores")}>
          Coletores
          {coletoresComNaoLida > 0 && <span className="contador-nao-lido">{coletoresComNaoLida}</span>}
        </button>
      </div>

      {aba === "clientes" && (
        <>
          {carregando && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}
          {!carregando && coletas.length === 0 && (
            <p style={{ color: "var(--text-dim)" }}>Nenhuma coleta registrada ainda.</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {coletas.map((coleta) => (
              <div key={coleta.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {coleta.local}
                    {temNaoLida(coleta.id, ultimasMensagens[coleta.id], perfil?.id) && (
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

      {aba === "coletores" && (
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
  );
}
