// Cliente falso, usado só quando o app não tem credenciais reais do
// Supabase configuradas (ver supabase.js). Imita a parte da API do
// @supabase/supabase-js que este app usa, guardando tudo em memória (+
// localStorage/sessionStorage para a sessão — ver sessaoStorage.js —, pra
// não perder o login ao dar refresh).
//
// Isso existe pra duas coisas: (1) o app nunca mais fica com tela em
// branco quando alguém esquece de configurar o .env, e (2) dá pra navegar
// por todos os perfis (cliente/despachante/gerente/coletor) com dados de
// exemplo, sem precisar de um projeto Supabase de verdade.

import {
  perfis,
  coletas,
  mensagens,
  veiculos,
  rotas,
  posicoesGps,
  pushSubscriptions,
  convites,
  printsRotas,
  paradasFixas,
  confirmacoesParadaFixa,
  clientesEsperados,
  solicitacoesUsuario,
  SENHA_DEMO,
} from "./demoData";
import { storageSessaoAdaptativo } from "./sessaoStorage";

const TABELAS = {
  perfis,
  coletas,
  mensagens,
  veiculos,
  rotas,
  posicoes_gps: posicoesGps,
  push_subscriptions: pushSubscriptions,
  convites,
  prints_rotas: printsRotas,
  paradas_fixas: paradasFixas,
  confirmacoes_parada_fixa: confirmacoesParadaFixa,
  clientes_esperados: clientesEsperados,
  solicitacoes_usuario: solicitacoesUsuario,
};

// Prints de rota mais antigos que isso são apagados (ver
// rotecheck_limpar_prints_antigos abaixo) — mesma janela de retenção do
// banco de verdade (ver supabase/schema.sql).
const DIAS_RETENCAO_PRINTS = 15;

let proximoId = 1000;
const novoId = (prefixo) => `${prefixo}-${proximoId++}`;

// Persiste as "tabelas" (perfis, coletas, convites etc.) no localStorage,
// além da sessão — sem isso, um convite gerado agora "sumiria" assim que a
// pessoa convidada abrisse o link numa aba nova (recarregar a página
// reinicia tudo que só vive em memória). Mesma ideia do CHAVE_SESSAO logo
// abaixo, só que pro conteúdo das tabelas.
const CHAVE_DADOS = "rotecheck_demo_dados";

// Estas tabelas guardam dado "de hoje" (horário da coleta, mensagem do
// chat, trajeto de GPS, confirmação do expediente) — os exemplos em
// demoData.js são gerados com horário relativo a "agora" (ver horas(n) lá),
// pra sempre aparecerem recentes. Só que, sem isso aqui, o que fica salvo
// no localStorage congela no horário de quando a pessoa abriu o app da
// primeira vez: se ela voltar num dia diferente, os filtros de "hoje" (ver
// ColetorHome.jsx, DespachanteHome.jsx etc.) não batem mais com aquele
// horário congelado e a tela aparece vazia — foi o que o Felipe viu no
// coletor ("Nenhuma coleta atribuída para hoje" mesmo devendo ter uma).
// Por isso, quando o que está salvo é de um dia diferente de hoje, estas
// tabelas voltam a usar os exemplos fresquinhos (gerados agora) em vez do
// que ficou salvo. As outras (cadastros, convites, frota, roteiro fixo
// semanal etc.) não têm essa relação com "hoje" e continuam sendo
// restauradas normalmente, não importa há quanto tempo — é por isso que
// elas ficam persistidas em primeiro lugar (ver comentário mais abaixo).
const TABELAS_DE_HOJE = ["coletas", "mensagens", "rotas", "posicoes_gps", "confirmacoes_parada_fixa"];

function diaDeHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function persistirDados() {
  try {
    localStorage.setItem(
      CHAVE_DADOS,
      JSON.stringify({ proximoId, tabelas: TABELAS, usuarios: Array.from(usuarios.entries()), diaSalvo: diaDeHoje() })
    );
  } catch {
    // localStorage indisponível (modo privado etc.) — segue só em memória.
  }
}

function carregarDadosPersistidos() {
  try {
    const salvo = localStorage.getItem(CHAVE_DADOS);
    return salvo ? JSON.parse(salvo) : null;
  } catch {
    return null;
  }
}

const urlsDeFoto = new Map(); // path -> object URL (fotos enviadas nesta sessão)

function pegarPorCaminho(obj, caminho) {
  return caminho.split(".").reduce((v, k) => (v == null ? v : v[k]), obj);
}

function aplicarFiltros(linhas, filtros) {
  return linhas.filter((linha) =>
    filtros.every(([tipo, coluna, valor]) => {
      const atual = pegarPorCaminho(linha, coluna);
      if (tipo === "eq") return atual === valor;
      if (tipo === "gte") return atual >= valor;
      if (tipo === "lte") return atual <= valor;
      if (tipo === "neq") return atual !== valor;
      if (tipo === "in") return Array.isArray(valor) && valor.includes(atual);
      return true;
    })
  );
}

// Faz um select("*") ou select("a, b, rel:coluna(x, y)") minimalista —
// o suficiente pro que este app pede.
function montarSelecao(linha, selectStr) {
  if (!selectStr || selectStr.trim() === "*") return { ...linha };

  const partes = [];
  let atual = "";
  let dentroParen = 0;
  for (const ch of selectStr) {
    if (ch === "(") dentroParen++;
    if (ch === ")") dentroParen--;
    if (ch === "," && dentroParen === 0) {
      partes.push(atual.trim());
      atual = "";
    } else {
      atual += ch;
    }
  }
  if (atual.trim()) partes.push(atual.trim());

  const resultado = {};
  for (const parte of partes) {
    const relacao = parte.match(/^(\w+):(\w+)\((.+)\)$/);
    if (relacao) {
      const [, alias, coluna, subcampos] = relacao;
      const relacionado = TABELAS.perfis.find((p) => p.id === linha[coluna]);
      resultado[alias] = relacionado
        ? montarSelecao(relacionado, subcampos)
        : null;
    } else if (parte === "*") {
      Object.assign(resultado, linha);
    } else {
      resultado[parte] = linha[parte];
    }
  }
  return resultado;
}

class MockQuery {
  constructor(nomeTabela) {
    this.nomeTabela = nomeTabela;
    this.filtros = [];
    this.selectStr = "*";
    this.ordenacao = null;
    this.singleFlag = false;
    this.op = "select";
    this.payload = null;
  }

  select(str) {
    this.selectStr = str || "*";
    return this;
  }
  insert(obj) {
    this.op = "insert";
    this.payload = obj;
    return this;
  }
  update(obj) {
    this.op = "update";
    this.payload = obj;
    return this;
  }
  upsert(obj) {
    this.op = "upsert";
    this.payload = obj;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(coluna, valor) {
    this.filtros.push(["eq", coluna, valor]);
    return this;
  }
  neq(coluna, valor) {
    this.filtros.push(["neq", coluna, valor]);
    return this;
  }
  gte(coluna, valor) {
    this.filtros.push(["gte", coluna, valor]);
    return this;
  }
  lte(coluna, valor) {
    this.filtros.push(["lte", coluna, valor]);
    return this;
  }
  in(coluna, valores) {
    this.filtros.push(["in", coluna, valores]);
    return this;
  }
  order(coluna, opts) {
    this.ordenacao = { coluna, ascending: opts?.ascending !== false };
    return this;
  }
  single() {
    this.singleFlag = true;
    return this;
  }

  async _executar() {
    // Pequeno atraso artificial só pra parecer uma chamada de rede de
    // verdade (evita "piscar" tela demais durante os testes visuais).
    await new Promise((r) => setTimeout(r, 30));

    const tabela = TABELAS[this.nomeTabela];
    if (!tabela) return { data: null, error: { message: `Tabela "${this.nomeTabela}" não existe no modo demo.` } };

    if (this.op === "insert") {
      const linha = { id: novoId(this.nomeTabela), criado_em: new Date().toISOString(), ...this.payload };
      tabela.push(linha);
      persistirDados();
      return { data: [linha], error: null };
    }

    if (this.op === "upsert") {
      const chave = this.payload.id ? "id" : Object.keys(this.payload)[0];
      const existente = tabela.find((l) => l[chave] === this.payload[chave]);
      if (existente) Object.assign(existente, this.payload);
      else tabela.push({ id: novoId(this.nomeTabela), ...this.payload });
      persistirDados();
      return { data: [this.payload], error: null };
    }

    if (this.op === "update") {
      const alvos = aplicarFiltros(tabela, this.filtros);
      alvos.forEach((linha) => Object.assign(linha, this.payload));
      persistirDados();
      return { data: alvos, error: null };
    }

    if (this.op === "delete") {
      const alvos = new Set(aplicarFiltros(tabela, this.filtros));
      for (let i = tabela.length - 1; i >= 0; i--) {
        if (alvos.has(tabela[i])) tabela.splice(i, 1);
      }
      persistirDados();
      return { data: null, error: null };
    }

    // select
    let linhas = aplicarFiltros(tabela, this.filtros);
    if (this.ordenacao) {
      const { coluna, ascending } = this.ordenacao;
      linhas = [...linhas].sort((a, b) => {
        const av = pegarPorCaminho(a, coluna);
        const bv = pegarPorCaminho(b, coluna);
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
      });
    }
    const montadas = linhas.map((l) => montarSelecao(l, this.selectStr));

    if (this.singleFlag) {
      return montadas[0]
        ? { data: montadas[0], error: null }
        : { data: null, error: { message: "Nenhum registro encontrado." } };
    }
    return { data: montadas, error: null };
  }

  then(resolve, reject) {
    this._executar().then(resolve, reject);
  }
}

// --- auth -------------------------------------------------------------

const CHAVE_SESSAO = "rotecheck_demo_session";
let sessaoAtual = null;
let ouvintes = [];

try {
  // Usa o mesmo storage adaptativo do Supabase de verdade (ver
  // sessaoStorage.js) — respeita a checkbox "Manter-me conectado" da tela
  // de Login, guardando no localStorage (sobrevive a fechar o app) ou no
  // sessionStorage (some ao fechar a aba/navegador).
  const salva = storageSessaoAdaptativo.getItem(CHAVE_SESSAO);
  if (salva) sessaoAtual = JSON.parse(salva);
} catch {
  sessaoAtual = null;
}

function persistirSessao() {
  if (sessaoAtual) storageSessaoAdaptativo.setItem(CHAVE_SESSAO, JSON.stringify(sessaoAtual));
  else storageSessaoAdaptativo.removeItem(CHAVE_SESSAO);
}

function avisarOuvintes(evento) {
  ouvintes.forEach((cb) => cb(evento, sessaoAtual));
}

// Registro de credenciais (equivalente ao auth.users do Supabase de
// verdade, que fica separado da tabela "perfis"). Semeado com as contas
// de demonstração (senha fixa) — cadastros novos entram aqui com a senha
// que a pessoa escolheu.
const usuarios = new Map(); // email -> { id, senha }
for (const p of perfis) {
  if (p.email) usuarios.set(p.email, { id: p.id, senha: SENHA_DEMO });
}

// Sobrepõe com o que foi persistido de sessões anteriores nesta aba/domínio
// (cadastros novos, convites gerados/usados etc.) — sem isso, um convite
// gerado por um gerente "some" assim que a pessoa convidada abre o link
// numa aba nova, porque essa aba começaria com os dados de exemplo do
// zero. As contas de demonstração acima continuam sempre funcionando,
// mesmo que os dados persistidos sejam de uma versão mais antiga do app.
const dadosPersistidos = carregarDadosPersistidos();
if (dadosPersistidos) {
  if (typeof dadosPersistidos.proximoId === "number") {
    proximoId = Math.max(proximoId, dadosPersistidos.proximoId);
  }
  // Se o que foi salvo é de outro dia, pula as tabelas "de hoje" — elas
  // ficam com o exemplo fresco de demoData.js (ver comentário acima de
  // TABELAS_DE_HOJE) em vez do dado antigo congelado.
  const mesmoDia = dadosPersistidos.diaSalvo === diaDeHoje();
  for (const chave of Object.keys(TABELAS)) {
    if (!mesmoDia && TABELAS_DE_HOJE.includes(chave)) continue;
    if (Array.isArray(dadosPersistidos.tabelas?.[chave])) {
      TABELAS[chave] = dadosPersistidos.tabelas[chave];
    }
  }
  for (const [email, credencial] of dadosPersistidos.usuarios || []) {
    usuarios.set(email, credencial);
  }
}

const auth = {
  async getSession() {
    return { data: { session: sessaoAtual } };
  },
  onAuthStateChange(cb) {
    ouvintes.push(cb);
    return {
      data: {
        subscription: {
          unsubscribe() {
            ouvintes = ouvintes.filter((l) => l !== cb);
          },
        },
      },
    };
  },
  async signInWithPassword({ email, password }) {
    const usuario = usuarios.get(email);
    if (!usuario || usuario.senha !== password) {
      return { data: null, error: { message: "Usuário ou senha inválidos." } };
    }
    sessaoAtual = { user: { id: usuario.id, email } };
    persistirSessao();
    avisarOuvintes("SIGNED_IN");
    return { data: { session: sessaoAtual }, error: null };
  },
  async signUp({ email, password }) {
    if (usuarios.has(email)) {
      return { data: null, error: { message: "Já existe uma conta com esse e-mail." } };
    }
    const id = novoId("usuario");
    usuarios.set(email, { id, senha: password });
    persistirDados();
    sessaoAtual = { user: { id, email } };
    persistirSessao();
    avisarOuvintes("SIGNED_IN");
    return { data: { user: { id } }, error: null };
  },
  async signOut() {
    sessaoAtual = null;
    persistirSessao();
    avisarOuvintes("SIGNED_OUT");
  },
  async resetPasswordForEmail() {
    return { error: null };
  },
  async signInWithOtp() {
    return { error: null };
  },
};

// --- storage ------------------------------------------------------------

const storage = {
  from() {
    return {
      async upload(path, arquivo) {
        try {
          if (typeof URL !== "undefined" && arquivo instanceof Blob) {
            urlsDeFoto.set(path, URL.createObjectURL(arquivo));
          }
        } catch {
          // segue sem preview se o navegador não suportar
        }
        return { data: { path }, error: null };
      },
      getPublicUrl(path) {
        return { data: { publicUrl: urlsDeFoto.get(path) || "" } };
      },
    };
  },
};

// --- realtime (no-op) -----------------------------------------------------

function canalFalso() {
  const canal = {
    on() {
      return canal;
    },
    subscribe() {
      return canal;
    },
  };
  return canal;
}

// --- rpc (funções do banco, chamadas via supabase.rpc(nome, params)) ----
// Só implementa as que o app realmente usa — ver supabase/schema.sql para
// a versão real (security definer) que roda no Supabase de verdade.
async function rpc(nome, params) {
  await new Promise((r) => setTimeout(r, 20));

  if (nome === "rotecheck_existe_gerente_aprovado") {
    const existe = TABELAS.perfis.some((p) => p.papel === "gerente" && p.aprovado === true);
    return { data: existe, error: null };
  }

  // Só verifica (não consome) — usado assim que a tela de cadastro abre
  // com "?convite=..." na URL, pra saber se mostra o formulário ou um
  // aviso de convite inválido/expirado.
  if (nome === "rotecheck_verificar_convite") {
    const convite = TABELAS.convites.find((c) => c.codigo === params?.p_codigo && !c.usado);
    return { data: convite ? convite.papel : null, error: null };
  }

  // Consome o convite e já cria o perfil (despachante/gerente aprovado na
  // hora — foi convidado por um gerente de verdade, não precisa de uma
  // segunda aprovação depois).
  if (nome === "rotecheck_cadastrar_via_convite") {
    const convite = TABELAS.convites.find((c) => c.codigo === params?.p_codigo && !c.usado);
    if (!convite) {
      return { data: null, error: { message: "Esse convite não é válido ou já foi usado." } };
    }
    const usuarioId = sessaoAtual?.user?.id;
    convite.usado = true;
    convite.usado_por = usuarioId;
    convite.usado_em = new Date().toISOString();
    TABELAS.perfis.push({
      id: usuarioId,
      papel: convite.papel,
      nome: params?.p_nome,
      telefone: params?.p_telefone,
      aprovado: true,
      criado_em: new Date().toISOString(),
    });
    persistirDados();
    return { data: convite.papel, error: null };
  }

  // Cria o primeiríssimo gerente da empresa — confere de novo (igual o
  // banco de verdade faria) que ainda não existe nenhum, pra não dar pra
  // criar um segundo "primeiro gerente" chamando isso de novo.
  if (nome === "rotecheck_cadastrar_primeiro_gerente") {
    const jaExisteGerente = TABELAS.perfis.some((p) => p.papel === "gerente" && p.aprovado === true);
    if (jaExisteGerente) {
      return { data: null, error: { message: "Já existe um gerente cadastrado nesta empresa." } };
    }
    const usuarioId = sessaoAtual?.user?.id;
    TABELAS.perfis.push({
      id: usuarioId,
      papel: "gerente",
      nome: params?.p_nome,
      telefone: params?.p_telefone,
      aprovado: true,
      criado_em: new Date().toISOString(),
    });
    persistirDados();
    return { data: null, error: null };
  }

  // Apaga prints de rota com mais de 15 dias (chamado de vez em quando pelo
  // app — ex.: toda vez que o gerente abre a aba Mapa — já que o modo demo
  // não tem um cron de verdade rodando sozinho em segundo plano; ver
  // supabase/schema.sql pra a limpeza automática via pg_cron no banco real).
  if (nome === "rotecheck_limpar_prints_antigos") {
    const limite = Date.now() - DIAS_RETENCAO_PRINTS * 24 * 3600 * 1000;
    const antes = TABELAS.prints_rotas.length;
    for (let i = TABELAS.prints_rotas.length - 1; i >= 0; i--) {
      if (new Date(TABELAS.prints_rotas[i].criado_em).getTime() < limite) {
        TABELAS.prints_rotas.splice(i, 1);
      }
    }
    if (TABELAS.prints_rotas.length !== antes) persistirDados();
    return { data: null, error: null };
  }

  // Cria a solicitação já casando com o cliente pelo CNPJ (mesma coisa que
  // a função rotecheck_criar_solicitacao_usuario faz no banco de verdade —
  // ver supabase/schema.sql) e devolve só o id criado.
  if (nome === "rotecheck_criar_solicitacao_usuario") {
    const perfilEncontrado = TABELAS.perfis.find((p) => p.papel === "cliente" && p.cnpj === params?.p_cnpj);
    const linha = {
      id: novoId("solicitacao"),
      cnpj: params?.p_cnpj,
      estabelecimento: params?.p_estabelecimento,
      perfil_id: perfilEncontrado?.id || null,
      status: "pendente",
      criado_em: new Date().toISOString(),
    };
    TABELAS.solicitacoes_usuario.push(linha);
    persistirDados();
    return { data: linha.id, error: null };
  }

  // Lê só os campos que a tela de acompanhamento precisa, de uma
  // solicitação específica (mesma coisa que rotecheck_ler_solicitacao_usuario
  // faz no banco de verdade).
  if (nome === "rotecheck_ler_solicitacao_usuario") {
    const s = TABELAS.solicitacoes_usuario.find((s) => s.id === params?.p_id);
    if (!s) return { data: null, error: null };
    return {
      data: { id: s.id, cnpj: s.cnpj, estabelecimento: s.estabelecimento, status: s.status, novo_login: s.novo_login || null },
      error: null,
    };
  }

  // Troca o "usuário" (login) de quem teve a solicitação de recuperação
  // aceita (ver RecuperarUsuario.jsx / AbaSolicitacoesUsuario.jsx) — mexe
  // direto no registro de credenciais (equivalente ao auth.users do banco
  // de verdade), que não é uma tabela normal, por isso é RPC e não um
  // update comum em "perfis".
  if (nome === "rotecheck_trocar_login") {
    const solicitacao = TABELAS.solicitacoes_usuario.find((s) => s.id === params?.p_solicitacao_id);
    if (!solicitacao) {
      return { data: null, error: { message: "Solicitação não encontrada." } };
    }
    if (solicitacao.status !== "aceita") {
      return { data: null, error: { message: "Essa solicitação ainda não foi aceita por ninguém da equipe." } };
    }
    if (solicitacao.novo_login) {
      return { data: null, error: { message: "O usuário dessa solicitação já foi trocado." } };
    }
    const novoLogin = (params?.p_novo_login || "").trim();
    if (!novoLogin.includes("@")) {
      return { data: null, error: { message: "Digite um e-mail válido." } };
    }
    if (usuarios.has(novoLogin)) {
      return { data: null, error: { message: "Esse e-mail já está em uso por outra conta." } };
    }
    const perfil = TABELAS.perfis.find((p) => p.id === solicitacao.perfil_id);
    if (!perfil) {
      return { data: null, error: { message: "Não achamos a conta ligada a essa solicitação." } };
    }
    const credencial = usuarios.get(perfil.email);
    if (!credencial) {
      return { data: null, error: { message: "Não achamos as credenciais dessa conta." } };
    }
    usuarios.delete(perfil.email);
    usuarios.set(novoLogin, credencial);
    perfil.email = novoLogin;
    solicitacao.novo_login = novoLogin;
    solicitacao.concluido_em = new Date().toISOString();
    persistirDados();
    return { data: { novo_login: novoLogin }, error: null };
  }

  return { data: null, error: { message: `RPC "${nome}" não implementada no modo demo.` } };
}

export function criarClienteDemo() {
  return {
    auth,
    from(nomeTabela) {
      return new MockQuery(nomeTabela);
    },
    rpc,
    storage,
    channel() {
      return canalFalso();
    },
    removeChannel() {},
  };
}
