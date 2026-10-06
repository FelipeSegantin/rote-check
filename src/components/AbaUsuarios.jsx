import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import StatusBadge from "./StatusBadge.jsx";
import { LABEL_PAPEL, PAPEIS } from "../lib/papeis.js";

// Papéis que dá pra escolher ao trocar o papel de alguém por aqui — não
// inclui "coletor" de propósito: conta de coletor loga por usuário (não
// e-mail) e depende do campo usuario_coletor, que essa troca simples não
// preenche. Transformar alguém EM coletor por aqui deixaria a conta sem
// jeito de logar; então isso continua só pelo cadastro de coletor feito
// pela equipe (fora desta tela).
const PAPEIS_PARA_TROCA = ["cliente", "despachante", "gerente"];

// Todo mundo que tem login no app. O tipo de conta normalmente vem do
// cadastro — aberto pra cliente e coletor, só por convite pra
// despachante e gerente (aba "Convites") — mas às vezes alguém acaba
// entrando no papel errado (ex.: abriu o link errado sem querer). Pra
// esses casos, dá pra corrigir o papel direto aqui, sem precisar mexer
// no banco.
export default function AbaUsuarios() {
  const [perfis, setPerfis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  // Sub-aba por tipo de conta — mesmo padrão de Pendentes/Aceitas/etc da
  // tela de Coletas: uma aba por grupo, mostrando só quem está naquele
  // grupo de cada vez.
  const [aba, setAba] = useState("cliente");

  // Troca de papel: dois passos (escolher → confirmar) pra não trocar o
  // papel de alguém sem querer com um clique só — mesmo espírito de não
  // usar confirm() nativo do navegador que o resto do app já segue.
  const [trocandoId, setTrocandoId] = useState(null);
  const [papelEscolhido, setPapelEscolhido] = useState("");
  const [salvandoTroca, setSalvandoTroca] = useState(false);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data } = await supabase.from("perfis").select("*").order("nome", { ascending: true });
      setPerfis(data || []);
      setCarregando(false);
    }
    carregar();
  }, []);

  function abrirTrocaPapel(p) {
    setTrocandoId(p.id);
    setPapelEscolhido(PAPEIS_PARA_TROCA.find((papel) => papel !== p.papel) || "");
  }

  function cancelarTrocaPapel() {
    setTrocandoId(null);
    setPapelEscolhido("");
  }

  async function confirmarTrocaPapel(p) {
    if (!papelEscolhido || papelEscolhido === p.papel) {
      cancelarTrocaPapel();
      return;
    }
    setSalvandoTroca(true);
    // aprovado: true junto — é o gerente decidindo isso na hora, não um
    // autocadastro esperando aprovação de ninguém, então não faz sentido
    // deixar pendente depois da troca.
    const { error } = await supabase
      .from("perfis")
      .update({ papel: papelEscolhido, aprovado: true })
      .eq("id", p.id);
    setSalvandoTroca(false);
    if (error) return; // fica na telinha de troca aberta pra pessoa tentar de novo
    setPerfis((atual) =>
      atual.map((item) => (item.id === p.id ? { ...item, papel: papelEscolhido, aprovado: true } : item))
    );
    cancelarTrocaPapel();
  }

  return (
    <>
      <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 12 }}>
        Todo mundo que tem login no app. O tipo de conta normalmente vem do cadastro — aberto pra cliente e
        coletor, só por convite pra despachante e gerente (aba "Convites") — mas dá pra corrigir aqui se alguém
        entrou no papel errado.
      </p>

      {carregando && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}

      <div className="tabs">
        {PAPEIS.map((papel) => {
          const quantidade = perfis.filter((p) => p.papel === papel).length;
          return (
            <button key={papel} className={`tab ${aba === papel ? "active" : ""}`} onClick={() => setAba(papel)}>
              {LABEL_PAPEL[papel]} ({quantidade})
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!carregando && perfis.filter((p) => p.papel === aba).length === 0 && (
          <p style={{ color: "var(--text-dim)" }}>Ninguém aqui ainda.</p>
        )}
        {perfis
          .filter((p) => p.papel === aba)
          .map((p) => (
            <div key={p.id} className="card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {p.foto_url ? <img src={p.foto_url} className="avatar" alt={p.nome} /> : <div className="avatar" />}
              <div style={{ flex: 1, minWidth: 160 }}>
                <strong style={{ overflowWrap: "anywhere", display: "block" }}>
                  {p.papel === "cliente" && p.estabelecimento ? p.estabelecimento : p.nome}
                </strong>
                <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 0" }}>
                  {p.papel === "cliente" && p.estabelecimento ? `${p.nome} · ` : ""}
                  {p.telefone || "sem telefone"}
                  {p.papel === "cliente" && p.cnpj ? ` · CNPJ ${p.cnpj}` : ""}
                  {p.papel === "coletor" && p.usuario_coletor ? ` · usuário ${p.usuario_coletor}` : ""}
                  {p.papel !== "cliente" ? ` · ${p.aprovado ? "aprovado" : "pendente de aprovação"}` : ""}
                </p>
              </div>
              {p.papel === "coletor" && p.aprovado && (
                <StatusBadge
                  status={p.dia_iniciado_em ? "dia_iniciado" : "dia_nao_iniciado"}
                  label={
                    p.dia_iniciado_em
                      ? `Iniciou às ${new Date(p.dia_iniciado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                      : "Não iniciou"
                  }
                />
              )}
              <span className="badge-papel">{LABEL_PAPEL[p.papel]}</span>

              {trocandoId !== p.id ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "4px 10px", fontSize: 12.5 }}
                  onClick={() => abrirTrocaPapel(p)}
                >
                  Trocar papel
                </button>
              ) : (
                <div style={{ display: "flex", gap: 6, alignItems: "center", width: "100%", marginTop: 4 }}>
                  <select
                    value={papelEscolhido}
                    onChange={(e) => setPapelEscolhido(e.target.value)}
                    style={{ flex: 1, minWidth: 120 }}
                  >
                    {PAPEIS_PARA_TROCA.map((papel) => (
                      <option key={papel} value={papel}>
                        {LABEL_PAPEL[papel]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: "4px 10px", fontSize: 12.5 }}
                    disabled={salvandoTroca}
                    onClick={() => confirmarTrocaPapel(p)}
                  >
                    {salvandoTroca ? "..." : "Confirmar"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: "4px 10px", fontSize: 12.5 }}
                    disabled={salvandoTroca}
                    onClick={cancelarTrocaPapel}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
    </>
  );
}
