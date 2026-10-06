import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth.jsx";
import { OPCOES_TEMA, aplicarTema } from "../lib/tema.js";
import { mascararCNPJ, validarCNPJ } from "../lib/validacao.js";
import { statusPush, subscribeToPush, unsubscribeFromPush } from "../lib/push.js";
import AbaSolicitacoesUsuario from "../components/AbaSolicitacoesUsuario.jsx";

const LABEL_PAPEL = {
  cliente: "Cliente",
  despachante: "Despachante",
  gerente: "Gerente",
  coletor: "Coletor",
};

export default function Configuracoes() {
  const { perfil, logout, recarregarPerfil } = useAuth();
  const navigate = useNavigate();
  const [aba, setAba] = useState("perfil"); // "perfil" | "editar"
  const [nome, setNome] = useState(perfil?.nome || "");
  const [estabelecimento, setEstabelecimento] = useState(perfil?.estabelecimento || "");
  const [telefone, setTelefone] = useState(perfil?.telefone || "");
  const [endereco, setEndereco] = useState(perfil?.endereco || "");
  const [cep, setCep] = useState(perfil?.cep || "");
  const [cnpj, setCnpj] = useState(perfil?.cnpj || "");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");
  const [salvandoTema, setSalvandoTema] = useState(false);
  const [push, setPush] = useState({ suportado: false, inscrito: false, permissaoNegada: false });
  const [mudandoPush, setMudandoPush] = useState(false);

  const ehCliente = perfil?.papel === "cliente";
  const ehAdmin = perfil?.papel === "despachante" || perfil?.papel === "gerente";
  const temaAtual = perfil?.tema || "sistema";

  useEffect(() => {
    statusPush().then(setPush);
  }, []);

  async function mudarTema(valor) {
    if (valor === temaAtual) return;
    aplicarTema(valor); // efeito imediato, sem esperar o servidor
    setSalvandoTema(true);
    await supabase.from("perfis").update({ tema: valor }).eq("id", perfil.id);
    await recarregarPerfil();
    setSalvandoTema(false);
  }

  // Liga/desliga as notificações push nesse aparelho — o mesmo botão
  // funciona tanto no navegador do computador quanto no do celular, já que
  // os dois usam a mesma API (Web Push); cada aparelho guarda sua própria
  // inscrição, então desligar aqui no celular não desliga no computador.
  async function alternarPush(ligar) {
    setMudandoPush(true);
    if (ligar) await subscribeToPush(perfil.id);
    else await unsubscribeFromPush(perfil.id);
    setPush(await statusPush());
    setMudandoPush(false);
  }

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    setSalvo(false);

    if (ehCliente && !validarCNPJ(cnpj)) {
      setErro("CNPJ inválido.");
      return;
    }

    setSalvando(true);
    const dados = ehCliente ? { nome, estabelecimento, telefone, endereco, cep, cnpj } : { nome, telefone };
    await supabase.from("perfis").update(dados).eq("id", perfil.id);
    await recarregarPerfil();
    setSalvando(false);
    setSalvo(true);
  }

  async function trocarFoto(arquivo) {
    const caminho = `${perfil.id}/${Date.now()}-${arquivo.name}`;
    const { error } = await supabase.storage.from("fotos-perfil").upload(caminho, arquivo, { upsert: true });
    if (error) return;
    const { data } = supabase.storage.from("fotos-perfil").getPublicUrl(caminho);
    await supabase.from("perfis").update({ foto_url: data.publicUrl }).eq("id", perfil.id);
    await recarregarPerfil();
  }

  async function sair() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="app-content">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Configurações</h1>
        <button type="button" className="btn btn-secondary" onClick={() => navigate("/")}>
          Voltar
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${aba === "perfil" ? "active" : ""}`} onClick={() => setAba("perfil")}>
          Perfil
        </button>
        <button className={`tab ${aba === "editar" ? "active" : ""}`} onClick={() => setAba("editar")}>
          Editar dados
        </button>
      </div>

      {aba === "perfil" && (
        <>
          <div className="card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {perfil?.foto_url ? (
              <img src={perfil.foto_url} className="avatar" alt="Foto de perfil" />
            ) : (
              <div className="avatar" />
            )}
            <div>
              <strong>{ehCliente ? perfil?.estabelecimento || perfil?.nome : perfil?.nome}</strong>
              <p style={{ margin: "2px 0 0", color: "var(--text-dim)", fontSize: 14 }}>
                {LABEL_PAPEL[perfil?.papel] || perfil?.papel}
              </p>
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 14 }}>Aparência</strong>
            <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 10px" }}>
              Vale pra sua conta em qualquer aparelho — não é só desse celular/computador.
            </p>
            <div className="tabs" style={{ marginBottom: 0 }}>
              {OPCOES_TEMA.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  className={`tab ${temaAtual === o.valor ? "active" : ""}`}
                  onClick={() => mudarTema(o.valor)}
                  disabled={salvandoTema}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 14 }}>Notificações</strong>
            <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 10px" }}>
              Avisa neste aparelho quando tiver coleta nova, resposta da equipe, mensagem no chat,
              etc. — vale pra computador e celular, mas é por aparelho: desligar aqui não desliga
              nos seus outros aparelhos.
            </p>
            {push.suportado ? (
              <>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={push.inscrito}
                    disabled={mudandoPush}
                    onChange={(e) => alternarPush(e.target.checked)}
                  />
                  <span className="toggle-trilho" aria-hidden="true" />
                  {push.inscrito ? "Notificações ativadas" : "Notificações desativadas"}
                </label>
                {push.permissaoNegada && !push.inscrito && (
                  <p style={{ color: "var(--danger)", fontSize: 12.5, margin: "8px 0 0" }}>
                    As notificações estão bloqueadas pra esse site nas configurações do
                    navegador/aparelho — libere lá primeiro e tente de novo aqui.
                  </p>
                )}
              </>
            ) : (
              <p style={{ color: "var(--text-dim)", fontSize: 13, margin: 0 }}>
                Esse navegador/aparelho não é compatível com notificações push, ou o app ainda não
                foi configurado pra enviar.
              </p>
            )}
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            {ehCliente && (
              <div className="perfil-linha">
                <span className="perfil-linha-label">Nome do estabelecimento</span>
                <span className="perfil-linha-valor">{perfil?.estabelecimento || "—"}</span>
              </div>
            )}
            <div className="perfil-linha">
              <span className="perfil-linha-label">{ehCliente ? "Seu nome" : "Nome"}</span>
              <span className="perfil-linha-valor">{perfil?.nome || "—"}</span>
            </div>
            <div className="perfil-linha">
              <span className="perfil-linha-label">Telefone</span>
              <span className="perfil-linha-valor">{perfil?.telefone || "—"}</span>
            </div>
            {ehCliente && (
              <>
                <div className="perfil-linha">
                  <span className="perfil-linha-label">CNPJ</span>
                  <span className="perfil-linha-valor">{perfil?.cnpj || "—"}</span>
                </div>
                <div className="perfil-linha">
                  <span className="perfil-linha-label">CEP</span>
                  <span className="perfil-linha-valor">{perfil?.cep || "—"}</span>
                </div>
                <div className="perfil-linha">
                  <span className="perfil-linha-label">Endereço</span>
                  <span className="perfil-linha-valor">{perfil?.endereco || "—"}</span>
                </div>
              </>
            )}
            {perfil?.papel === "coletor" && (
              <div className="perfil-linha">
                <span className="perfil-linha-label">Usuário</span>
                <span className="perfil-linha-valor">{perfil?.usuario_coletor || "—"}</span>
              </div>
            )}
          </div>

          {ehAdmin && <AbaSolicitacoesUsuario />}
        </>
      )}

      {aba === "editar" && (
        <form onSubmit={salvar}>
          <div className="avatar-editor">
            {perfil?.foto_url ? (
              <img src={perfil.foto_url} className="avatar-grande" alt="Foto de perfil" />
            ) : (
              <div className="avatar-grande" />
            )}
            <label className="btn btn-secondary">
              Trocar foto
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && trocarFoto(e.target.files[0])} />
            </label>
          </div>

          {ehCliente && (
            <div className="field">
              <label>Nome do estabelecimento</label>
              <input value={estabelecimento} onChange={(e) => setEstabelecimento(e.target.value)} required />
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
                É esse nome que aparece pro coletor e pra equipe nas suas coletas.
              </p>
            </div>
          )}
          <div className="field">
            <label>{ehCliente ? "Seu nome" : "Nome"}</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="field">
            <label>Telefone</label>
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} required />
          </div>

          {ehCliente && (
            <>
              <div className="field">
                <label>CNPJ</label>
                <input
                  value={cnpj}
                  onChange={(e) => setCnpj(mascararCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                  required
                />
              </div>
              <div className="field">
                <label>CEP</label>
                <input value={cep} onChange={(e) => setCep(e.target.value)} maxLength={9} />
              </div>
              <div className="field">
                <label>Endereço</label>
                <input value={endereco} onChange={(e) => setEndereco(e.target.value)} />
              </div>
            </>
          )}

          {erro && <p style={{ color: "var(--danger)", fontSize: 14 }}>{erro}</p>}
          {salvo && <p style={{ color: "var(--accent)", fontSize: 14 }}>Dados atualizados.</p>}

          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </form>
      )}

      <button onClick={sair} className="btn btn-danger" style={{ marginTop: 24, width: "100%" }}>
        Sair da conta
      </button>
    </div>
  );
}
