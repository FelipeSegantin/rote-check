import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import StatusBadge from "./StatusBadge.jsx";

const LABEL_TIPO_VEICULO = { fiorino: "Fiorino", van: "Van", moto: "Moto" };
const TIPOS_VEICULO = ["fiorino", "van", "moto"];
const FORM_VEICULO_INICIAL = { placa: "", tipo: "fiorino" };

// Frota da empresa: cadastre placa e tipo, e controle quem está
// disponível ou parado em manutenção.
export default function AbaVeiculos() {
  const [veiculos, setVeiculos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [formVeiculo, setFormVeiculo] = useState(FORM_VEICULO_INICIAL);
  const [erroVeiculo, setErroVeiculo] = useState("");
  const [enviandoVeiculo, setEnviandoVeiculo] = useState(false);
  const [statusRascunho, setStatusRascunho] = useState({});
  const [observacaoRascunho, setObservacaoRascunho] = useState({});
  const [salvandoVeiculo, setSalvandoVeiculo] = useState(null);
  const [removendoVeiculo, setRemovendoVeiculo] = useState(null);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data } = await supabase.from("veiculos").select("*").order("placa", { ascending: true });
      setVeiculos(data || []);
      setCarregando(false);
    }
    carregar();
  }, []);

  async function cadastrarVeiculo(e) {
    e.preventDefault();
    const placa = formVeiculo.placa.trim().toUpperCase();
    if (!placa) {
      setErroVeiculo("Informe a placa do veículo.");
      return;
    }
    if (veiculos.some((v) => v.placa === placa)) {
      setErroVeiculo("Já existe um veículo cadastrado com essa placa.");
      return;
    }

    setErroVeiculo("");
    setEnviandoVeiculo(true);
    const { data, error } = await supabase
      .from("veiculos")
      .insert({ placa, tipo: formVeiculo.tipo, status: "disponivel" })
      .select();
    setEnviandoVeiculo(false);

    if (error) {
      setErroVeiculo(error.message || "Não foi possível cadastrar o veículo.");
      return;
    }
    setVeiculos((atual) => [...atual, ...(data || [])].sort((a, b) => a.placa.localeCompare(b.placa)));
    setFormVeiculo(FORM_VEICULO_INICIAL);
  }

  async function salvarStatusVeiculo(veiculo) {
    const novoStatus = statusRascunho[veiculo.id] ?? veiculo.status;
    const observacao = (observacaoRascunho[veiculo.id] ?? veiculo.observacao ?? "").trim();
    setSalvandoVeiculo(veiculo.id);
    const dados = { status: novoStatus, observacao: novoStatus === "manutencao" ? observacao : "" };
    await supabase.from("veiculos").update(dados).eq("id", veiculo.id);
    setVeiculos((atual) => atual.map((v) => (v.id === veiculo.id ? { ...v, ...dados } : v)));
    setSalvandoVeiculo(null);
  }

  async function removerVeiculo(veiculo) {
    setRemovendoVeiculo(veiculo.id);
    await supabase.from("veiculos").delete().eq("id", veiculo.id);
    setVeiculos((atual) => atual.filter((v) => v.id !== veiculo.id));
    setRemovendoVeiculo(null);
  }

  return (
    <>
      <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 12 }}>
        Frota da empresa: cadastre placa e tipo, e controle quem está disponível ou parado em manutenção.
      </p>

      <form onSubmit={cadastrarVeiculo} className="card" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        <strong>Cadastrar veículo</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 140, margin: 0 }}>
            <label>Placa</label>
            <input
              value={formVeiculo.placa}
              onChange={(e) => setFormVeiculo((f) => ({ ...f, placa: e.target.value.toUpperCase() }))}
              placeholder="ABC1D23"
              maxLength={8}
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140, margin: 0 }}>
            <label>Tipo</label>
            <select value={formVeiculo.tipo} onChange={(e) => setFormVeiculo((f) => ({ ...f, tipo: e.target.value }))}>
              {TIPOS_VEICULO.map((t) => (
                <option key={t} value={t}>
                  {LABEL_TIPO_VEICULO[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {erroVeiculo && <p className="erro-campo">{erroVeiculo}</p>}
        <button type="submit" className="btn btn-primary" disabled={enviandoVeiculo}>
          {enviandoVeiculo ? "Cadastrando..." : "Cadastrar veículo"}
        </button>
      </form>

      {carregando && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}
      {!carregando && veiculos.length === 0 && (
        <p style={{ color: "var(--text-dim)" }}>Nenhum veículo cadastrado ainda.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {veiculos.map((v) => {
          const statusSelecionado = statusRascunho[v.id] ?? v.status;
          const observacaoAtual = observacaoRascunho[v.id] ?? v.observacao ?? "";
          const alterado = statusSelecionado !== v.status || (statusSelecionado === "manutencao" && observacaoAtual !== (v.observacao || ""));
          return (
            <div key={v.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong>{v.placa}</strong>
                <StatusBadge status={v.status} />
              </div>
              <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 10px" }}>
                {LABEL_TIPO_VEICULO[v.tipo] || v.tipo}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <select
                  value={statusSelecionado}
                  onChange={(e) => setStatusRascunho((s) => ({ ...s, [v.id]: e.target.value }))}
                >
                  <option value="disponivel">Disponível</option>
                  <option value="manutencao">Em manutenção (batida)</option>
                </select>
                {statusSelecionado === "manutencao" && (
                  <input
                    placeholder="Motivo da manutenção (ex.: batida no para-choque)"
                    value={observacaoAtual}
                    onChange={(e) => setObservacaoRascunho((s) => ({ ...s, [v.id]: e.target.value }))}
                  />
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={!alterado || salvandoVeiculo === v.id}
                    onClick={() => salvarStatusVeiculo(v)}
                  >
                    {salvandoVeiculo === v.id ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={removendoVeiculo === v.id}
                    onClick={() => removerVeiculo(v)}
                  >
                    {removendoVeiculo === v.id ? "Removendo..." : "Remover"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
