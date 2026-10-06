import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { DEMO_MODE } from "../lib/supabase";
import { definirManterConectado } from "../lib/sessaoStorage";
import Logo from "../components/Logo.jsx";

// Os 4 perfis continuam disponíveis no card "Modo demonstração" mais
// abaixo (só aparece quando DEMO_MODE está ligado, ou seja, nunca em
// produção com Supabase de verdade conectado) — é só o formulário de
// login "de verdade" acima que não menciona mais nenhum papel interno
// (despachante, gerente, coletor), pra não anunciar publicamente que
// essas contas existem. Coletor não tem mais aba própria: o campo único
// abaixo aceita e-mail (clientes/equipe) ou usuário (coletor), decidindo
// sozinho qual login usar conforme o que foi digitado.
const CONTAS_DEMO = [
  { papel: "cliente", label: "Cliente", identificador: "demo.cliente@rotecheck.app", modo: "email" },
  { papel: "despachante", label: "Despachante", identificador: "demo.despachante@rotecheck.app", modo: "email" },
  { papel: "gerente", label: "Gerente", identificador: "demo.gerente@rotecheck.app", modo: "email" },
  { papel: "coletor", label: "Coletor", identificador: "demo.coletor", modo: "coletor" },
];
const SENHA_DEMO = "demo123";

export default function Login() {
  const { loginEmail, loginColetor } = useAuth();
  const navigate = useNavigate();
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  // Marcado por padrão — a maioria (principalmente o cliente) não quer
  // ficar digitando senha toda vez que abre o app. Desmarcando, a sessão
  // some ao fechar o navegador/app (útil em computador compartilhado).
  const [manterConectado, setManterConectado] = useState(true);

  async function entrar(ident, sen, modoEscolhido) {
    setErro("");
    setEnviando(true);
    definirManterConectado(manterConectado);
    // Sem aba pra escolher: se o que foi digitado parece e-mail, loga por
    // e-mail (cliente/despachante/gerente); senão, trata como usuário de
    // coletor.
    const modo = modoEscolhido || (ident.includes("@") ? "email" : "coletor");
    const { error } = modo === "email" ? await loginEmail(ident, sen) : await loginColetor(ident, sen);
    setEnviando(false);
    if (error) {
      setErro("Usuário ou senha inválidos.");
      return;
    }
    navigate("/");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await entrar(identificador, senha);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo-linha">
          <Logo size={48} />
          <div>
            <h1 style={{ margin: 0, fontSize: 26 }}>RoteCheck</h1>
            <p style={{ color: "var(--text-dim)", margin: 0, fontSize: 14 }}>Entre para continuar.</p>
          </div>
        </div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Usuário</label>
          <input
            type="text"
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label>Senha</label>
          <div className="campo-senha">
            <input
              type={verSenha ? "text" : "password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="btn-ver-senha"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
              tabIndex={-1}
            >
              {verSenha ? "Ocultar" : "Ver"}
            </button>
          </div>
        </div>

        <label className="toggle" style={{ margin: "4px 0 16px" }}>
          <input
            type="checkbox"
            checked={manterConectado}
            onChange={(e) => setManterConectado(e.target.checked)}
          />
          <span className="toggle-trilho" aria-hidden="true" />
          Manter-me conectado
        </label>

        {erro && <p style={{ color: "var(--danger)", fontSize: 14 }}>{erro}</p>}

        <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={enviando}>
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
        <Link to="/recuperar-senha">Esqueci minha senha</Link>
        <Link to="/recuperar-usuario">Esqueci meu usuário</Link>
        <Link to="/cadastro">Criar conta</Link>
      </div>

      <p style={{ marginTop: 8, fontSize: 14 }}>
        <Link to="/baixar">Instalar no computador ou celular</Link>
      </p>

      {DEMO_MODE && (
        <div className="card" style={{ marginTop: 28 }}>
          <strong style={{ fontSize: 14 }}>Modo demonstração</strong>
          <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 12px" }}>
            Este app ainda não tem um banco de dados real conectado. Entre com uma conta de exemplo
            para ver como cada perfil funciona (senha: {SENHA_DEMO}).
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CONTAS_DEMO.map((conta) => (
              <button
                key={conta.papel}
                type="button"
                className="btn btn-secondary"
                style={{ flex: "1 1 130px" }}
                disabled={enviando}
                onClick={() => entrar(conta.identificador, SENHA_DEMO, conta.modo)}
              >
                Entrar como {conta.label}
              </button>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
