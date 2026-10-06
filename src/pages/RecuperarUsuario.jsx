import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { mascararCNPJ, validarCNPJ, validarEmail } from "../lib/validacao.js";

// Guarda o id da solicitação nesse aparelho pra, ao voltar nessa página
// depois, a pessoa continuar de onde parou (sem precisar de login — ela
// está aqui justamente porque não consegue logar).
const CHAVE_SOLICITACAO = "rotecheck_solicitacao_usuario_id";

// "Esqueci meu usuário": o cliente não consegue provar quem é logando (é
// esse o problema), então se identifica por CNPJ + nome do estabelecimento
// — dado que só quem realmente é dono do CNPJ deveria saber de cabeça.
// Um gerente/despachante confere e aceita ou recusa em Configurações
// (ver AbaSolicitacoesUsuario.jsx). Só depois de aceito é que a pessoa
// define, ela mesma, o novo usuário — ninguém digita por ela.
export default function RecuperarUsuario() {
  const [solicitacaoId, setSolicitacaoId] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_SOLICITACAO) || null;
    } catch {
      return null;
    }
  });
  const [solicitacao, setSolicitacao] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const [cnpj, setCnpj] = useState("");
  const [estabelecimento, setEstabelecimento] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [novoLogin, setNovoLogin] = useState("");
  const [confirmarLogin, setConfirmarLogin] = useState("");
  const [erroTroca, setErroTroca] = useState("");
  const [trocando, setTrocando] = useState(false);

  useEffect(() => {
    if (solicitacaoId) carregarSolicitacao(solicitacaoId);
  }, [solicitacaoId]);

  async function carregarSolicitacao(id) {
    setCarregando(true);
    // RPC em vez de .from("solicitacoes_usuario").select() direto — quem
    // chama isso está deslogado (é o motivo de estar nesta tela), então no
    // banco de verdade não tem policy de RLS liberando leitura direta da
    // tabela pra anônimo. O id funciona como senha de acompanhamento: só
    // quem tem ele lê aquela solicitação (ver rotecheck_ler_solicitacao_usuario
    // em supabase/schema.sql).
    const { data } = await supabase.rpc("rotecheck_ler_solicitacao_usuario", { p_id: id });
    setSolicitacao(data || null);
    setCarregando(false);
  }

  function guardarSolicitacaoId(id) {
    setSolicitacaoId(id);
    try {
      localStorage.setItem(CHAVE_SOLICITACAO, id);
    } catch {
      // localStorage indisponível — a pessoa ainda vê o resultado nesta
      // mesma visita, só não vai conseguir voltar depois pra conferir.
    }
  }

  function recomecar() {
    setSolicitacao(null);
    setSolicitacaoId(null);
    setCnpj("");
    setEstabelecimento("");
    setErro("");
    setNovoLogin("");
    setConfirmarLogin("");
    setErroTroca("");
    try {
      localStorage.removeItem(CHAVE_SOLICITACAO);
    } catch {
      // segue sem limpar — não impede de começar de novo nesta visita
    }
  }

  async function enviarSolicitacao(e) {
    e.preventDefault();
    setErro("");

    if (!validarCNPJ(cnpj)) {
      setErro("CNPJ inválido.");
      return;
    }
    if (!estabelecimento.trim()) {
      setErro("Informe o nome do estabelecimento.");
      return;
    }

    setEnviando(true);
    // RPC em vez de ler "perfis" + inserir direto — sem login, não dá pra
    // deixar uma pessoa qualquer consultar a tabela de clientes por CNPJ
    // (exporia nome/telefone/endereço de qualquer empresa cadastrada). O
    // casamento por CNPJ acontece dentro da função, no banco (ver
    // rotecheck_criar_solicitacao_usuario em supabase/schema.sql).
    const { data: novoIdSolicitacao, error } = await supabase.rpc("rotecheck_criar_solicitacao_usuario", {
      p_cnpj: cnpj,
      p_estabelecimento: estabelecimento.trim(),
    });
    setEnviando(false);

    if (error) {
      setErro(error.message || "Não foi possível enviar a solicitação.");
      return;
    }
    guardarSolicitacaoId(novoIdSolicitacao);
    await carregarSolicitacao(novoIdSolicitacao);
  }

  async function definirNovoLogin(e) {
    e.preventDefault();
    setErroTroca("");

    if (!validarEmail(novoLogin)) {
      setErroTroca("Digite um e-mail válido.");
      return;
    }
    if (novoLogin !== confirmarLogin) {
      setErroTroca("Os e-mails não são iguais.");
      return;
    }

    setTrocando(true);
    const { data, error } = await supabase.rpc("rotecheck_trocar_login", {
      p_solicitacao_id: solicitacao.id,
      p_novo_login: novoLogin,
    });
    setTrocando(false);

    if (error) {
      setErroTroca(error.message || "Não foi possível trocar o usuário.");
      return;
    }
    setSolicitacao((atual) => ({ ...atual, novo_login: data.novo_login }));
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Esqueci meu usuário</h1>

        {!solicitacao && !carregando && (
          <>
            <p style={{ color: "var(--text-dim)", marginBottom: 16 }}>
              Informe o CNPJ e o nome do estabelecimento pra a equipe confirmar que é você e liberar
              a troca do usuário.
            </p>
            <form onSubmit={enviarSolicitacao}>
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
                <label>Nome do estabelecimento</label>
                <input
                  value={estabelecimento}
                  onChange={(e) => setEstabelecimento(e.target.value)}
                  placeholder="Nome da sua empresa"
                  required
                />
              </div>

              {erro && <p style={{ color: "var(--danger)", fontSize: 14 }}>{erro}</p>}

              <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={enviando}>
                {enviando ? "Enviando..." : "Enviar solicitação"}
              </button>
            </form>
          </>
        )}

        {carregando && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}

        {!carregando && solicitacao && solicitacao.status === "pendente" && (
          <>
            <p style={{ color: "var(--text-dim)", marginBottom: 16 }}>
              Solicitação enviada para <strong>{solicitacao.estabelecimento}</strong>. Assim que
              alguém da equipe aceitar, volte nesta página (neste mesmo aparelho) pra definir seu
              novo usuário.
            </p>
            <button type="button" className="btn btn-secondary" style={{ width: "100%" }} onClick={() => carregarSolicitacao(solicitacao.id)}>
              Atualizar status
            </button>
            <button type="button" className="btn btn-danger" style={{ width: "100%", marginTop: 8 }} onClick={recomecar}>
              Cancelar e começar de novo
            </button>
          </>
        )}

        {!carregando && solicitacao && solicitacao.status === "recusada" && (
          <>
            <p style={{ color: "var(--danger)", marginBottom: 16 }}>
              Sua solicitação não foi aceita. Confira o CNPJ e o nome do estabelecimento, ou fale
              direto com a equipe.
            </p>
            <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={recomecar}>
              Tentar de novo
            </button>
          </>
        )}

        {!carregando && solicitacao && solicitacao.status === "aceita" && !solicitacao.novo_login && (
          <>
            <p style={{ color: "var(--accent)", marginBottom: 16 }}>
              Solicitação aceita! Defina o novo e-mail que você vai usar pra entrar.
            </p>
            <form onSubmit={definirNovoLogin}>
              <div className="field">
                <label>Novo e-mail de login</label>
                <input
                  type="email"
                  value={novoLogin}
                  onChange={(e) => setNovoLogin(e.target.value)}
                  placeholder="voce@exemplo.com"
                  required
                />
              </div>
              <div className="field">
                <label>Confirmar e-mail</label>
                <input
                  type="email"
                  value={confirmarLogin}
                  onChange={(e) => setConfirmarLogin(e.target.value)}
                  required
                />
              </div>

              {erroTroca && <p style={{ color: "var(--danger)", fontSize: 14 }}>{erroTroca}</p>}

              <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={trocando}>
                {trocando ? "Salvando..." : "Definir novo usuário"}
              </button>
            </form>
          </>
        )}

        {!carregando && solicitacao && solicitacao.status === "aceita" && solicitacao.novo_login && (
          <>
            <p style={{ color: "var(--accent)", marginBottom: 16 }}>
              Pronto! Já dá pra entrar com o usuário <strong>{solicitacao.novo_login}</strong>.
            </p>
            <Link to="/login" className="btn btn-primary" style={{ width: "100%", textAlign: "center", display: "block" }}>
              Ir para o login
            </Link>
            <button type="button" className="btn btn-secondary" style={{ width: "100%", marginTop: 8 }} onClick={recomecar}>
              Fazer outra solicitação
            </button>
          </>
        )}

        <p style={{ marginTop: 16, fontSize: 14 }}>
          <Link to="/login">Voltar para o login</Link>
        </p>
      </div>
    </div>
  );
}
