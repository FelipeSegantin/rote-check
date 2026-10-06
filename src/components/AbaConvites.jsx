import { useEffect, useState } from "react";
import { useHref } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth.jsx";
import { LABEL_PAPEL } from "../lib/papeis.js";

// Só despachante e gerente entram por convite — cliente e coletor
// continuam com cadastro aberto (ver Cadastro.jsx).
const PAPEIS_CONVITE = ["despachante", "gerente"];

// Aprovações (qualquer cadastro pendente) e Convites (único jeito de
// virar despachante/gerente) — as duas são sobre quem entra como usuário
// do sistema, então moram juntas aqui, cada uma na própria sub-aba.
//
// onContagemPendentes: avisa quem usa esse componente quantos cadastros
// estão esperando aprovação, pra mostrar o número certo no badge da aba
// (e do grupo "Equipe") mesmo antes de abrir Convites — mesmo padrão que
// já existia quando essa lógica morava dentro de GerenteHome.jsx.
export default function AbaConvites({ onContagemPendentes }) {
  const { perfil } = useAuth();
  const hrefCadastro = useHref("/cadastro");

  const [perfis, setPerfis] = useState([]);
  const [carregandoPerfis, setCarregandoPerfis] = useState(true);
  // Sub-aba — mesmo padrão de Pendentes/Aceitas/etc de Coletas: separa
  // Aprovações de Convites pra não empilhar as duas coisas na mesma tela.
  const [aba, setAba] = useState("aprovacoes");

  useEffect(() => {
    async function carregar() {
      setCarregandoPerfis(true);
      const { data } = await supabase.from("perfis").select("*").order("nome", { ascending: true });
      setPerfis(data || []);
      setCarregandoPerfis(false);
    }
    carregar();
  }, []);

  const pendentesAprovacao = perfis.filter((p) => p.aprovado === false);

  useEffect(() => {
    onContagemPendentes?.(pendentesAprovacao.length);
  }, [pendentesAprovacao.length, onContagemPendentes]);

  async function aprovarPendente(p) {
    await supabase.from("perfis").update({ aprovado: true }).eq("id", p.id);
    setPerfis((atual) => atual.map((item) => (item.id === p.id ? { ...item, aprovado: true } : item)));
  }

  async function recusarPendente(p) {
    await supabase.from("perfis").delete().eq("id", p.id);
    setPerfis((atual) => atual.filter((item) => item.id !== p.id));
  }

  const [convites, setConvites] = useState([]);
  const [carregandoConvites, setCarregandoConvites] = useState(true);
  const [papelNovoConvite, setPapelNovoConvite] = useState("despachante");
  const [gerandoConvite, setGerandoConvite] = useState(false);
  const [erroConvite, setErroConvite] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(null);

  useEffect(() => {
    async function carregar() {
      setCarregandoConvites(true);
      const { data } = await supabase
        .from("convites")
        .select("*, usado_por_perfil:usado_por(nome)")
        .order("criado_em", { ascending: false });
      setConvites(data || []);
      setCarregandoConvites(false);
    }
    carregar();
  }, []);

  function linkDoConvite(codigo) {
    return `${window.location.origin}${hrefCadastro}?convite=${codigo}`;
  }

  async function gerarConvite() {
    setErroConvite("");
    setGerandoConvite(true);
    const prefixo = papelNovoConvite === "gerente" ? "GER" : "DESP";
    const codigo = `${prefixo}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { data, error } = await supabase
      .from("convites")
      .insert({ codigo, papel: papelNovoConvite, criado_por: perfil.id })
      .select();
    setGerandoConvite(false);
    if (error) {
      setErroConvite(error.message || "Não foi possível gerar o convite.");
      return;
    }
    setConvites((atual) => [...(data || []), ...atual]);
  }

  async function copiarLink(codigo) {
    const link = linkDoConvite(codigo);
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopiado(codigo);
      setTimeout(() => setLinkCopiado((atual) => (atual === codigo ? null : atual)), 2000);
    } catch {
      // clipboard indisponível (ex.: navegador antigo) — a pessoa ainda
      // consegue selecionar e copiar o texto do link manualmente.
    }
  }

  async function cancelarConvite(convite) {
    await supabase.from("convites").delete().eq("id", convite.id);
    setConvites((atual) => atual.filter((c) => c.id !== convite.id));
  }

  return (
    <>
      <div className="tabs">
        <button className={`tab ${aba === "aprovacoes" ? "active" : ""}`} onClick={() => setAba("aprovacoes")}>
          Aprovações{pendentesAprovacao.length > 0 && ` (${pendentesAprovacao.length})`}
        </button>
        <button className={`tab ${aba === "convites" ? "active" : ""}`} onClick={() => setAba("convites")}>
          Convites
        </button>
      </div>

      {aba === "aprovacoes" && (
        <>
          <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 12 }}>
            Pedidos de cadastro esperando aprovação (cliente, coletor, despachante ou gerente).
          </p>

          {carregandoPerfis && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}
          {!carregandoPerfis && pendentesAprovacao.length === 0 && (
            <p style={{ color: "var(--text-dim)" }}>Nenhum pedido pendente no momento.</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pendentesAprovacao.map((p) => (
              <div key={p.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <strong style={{ overflowWrap: "anywhere" }}>
                    {p.papel === "cliente" && p.estabelecimento ? p.estabelecimento : p.nome}
                  </strong>
                  <span className="badge-papel">{LABEL_PAPEL[p.papel] || p.papel}</span>
                </div>
                <p style={{ color: "var(--text-dim)", fontSize: 14, margin: "4px 0 10px" }}>
                  {p.papel === "cliente" && p.estabelecimento ? `${p.nome} · ` : ""}
                  {p.papel === "coletor" && p.usuario_coletor ? `Usuário: ${p.usuario_coletor} · ` : ""}
                  {p.telefone || "sem telefone"}
                  {p.papel === "cliente" && p.cnpj ? ` · CNPJ ${p.cnpj}` : ""}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => aprovarPendente(p)}>
                    Aprovar
                  </button>
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => recusarPendente(p)}>
                    Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {aba === "convites" && (
        <>
          <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 12 }}>
            Único jeito de virar despachante ou gerente: gere um link aqui e envie pra pessoa. Cada link vale pra
            um único cadastro — depois de usado, para de funcionar.
          </p>

          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            <strong>Gerar novo convite</strong>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: 1, minWidth: 140, margin: 0 }}>
                <label>Tipo de conta</label>
                <select value={papelNovoConvite} onChange={(e) => setPapelNovoConvite(e.target.value)}>
                  {PAPEIS_CONVITE.map((p) => (
                    <option key={p} value={p}>
                      {LABEL_PAPEL[p]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {erroConvite && <p className="erro-campo">{erroConvite}</p>}
            <button type="button" className="btn btn-primary" onClick={gerarConvite} disabled={gerandoConvite}>
              {gerandoConvite ? "Gerando..." : "Gerar convite"}
            </button>
          </div>

          {carregandoConvites && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}
          {!carregandoConvites && convites.length === 0 && (
            <p style={{ color: "var(--text-dim)" }}>Nenhum convite gerado ainda.</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {convites.map((c) => (
              <div key={c.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <strong>{LABEL_PAPEL[c.papel] || c.papel}</strong>
                  <span className="badge-papel">
                    {c.usado ? `Usado${c.usado_por_perfil?.nome ? ` por ${c.usado_por_perfil.nome}` : ""}` : "Disponível"}
                  </span>
                </div>
                <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 10px" }}>
                  Criado em {new Date(c.criado_em).toLocaleString("pt-BR")}
                  {c.usado_em ? ` · usado em ${new Date(c.usado_em).toLocaleString("pt-BR")}` : ""}
                </p>

                {!c.usado && (
                  <>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input readOnly value={linkDoConvite(c.codigo)} style={{ flex: 1, minWidth: 0 }} onFocus={(e) => e.target.select()} />
                      <button type="button" className="btn btn-secondary" onClick={() => copiarLink(c.codigo)}>
                        {linkCopiado === c.codigo ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ width: "100%", marginTop: 8 }}
                      onClick={() => cancelarConvite(c)}
                    >
                      Cancelar convite
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
