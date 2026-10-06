import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth.jsx";
import { LABEL_PAPEL } from "../lib/papeis.js";
import {
  mascararCNPJ,
  validarCNPJ,
  mascararTelefone,
  validarTelefone,
  mascararCEP,
  cepValido,
  validarEmail,
  forcaSenha,
  INFO_FORCA_SENHA,
} from "../lib/validacao.js";

const FORM_INICIAL = {
  nome: "",
  estabelecimento: "",
  email: "",
  usuario: "",
  senha: "",
  confirmarSenha: "",
  telefone: "",
  cnpj: "",
  cep: "",
  rua: "",
  numero: "",
  bairro: "",
  cidade: "",
  uf: "",
  complemento: "",
};

export default function Cadastro() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { carregarPerfilPara } = useAuth();
  // Despachante e gerente NÃO se autocadastram escolhendo o papel numa aba
  // — isso ficaria aberto demais (qualquer um poderia se declarar
  // "gerente"). Os dois únicos jeitos de virar despachante/gerente são:
  // (1) um link de convite de uso único gerado por um gerente
  // (?convite=<codigo> na URL), ou (2) ser o primeiríssimo gerente da
  // empresa, quando ainda não existe nenhum (senão ninguém existiria pra
  // convidar ninguém).
  const codigoConvite = searchParams.get("convite");
  const [statusConvite, setStatusConvite] = useState(codigoConvite ? "verificando" : "nenhum");
  const [papelConvite, setPapelConvite] = useState(null);
  const [bootstrapDisponivel, setBootstrapDisponivel] = useState(false);
  const [checandoBootstrap, setChecandoBootstrap] = useState(!codigoConvite);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (codigoConvite) {
        const { data } = await supabase.rpc("rotecheck_verificar_convite", { p_codigo: codigoConvite });
        if (cancelado) return;
        if (data) {
          setPapelConvite(data);
          setStatusConvite("valido");
        } else {
          setStatusConvite("invalido");
        }
      } else {
        const { data: existeGerente } = await supabase.rpc("rotecheck_existe_gerente_aprovado");
        if (cancelado) return;
        setBootstrapDisponivel(!existeGerente);
        setChecandoBootstrap(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [codigoConvite]);

  // Coletor não tem mais essa aba aqui — as contas deles agora são criadas
  // direto pelo gerente/administração (usuário e senha fixos), não por
  // autocadastro. Só sobram "cliente" e, quando aplicável, o primeiro
  // gerente.
  const [tipo, setTipo] = useState("cliente"); // "cliente" | "bootstrap_gerente"
  const [form, setForm] = useState(FORM_INICIAL);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);

  const modoEquipeSemPapelEscolhido = statusConvite === "valido" || tipo === "bootstrap_gerente";

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
  }

  // Busca automática de endereço pelo CEP (ViaCEP) — número e complemento
  // continuam manuais, o resto (rua/bairro/cidade/UF) vem preenchido.
  async function buscarCep(valorDigitado) {
    const mascarado = mascararCEP(valorDigitado);
    atualizar("cep", mascarado);
    const limpo = mascarado.replace(/\D/g, "");
    if (limpo.length !== 8) return;

    setBuscandoCep(true);
    setErros((e) => ({ ...e, cep: undefined }));
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      if (!resp.ok) throw new Error("falha na consulta");
      const dados = await resp.json();
      if (dados.erro) {
        setErros((e) => ({ ...e, cep: "CEP não encontrado." }));
        return;
      }
      setForm((f) => ({
        ...f,
        rua: dados.logradouro || f.rua,
        bairro: dados.bairro || f.bairro,
        cidade: dados.localidade || f.cidade,
        uf: dados.uf || f.uf,
      }));
      setErros((e) => ({ ...e, rua: undefined, bairro: undefined, cidade: undefined, uf: undefined }));
    } catch (err) {
      console.error("Erro ao buscar CEP:", err);
      setErros((e) => ({ ...e, cep: "Não foi possível buscar esse CEP agora. Confira e tente de novo." }));
    } finally {
      setBuscandoCep(false);
    }
  }

  function validar() {
    const e = {};
    if (!form.nome.trim()) e.nome = "Informe o nome completo.";

    if (modoEquipeSemPapelEscolhido) {
      if (!validarEmail(form.email)) e.email = "E-mail inválido.";
    } else if (tipo === "cliente") {
      if (!form.estabelecimento.trim()) e.estabelecimento = "Informe o nome do estabelecimento.";
      if (!validarEmail(form.email)) e.email = "E-mail inválido.";
      if (!validarCNPJ(form.cnpj)) e.cnpj = "CNPJ inválido.";
      if (!cepValido(form.cep)) e.cep = "CEP inválido.";
      if (!form.rua.trim()) e.rua = "Informe a rua.";
      if (!form.numero.trim()) e.numero = "Informe o número.";
      if (!form.bairro.trim()) e.bairro = "Informe o bairro.";
      if (!form.cidade.trim()) e.cidade = "Informe a cidade.";
      if (!form.uf.trim()) e.uf = "Informe o estado (UF).";
    }

    if (!validarTelefone(form.telefone)) e.telefone = "Telefone inválido.";
    if (form.senha.length < 6) e.senha = "A senha precisa ter pelo menos 6 caracteres.";
    if (form.confirmarSenha !== form.senha) e.confirmarSenha = "As senhas não coincidem.";

    return e;
  }

  function enderecoCompleto() {
    const partes = [`${form.rua}, ${form.numero}`];
    if (form.complemento.trim()) partes.push(form.complemento.trim());
    partes.push(form.bairro);
    partes.push(`${form.cidade} - ${form.uf}`);
    return partes.join(", ");
  }

  // Logo depois do signUp, a sessão nova às vezes ainda não "pegou" de
  // verdade do lado do Supabase (já vimos isso acontecer — um bug deles
  // de cache de JWT que soma alguns segundos de atraso). Se a
  // chamada que cria o perfil disparar bem nesse instante, ela falha
  // mesmo com o cadastro tendo "dado certo" do ponto de vista de quem tá
  // preenchendo o formulário — foi o que aconteceu com a conta do
  // primeiro gerente: o login foi criado, mas a linha em "perfis" nunca
  // chegou a existir, e só se via o erro passando batido numa telinha
  // pequena (quando não ficava preto direto, ver ErrorBoundary/App.jsx).
  // Tentar de novo antes de desistir cobre esse soluço passageiro.
  async function comRetentativa(chamar, tentativas = 2, atrasoMs = 1200) {
    let resultado = await chamar();
    for (let i = 0; i < tentativas && resultado.error; i++) {
      await new Promise((resolver) => setTimeout(resolver, atrasoMs));
      resultado = await chamar();
    }
    return resultado;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const errosValidacao = validar();
    if (Object.keys(errosValidacao).length > 0) {
      setErros(errosValidacao);
      return;
    }

    setErros({});
    setEnviando(true);

    try {
      if (statusConvite === "valido") {
        // Convite de despachante/gerente: o papel vem do convite (não do
        // que a pessoa escolheu), e já sai aprovado — foi convidado por
        // um gerente de verdade.
        const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.senha });
        if (error) throw { campo: "email", mensagem: error.message };

        const { error: erroConvite } = await comRetentativa(() =>
          supabase.rpc("rotecheck_cadastrar_via_convite", {
            p_codigo: codigoConvite,
            p_nome: form.nome,
            p_telefone: form.telefone,
          })
        );
        if (erroConvite) throw { campo: "geral", mensagem: erroConvite.message };

        await carregarPerfilPara(data.user.id);
        navigate("/");
        return;
      } else if (tipo === "bootstrap_gerente") {
        // Só aparece quando ainda não existe nenhum gerente — libera na
        // hora, porque senão ninguém existiria pra convidar ninguém. A
        // confirmação de "ainda não existe gerente nenhum" é feita de novo
        // do lado do banco (rotecheck_cadastrar_primeiro_gerente), não só
        // aqui na tela — assim ninguém consegue virar um segundo gerente
        // "de graça" chamando a API direto.
        const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.senha });
        if (error) throw { campo: "email", mensagem: error.message };

        const { error: erroPerfil } = await comRetentativa(() =>
          supabase.rpc("rotecheck_cadastrar_primeiro_gerente", {
            p_nome: form.nome,
            p_telefone: form.telefone,
          })
        );
        if (erroPerfil) throw { campo: "geral", mensagem: erroPerfil.message };

        await carregarPerfilPara(data.user.id);
        navigate("/");
        return;
      } else if (tipo === "cliente") {
        // Cliente também fica pendente até um gerente aprovar (igual
        // coletor) — o gerente confere o cadastro da empresa antes de
        // liberar acesso.
        const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.senha });
        if (error) throw { campo: "email", mensagem: error.message };

        const { error: erroPerfil } = await comRetentativa(() =>
          supabase.from("perfis").insert({
            id: data.user.id,
            papel: "cliente",
            nome: form.nome,
            estabelecimento: form.estabelecimento,
            telefone: form.telefone,
            cnpj: form.cnpj,
            cep: form.cep,
            endereco: enderecoCompleto(),
            aprovado: false,
          })
        );
        if (erroPerfil) throw { campo: "geral", mensagem: erroPerfil.message };
        await carregarPerfilPara(data.user.id);
        navigate("/cadastro-pendente");
        return;
      }
    } catch (err) {
      console.error(err);
      const campo = err?.campo || "geral";
      const mensagem = err?.mensagem || err?.message || "Não foi possível concluir o cadastro.";
      setErros({ [campo]: mensagem });
    } finally {
      setEnviando(false);
    }
  }

  const forca = forcaSenha(form.senha);
  const infoForca = forca ? INFO_FORCA_SENHA[forca] : null;

  // Chegou aqui com um "?convite=..." na URL, mas ainda não sabemos se é
  // válido — evita mostrar as abas normais (cliente/coletor) por um
  // instante antes de saber que na verdade é um convite.
  if (statusConvite === "verificando") {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ color: "var(--text-dim)" }}>Verificando convite...</p>
        </div>
      </div>
    );
  }

  if (statusConvite === "invalido") {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 420, textAlign: "center" }}>
          <h1>Convite inválido</h1>
          <p style={{ color: "var(--text-dim)" }}>
            Esse link de convite não é válido ou já foi usado. Peça um novo link pro seu gerente.
          </p>
          <p style={{ marginTop: 16, fontSize: 14 }}>
            <Link to="/login">Voltar para o login</Link>
          </p>
        </div>
      </div>
    );
  }

  const abasDisponiveis = [
    { valor: "cliente", label: "Sou cliente" },
    ...(bootstrapDisponivel ? [{ valor: "bootstrap_gerente", label: "Sou o primeiro gerente" }] : []),
  ];

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 420 }}>
        {statusConvite === "valido" ? (
          <>
            <h1>Criar conta</h1>
            <p style={{ color: "var(--text-dim)", marginTop: -8 }}>
              Você foi convidado para entrar como <strong>{LABEL_PAPEL[papelConvite] || papelConvite}</strong>.
            </p>
          </>
        ) : (
          <>
            <h1>Criar conta</h1>
            {abasDisponiveis.length > 1 && (
              <div className="tabs">
                {abasDisponiveis.map((a) => (
                  <button
                    key={a.valor}
                    type="button"
                    className={`tab ${tipo === a.valor ? "active" : ""}`}
                    onClick={() => setTipo(a.valor)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
            {tipo === "bootstrap_gerente" && (
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: -4 }}>
                Nenhum gerente cadastrado ainda — essa conta vai ser a primeira e já libera na hora. Depois
                dela, só é possível virar despachante ou gerente com um convite gerado por um gerente.
              </p>
            )}
            {/* Despachante e gerente não aparecem aqui como opção — só entram
                por convite (link de um gerente) ou, pra gerente, sendo o
                primeiríssimo da empresa (aba acima, só quando aplicável). */}
          </>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label>{tipo === "cliente" && !modoEquipeSemPapelEscolhido ? "Seu nome" : "Nome completo"}</label>
            <input value={form.nome} onChange={(e) => atualizar("nome", e.target.value)} />
            {erros.nome && <p className="erro-campo">{erros.nome}</p>}
          </div>

          {modoEquipeSemPapelEscolhido ? (
            <div className="field">
              <label>E-mail</label>
              <input type="email" value={form.email} onChange={(e) => atualizar("email", e.target.value)} />
              {erros.email && <p className="erro-campo">{erros.email}</p>}
            </div>
          ) : tipo === "cliente" ? (
            <>
              <div className="field">
                <label>Nome do estabelecimento</label>
                <input
                  value={form.estabelecimento}
                  onChange={(e) => atualizar("estabelecimento", e.target.value)}
                  placeholder="Ex.: Papelaria Ferreira"
                />
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
                  É esse nome que aparece pro coletor e pra equipe nas suas coletas.
                </p>
                {erros.estabelecimento && <p className="erro-campo">{erros.estabelecimento}</p>}
              </div>

              <div className="field">
                <label>E-mail</label>
                <input type="email" value={form.email} onChange={(e) => atualizar("email", e.target.value)} />
                {erros.email && <p className="erro-campo">{erros.email}</p>}
              </div>

              <div className="field">
                <label>CNPJ</label>
                <input
                  value={form.cnpj}
                  onChange={(e) => atualizar("cnpj", mascararCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                />
                {erros.cnpj && <p className="erro-campo">{erros.cnpj}</p>}
              </div>

              <div className="field">
                <label>CEP {buscandoCep && "(buscando...)"}</label>
                <input
                  value={form.cep}
                  onChange={(e) => buscarCep(e.target.value)}
                  placeholder="00000-000"
                  inputMode="numeric"
                  maxLength={9}
                />
                {erros.cep && <p className="erro-campo">{erros.cep}</p>}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <div className="field" style={{ flex: 2 }}>
                  <label>Rua</label>
                  <input value={form.rua} onChange={(e) => atualizar("rua", e.target.value)} />
                  {erros.rua && <p className="erro-campo">{erros.rua}</p>}
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Número</label>
                  <input value={form.numero} onChange={(e) => atualizar("numero", e.target.value)} />
                  {erros.numero && <p className="erro-campo">{erros.numero}</p>}
                </div>
              </div>

              <div className="field">
                <label>Complemento (opcional)</label>
                <input value={form.complemento} onChange={(e) => atualizar("complemento", e.target.value)} />
              </div>

              <div className="field">
                <label>Bairro</label>
                <input value={form.bairro} onChange={(e) => atualizar("bairro", e.target.value)} />
                {erros.bairro && <p className="erro-campo">{erros.bairro}</p>}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <div className="field" style={{ flex: 2 }}>
                  <label>Cidade</label>
                  <input value={form.cidade} onChange={(e) => atualizar("cidade", e.target.value)} />
                  {erros.cidade && <p className="erro-campo">{erros.cidade}</p>}
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>UF</label>
                  <input value={form.uf} onChange={(e) => atualizar("uf", e.target.value.toUpperCase())} maxLength={2} />
                  {erros.uf && <p className="erro-campo">{erros.uf}</p>}
                </div>
              </div>
            </>
          ) : null}

          <div className="field">
            <label>Telefone</label>
            <input
              value={form.telefone}
              onChange={(e) => atualizar("telefone", mascararTelefone(e.target.value))}
              placeholder="(00) 00000-0000"
              inputMode="numeric"
            />
            {erros.telefone && <p className="erro-campo">{erros.telefone}</p>}
          </div>

          <div className="field">
            <label>Senha</label>
            <input type="password" value={form.senha} onChange={(e) => atualizar("senha", e.target.value)} />
            {infoForca && (
              <div className="forca-senha">
                <div className="forca-senha-barra">
                  <span style={{ background: infoForca.cor, width: forca === "fraca" ? "33%" : forca === "media" ? "66%" : "100%" }} />
                </div>
                <span style={{ color: infoForca.cor, fontSize: 12, fontWeight: 600 }}>{infoForca.label}</span>
              </div>
            )}
            {erros.senha && <p className="erro-campo">{erros.senha}</p>}
          </div>

          <div className="field">
            <label>Confirmar senha</label>
            <input
              type="password"
              value={form.confirmarSenha}
              onChange={(e) => atualizar("confirmarSenha", e.target.value)}
            />
            {erros.confirmarSenha && <p className="erro-campo">{erros.confirmarSenha}</p>}
          </div>

          {tipo === "cliente" && !modoEquipeSemPapelEscolhido && (
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
              Seu cadastro fica pendente até um gerente aprovar.
            </p>
          )}
          {statusConvite === "valido" && (
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
              Seu acesso já libera na hora — não precisa esperar aprovação.
            </p>
          )}
          {tipo === "bootstrap_gerente" && (
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
              Seu acesso já libera na hora, como primeiro gerente da empresa.
            </p>
          )}

          {erros.geral && <p className="erro-campo" style={{ fontSize: 14 }}>{erros.geral}</p>}

          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={enviando}>
            {enviando ? "Enviando..." : "Criar conta"}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 14 }}>
          <Link to="/login">Já tenho conta</Link>
        </p>
      </div>
    </div>
  );
}
