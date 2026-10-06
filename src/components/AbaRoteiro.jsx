import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth.jsx";
import { parseRoteiroPlanilha } from "../lib/planilhaRoteiro.js";
import StatusBadge from "./StatusBadge.jsx";

// Aba "Roteiro" — usada tanto pelo despachante quanto pelo gerente. Mostra
// o roteiro fixo da semana (segunda a sábado): pra cada coletor, as saídas
// do dia com horário, veículo e a ordem das paradas — tudo isso já vem
// definido de antemão (da planilha, ou cadastrado aqui), então ninguém
// escolhe coletor/veículo na operação do dia a dia. Também tem o "espaço
// pra alteração" que o Felipe pediu: adicionar, editar e remover paradas
// fixas, sempre disponível tanto pro despachante quanto pro gerente.

// Sábado tirado do roteiro fixo — quase não tem coleta nesse dia, não
// compensa manter uma rota inteira pra ele. Se algum cliente pedir coleta
// num sábado, isso continua funcionando normal (é por demanda, não passa
// por aqui).
const DIAS = [
  { valor: 1, label: "Segunda" },
  { valor: 2, label: "Terça" },
  { valor: 3, label: "Quarta" },
  { valor: 4, label: "Quinta" },
  { valor: 5, label: "Sexta" },
];

const LABEL_VEICULO = { CARRO: "Carro", MOTO: "Moto" };
const VEICULOS = ["CARRO", "MOTO"];

function hojeDiaSemana() {
  const d = new Date().getDay(); // 0=domingo...6=sábado
  return d === 0 || d === 6 ? 1 : d; // domingo e sábado não têm roteiro fixo — cai em segunda por padrão
}

// Diferente de hojeDiaSemana() acima (que "empresta" segunda-feira no fim
// de semana só pra escolher a aba inicial) — este aqui serve pra saber se
// a aba selecionada é mesmo o dia de hoje de verdade, pra decidir se
// mostra as coletas por demanda e as marcações de "sem coleta hoje" (que
// só fazem sentido pro dia atual, nunca pra outro dia da semana olhado só
// de referência).
function diaSemanaReal() {
  return new Date().getDay(); // 0=domingo...6=sábado
}

// Mesmo formato "AAAA-MM-DD" em horário local usado em ColetorHome.jsx —
// precisa ser o idêntico, porque é o que casa com a coluna `data` de
// confirmacoes_parada_fixa que o coletor grava.
function dataLocalHojeISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

const PARADA_VAZIA = {
  coletor_id: "",
  nome: "",
  endereco: "",
  base: "AGF RIO BRANCO",
  saida_numero: 1,
  horario_saida: "",
  veiculo: "CARRO",
  dias_semana: [],
  ordem: 1,
};

export default function AbaRoteiro() {
  const { perfil } = useAuth();
  const [dia, setDia] = useState(hojeDiaSemana());
  const [paradas, setParadas] = useState([]);
  const [coletores, setColetores] = useState([]);
  const [coletorSelecionado, setColetorSelecionado] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [editando, setEditando] = useState(false);

  // A aba de dia selecionada é mesmo hoje? Só nesse caso mostra as coletas
  // por demanda de hoje e as marcações de "sem coleta hoje" — nos outros
  // dias (olhando o roteiro fixo de referência) esses dois não existem.
  const estaVendoHoje = dia === diaSemanaReal();

  // Coletas por demanda de hoje do coletor selecionado, na mesma ordem da
  // rota definida (aba "Rotas") — igual ao que o próprio coletor vê em
  // ColetorHome.jsx, só que aqui é o despachante/gerente acompanhando.
  const [coletasHoje, setColetasHoje] = useState([]);
  const [carregandoColetasHoje, setCarregandoColetasHoje] = useState(false);

  useEffect(() => {
    if (!estaVendoHoje || !coletorSelecionado) {
      setColetasHoje([]);
      return;
    }
    async function carregarColetasHoje() {
      setCarregandoColetasHoje(true);
      const inicioDia = new Date();
      inicioDia.setHours(0, 0, 0, 0);
      const { data: coletasDoDia } = await supabase
        .from("coletas")
        .select("*, cliente:cliente_id(nome, estabelecimento)")
        .eq("coletor_id", coletorSelecionado)
        .gte("criado_em", inicioDia.toISOString())
        .order("horario_solicitado", { ascending: true });
      const { data: rotas } = await supabase.from("rotas").select("*").eq("coletor_id", coletorSelecionado);
      const rota = rotas?.[0] || null;
      const lista = coletasDoDia || [];
      if (rota?.coletas_ordem?.length) {
        const ordem = rota.coletas_ordem;
        const ordenadas = [...lista].sort((a, b) => {
          const ia = ordem.indexOf(a.id);
          const ib = ordem.indexOf(b.id);
          if (ia === -1 && ib === -1) return 0;
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });
        setColetasHoje(ordenadas);
      } else {
        setColetasHoje(lista);
      }
      setCarregandoColetasHoje(false);
    }
    carregarColetasHoje();

    const canal = supabase
      .channel(`roteiro-coletas-hoje-${coletorSelecionado}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "coletas" }, carregarColetasHoje)
      .subscribe();

    return () => supabase.removeChannel(canal);
  }, [coletorSelecionado, estaVendoHoje]);

  // Confirmações de hoje do roteiro fixo (confirmada, ou "sem coleta
  // hoje") do coletor selecionado — vem da mesma tabela que o coletor usa
  // em ColetorHome.jsx, agora também gravável por aqui (despachante e
  // gerente podem marcar "sem coleta hoje" sem precisar o coletor passar
  // no local pra constatar).
  const [confirmacoesHoje, setConfirmacoesHoje] = useState([]);
  const [marcandoId, setMarcandoId] = useState(null);

  async function carregarConfirmacoesHoje() {
    if (!coletorSelecionado) {
      setConfirmacoesHoje([]);
      return;
    }
    const { data } = await supabase
      .from("confirmacoes_parada_fixa")
      .select("*")
      .eq("coletor_id", coletorSelecionado)
      .eq("data", dataLocalHojeISO());
    setConfirmacoesHoje(data || []);
  }

  useEffect(() => {
    if (!estaVendoHoje || !coletorSelecionado) {
      setConfirmacoesHoje([]);
      return;
    }
    carregarConfirmacoesHoje();

    const canal = supabase
      .channel(`roteiro-confirmacoes-hoje-${coletorSelecionado}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "confirmacoes_parada_fixa" }, carregarConfirmacoesHoje)
      .subscribe();

    return () => supabase.removeChannel(canal);
  }, [coletorSelecionado, estaVendoHoje]);

  const confirmacaoPorParadaId = new Map(confirmacoesHoje.map((c) => [c.parada_fixa_id, c]));

  // Despachante/gerente marcando que uma parada fixa não teve coleta hoje
  // — sem precisar de foto (eles não estão no local; quem traz a foto como
  // prova é o coletor, na hora, ver marcarParadaFixaClienteAusente em
  // ColetorHome.jsx). marcado_por grava quem decidiu isso, pra avisar o
  // coletor que não foi ele quem marcou (ver "marcado pela equipe" lá).
  async function marcarSemColetaHoje(parada) {
    setMarcandoId(parada.id);
    const dados = {
      parada_fixa_id: parada.id,
      coletor_id: parada.coletor_id,
      data: dataLocalHojeISO(),
      foto_url: null,
      cliente_ausente: true,
      marcado_por: perfil?.id || null,
    };
    const { data: inserida, error } = await supabase.from("confirmacoes_parada_fixa").insert(dados).select();
    if (!error) {
      setConfirmacoesHoje((atual) => [...atual, inserida?.[0] || dados]);
    }
    setMarcandoId(null);
  }

  // Desfaz uma marcação de hoje (confirmada ou "sem coleta hoje") — serve
  // tanto pra corrigir uma marcação feita por engano aqui quanto pra abrir
  // de novo uma parada que o próprio coletor já tinha confirmado.
  async function desfazerConfirmacaoHoje(parada) {
    setMarcandoId(parada.id);
    await supabase
      .from("confirmacoes_parada_fixa")
      .delete()
      .eq("parada_fixa_id", parada.id)
      .eq("data", dataLocalHojeISO());
    setConfirmacoesHoje((atual) => atual.filter((c) => c.parada_fixa_id !== parada.id));
    setMarcandoId(null);
  }

  const [form, setForm] = useState(PARADA_VAZIA);
  const [erroForm, setErroForm] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [rascunho, setRascunho] = useState({});
  const [salvandoId, setSalvandoId] = useState(null);
  const [removendoId, setRemovendoId] = useState(null);

  // Atualizar o roteiro inteiro subindo a planilha "ROTEIRO ATUALIZADO" de
  // novo (em vez de editar parada por parada aqui na tela). Lê o arquivo
  // no próprio navegador, mostra um resumo do que vai mudar, e só grava no
  // banco depois que despachante/gerente confirmar — pra não trocar o
  // roteiro inteiro sem querer com o arquivo errado.
  const inputPlanilhaRef = useRef(null);
  const [analisandoPlanilha, setAnalisandoPlanilha] = useState(false);
  const [erroPlanilha, setErroPlanilha] = useState("");
  const [analisePlanilha, setAnalisePlanilha] = useState(null); // { porColetor, naoEncontrados, totalParadas }
  const [aplicandoPlanilha, setAplicandoPlanilha] = useState(false);
  const [mensagemPlanilha, setMensagemPlanilha] = useState("");

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from("paradas_fixas")
      .select("*, coletor:coletor_id(nome)")
      .eq("ativa", true);
    setParadas(data || []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    async function carregarColetores() {
      const { data } = await supabase.from("perfis").select("id, nome").eq("papel", "coletor").eq("aprovado", true);
      const lista = (data || []).slice().sort((a, b) => a.nome.localeCompare(b.nome));
      setColetores(lista);
      // Escolhe o primeiro coletor automaticamente — cada um tem sua
      // própria aba aqui dentro, em vez de mostrar todo mundo junto como
      // vinha na planilha.
      setColetorSelecionado((atual) => atual || lista[0]?.id || "");
    }
    carregarColetores();
  }, []);

  const paradasDoDia = paradas.filter((p) => (p.dias_semana || []).includes(dia) && p.coletor_id === coletorSelecionado);

  function normalizarNome(nome) {
    return (nome || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, ""); // tira acento, pra "Júlio" bater com "JÚLIO"/"JULIO"
  }

  async function handleArquivoPlanilha(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErroPlanilha("");
    setAnalisePlanilha(null);
    setMensagemPlanilha("");
    setAnalisandoPlanilha(true);

    try {
      const buffer = await arquivo.arrayBuffer();
      const { paradas: paradasPlanilha, erro } = parseRoteiroPlanilha(buffer);
      if (erro) {
        setErroPlanilha(erro);
        return;
      }

      // Casa o nome do coletor como está escrito na planilha (ex.: "RONALD")
      // com quem já está cadastrado no sistema (ex.: "Ronald").
      const porColetor = new Map(); // coletorId -> { nome, paradas: [] }
      const naoEncontrados = new Map(); // nomePlanilha -> quantidade

      for (const p of paradasPlanilha) {
        const coletor = coletores.find((c) => normalizarNome(c.nome) === normalizarNome(p.coletorPlanilha));
        if (!coletor) {
          naoEncontrados.set(p.coletorPlanilha, (naoEncontrados.get(p.coletorPlanilha) || 0) + 1);
          continue;
        }
        if (!porColetor.has(coletor.id)) porColetor.set(coletor.id, { nome: coletor.nome, paradas: [] });
        porColetor.get(coletor.id).paradas.push(p);
      }

      if (porColetor.size === 0) {
        setErroPlanilha(
          "Nenhum coletor da planilha bate com os coletores já cadastrados no sistema — confirma se é a planilha certa."
        );
        return;
      }

      setAnalisePlanilha({
        porColetor: [...porColetor.entries()].map(([coletorId, v]) => ({ coletorId, nome: v.nome, paradas: v.paradas })),
        naoEncontrados: [...naoEncontrados.entries()].map(([nome, quantidade]) => ({ nome, quantidade })),
        totalParadas: paradasPlanilha.length,
      });
    } catch (err) {
      setErroPlanilha("Não consegui ler esse arquivo. Confirma que é o .xlsx exportado do Excel e tenta de novo.");
    } finally {
      setAnalisandoPlanilha(false);
    }
  }

  function cancelarPlanilha() {
    setAnalisePlanilha(null);
    setErroPlanilha("");
    if (inputPlanilhaRef.current) inputPlanilhaRef.current.value = "";
  }

  async function confirmarPlanilha() {
    if (!analisePlanilha) return;
    setAplicandoPlanilha(true);
    setErroPlanilha("");

    try {
      // Substitui o roteiro fixo só dos coletores que apareceram na
      // planilha — quem não apareceu (ex.: um coletor novo sem rota ainda
      // na planilha) mantém o que já tinha. Vai tudo numa função do banco
      // só (apaga + insere numa transação única), pra nunca ficar pela
      // metade se der erro no meio.
      const idsColetores = analisePlanilha.porColetor.map((g) => g.coletorId);

      const paradasParaInserir = analisePlanilha.porColetor.flatMap((g) =>
        g.paradas.map((p) => ({
          coletor_id: g.coletorId,
          base: p.base,
          saida_numero: p.saida_numero,
          horario_saida: p.horario_saida,
          veiculo: p.veiculo,
          nome: p.nome,
          endereco: p.endereco,
          dias_semana: p.dias_semana,
          ordem: p.ordem,
        }))
      );

      const { error: erroRpc } = await supabase.rpc("rotecheck_atualizar_roteiro", {
        p_coletores_ids: idsColetores,
        p_paradas: paradasParaInserir,
      });
      if (erroRpc) throw erroRpc;

      setMensagemPlanilha(
        `Roteiro atualizado: ${paradasParaInserir.length} paradas fixas, em ${analisePlanilha.porColetor.length} coletor(es).`
      );
      setAnalisePlanilha(null);
      if (inputPlanilhaRef.current) inputPlanilhaRef.current.value = "";
      carregar();
    } catch (err) {
      setErroPlanilha(err.message || "Não consegui salvar o roteiro novo. Nada foi alterado, pode tentar de novo.");
    } finally {
      setAplicandoPlanilha(false);
    }
  }

  // Agrupa por saída — a aba já filtrou pra um único coletor.
  const porColetor = {};
  for (const p of paradasDoDia) {
    const chave = p.coletor_id;
    if (!porColetor[chave]) {
      porColetor[chave] = { nome: p.coletor?.nome || "Coletor removido", saidas: {} };
    }
    const saidaChave = p.saida_numero ?? 1;
    if (!porColetor[chave].saidas[saidaChave]) {
      porColetor[chave].saidas[saidaChave] = { horario: p.horario_saida, veiculo: p.veiculo, paradas: [] };
    }
    porColetor[chave].saidas[saidaChave].paradas.push(p);
  }
  const gruposColetor = Object.entries(porColetor)
    .map(([id, grupo]) => ({
      id,
      nome: grupo.nome,
      saidas: Object.entries(grupo.saidas)
        .map(([numero, s]) => ({ numero: Number(numero), ...s, paradas: [...s.paradas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)) }))
        .sort((a, b) => a.numero - b.numero),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // Quantas paradas fixas de hoje já foram marcadas "sem coleta hoje" —
  // contador simples pra despachante/gerente verem de relance sem precisar
  // abrir parada por parada.
  const semColetaHojeCount = estaVendoHoje
    ? paradasDoDia.filter((p) => confirmacaoPorParadaId.get(p.id)?.cliente_ausente).length
    : 0;

  function toggleDiaForm(valorDia) {
    setForm((f) => {
      const tem = f.dias_semana.includes(valorDia);
      return {
        ...f,
        dias_semana: tem ? f.dias_semana.filter((d) => d !== valorDia) : [...f.dias_semana, valorDia].sort((a, b) => a - b),
      };
    });
  }

  async function adicionarParada(e) {
    e.preventDefault();
    setErroForm("");
    if (!form.coletor_id) return setErroForm("Escolha o coletor.");
    if (!form.nome.trim()) return setErroForm("Informe o nome do lugar.");
    if (!form.endereco.trim()) return setErroForm("Informe o endereço.");
    if (form.dias_semana.length === 0) return setErroForm("Escolha pelo menos um dia da semana.");

    setEnviando(true);
    const { error } = await supabase.from("paradas_fixas").insert({
      coletor_id: form.coletor_id,
      nome: form.nome.trim(),
      endereco: form.endereco.trim(),
      base: form.base.trim() || "AGF RIO BRANCO",
      saida_numero: Number(form.saida_numero) || 1,
      horario_saida: form.horario_saida || null,
      veiculo: form.veiculo,
      dias_semana: form.dias_semana,
      ordem: Number(form.ordem) || 1,
      ativa: true,
    });
    setEnviando(false);
    if (error) return setErroForm(error.message || "Não foi possível salvar.");
    setForm(PARADA_VAZIA);
    carregar();
  }

  function iniciarEdicao(parada) {
    setEditandoId(parada.id);
    setRascunho((r) => ({
      ...r,
      [parada.id]: {
        nome: parada.nome,
        endereco: parada.endereco,
        coletor_id: parada.coletor_id,
        saida_numero: parada.saida_numero,
        horario_saida: parada.horario_saida || "",
        veiculo: parada.veiculo,
        dias_semana: parada.dias_semana || [],
        ordem: parada.ordem,
      },
    }));
  }

  function editarCampo(id, campo, valor) {
    setRascunho((r) => ({ ...r, [id]: { ...r[id], [campo]: valor } }));
  }

  function toggleDiaEdicao(id, valorDia) {
    setRascunho((r) => {
      const atual = r[id]?.dias_semana || [];
      const tem = atual.includes(valorDia);
      const novo = tem ? atual.filter((d) => d !== valorDia) : [...atual, valorDia].sort((a, b) => a - b);
      return { ...r, [id]: { ...r[id], dias_semana: novo } };
    });
  }

  async function salvarEdicao(id) {
    const dados = rascunho[id];
    if (!dados) return;
    setSalvandoId(id);
    await supabase
      .from("paradas_fixas")
      .update({
        nome: dados.nome.trim(),
        endereco: dados.endereco.trim(),
        coletor_id: dados.coletor_id,
        saida_numero: Number(dados.saida_numero) || 1,
        horario_saida: dados.horario_saida || null,
        veiculo: dados.veiculo,
        dias_semana: dados.dias_semana,
        ordem: Number(dados.ordem) || 1,
      })
      .eq("id", id);
    setSalvandoId(null);
    setEditandoId(null);
    carregar();
  }

  async function removerParada(id) {
    if (!window.confirm("Remover essa parada do roteiro fixo?")) return;
    setRemovendoId(id);
    await supabase.from("paradas_fixas").delete().eq("id", id);
    setRemovendoId(null);
    carregar();
  }

  return (
    <>
      <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 12 }}>
        Roteiro fixo da semana: cada lugar já tem o coletor e o veículo definidos — ninguém escolhe isso no dia a
        dia. As paradas marcadas <strong>Diária</strong> vêm do roteiro fixo; quando o dia visto é hoje, as coletas{" "}
        <strong>Por demanda</strong> já aceitas também aparecem junto, na mesma ordem da rota.
      </p>

      <div className="tabs">
        {DIAS.map((d) => (
          <button key={d.valor} className={`tab ${dia === d.valor ? "active" : ""}`} onClick={() => setDia(d.valor)}>
            {d.label}
          </button>
        ))}
      </div>

      {estaVendoHoje && semColetaHojeCount > 0 && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>
          {semColetaHojeCount} parada{semColetaHojeCount > 1 ? "s" : ""} fixa{semColetaHojeCount > 1 ? "s" : ""} sem
          coleta hoje.
        </p>
      )}

      {coletores.length === 0 && !carregando && (
        <p style={{ color: "var(--text-dim)" }}>Nenhum coletor cadastrado ainda.</p>
      )}
      {coletores.length > 0 && (
        <div className="tabs">
          {coletores.map((c) => (
            <button
              key={c.id}
              className={`tab ${coletorSelecionado === c.id ? "active" : ""}`}
              onClick={() => setColetorSelecionado(c.id)}
            >
              {c.nome}
            </button>
          ))}
        </div>
      )}

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        <strong>Atualizar roteiro por planilha</strong>
        <p style={{ color: "var(--text-dim)", fontSize: 13, margin: 0 }}>
          Sobe a planilha "ROTEIRO ATUALIZADO" (aba MATRIZ) de novo pra substituir as paradas fixas dos coletores que
          aparecem nela — o resto do sistema não muda.
        </p>
        <input
          ref={inputPlanilhaRef}
          type="file"
          accept=".xlsx"
          onChange={handleArquivoPlanilha}
          disabled={analisandoPlanilha || aplicandoPlanilha}
        />

        {analisandoPlanilha && <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Lendo a planilha...</p>}
        {erroPlanilha && <p className="erro-campo">{erroPlanilha}</p>}
        {mensagemPlanilha && <p style={{ color: "var(--sucesso, #2e7d32)", fontSize: 13 }}>{mensagemPlanilha}</p>}

        {analisePlanilha && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--borda, rgba(0,0,0,0.1))", paddingTop: 10 }}>
            <p style={{ fontSize: 13, margin: 0 }}>
              Isso vai <strong>substituir</strong> o roteiro fixo de:
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
              {analisePlanilha.porColetor.map((g) => (
                <li key={g.coletorId}>
                  {g.nome}: {g.paradas.length} parada(s)
                </li>
              ))}
            </ul>
            {analisePlanilha.naoEncontrados.length > 0 && (
              <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>
                Não achei no sistema (foram ignorados):{" "}
                {analisePlanilha.naoEncontrados.map((n) => `${n.nome} (${n.quantidade})`).join(", ")}
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-primary" disabled={aplicandoPlanilha} onClick={confirmarPlanilha}>
                {aplicandoPlanilha ? "Salvando..." : "Confirmar atualização"}
              </button>
              <button type="button" className="btn btn-secondary" disabled={aplicandoPlanilha} onClick={cancelarPlanilha}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn btn-secondary"
        style={{ marginBottom: 14 }}
        onClick={() => {
          setEditando((e) => !e);
          setForm((f) => (f.coletor_id ? f : { ...f, coletor_id: coletorSelecionado }));
        }}
      >
        {editando ? "Fechar edição" : "Editar rotas e paradas"}
      </button>

      {editando && (
        <form onSubmit={adicionarParada} className="card" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <strong>Adicionar parada fixa</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 180px", margin: 0 }}>
              <label>Coletor</label>
              <select value={form.coletor_id} onChange={(e) => setForm((f) => ({ ...f, coletor_id: e.target.value }))}>
                <option value="">Escolher coletor...</option>
                {coletores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: "1 1 180px", margin: 0 }}>
              <label>Veículo</label>
              <select value={form.veiculo} onChange={(e) => setForm((f) => ({ ...f, veiculo: e.target.value }))}>
                {VEICULOS.map((v) => (
                  <option key={v} value={v}>
                    {LABEL_VEICULO[v]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label>Nome do lugar</label>
            <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Papelaria Ferreira" />
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label>Endereço</label>
            <input value={form.endereco} onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))} placeholder="Rua e número" />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 140px", margin: 0 }}>
              <label>Nº da saída</label>
              <input type="number" min={1} value={form.saida_numero} onChange={(e) => setForm((f) => ({ ...f, saida_numero: e.target.value }))} />
            </div>
            <div className="field" style={{ flex: "1 1 140px", margin: 0 }}>
              <label>Horário da saída</label>
              <input type="time" value={form.horario_saida} onChange={(e) => setForm((f) => ({ ...f, horario_saida: e.target.value }))} />
            </div>
            <div className="field" style={{ flex: "1 1 140px", margin: 0 }}>
              <label>Ordem na saída</label>
              <input type="number" min={1} value={form.ordem} onChange={(e) => setForm((f) => ({ ...f, ordem: e.target.value }))} />
            </div>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label>Dias da semana</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {DIAS.map((d) => (
                <label key={d.valor} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: "normal" }}>
                  <input type="checkbox" checked={form.dias_semana.includes(d.valor)} onChange={() => toggleDiaForm(d.valor)} />
                  {d.label}
                </label>
              ))}
            </div>
          </div>

          {erroForm && <p className="erro-campo">{erroForm}</p>}
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? "Salvando..." : "Adicionar ao roteiro"}
          </button>
        </form>
      )}

      {carregando && <p style={{ color: "var(--text-dim)" }}>Carregando...</p>}
      {!carregando && coletorSelecionado && gruposColetor.length === 0 && (
        <p style={{ color: "var(--text-dim)" }}>Esse coletor não tem nenhuma parada fixa cadastrada para esse dia.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {gruposColetor.map((grupo) => (
          <div key={grupo.id} className="card">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {grupo.saidas.map((saida) => (
                <div key={saida.numero}>
                  <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 6px" }}>
                    {saida.numero}ª saída{saida.horario ? ` · ${saida.horario}` : ""} · {LABEL_VEICULO[saida.veiculo] || saida.veiculo}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {saida.paradas.map((p) => {
                      const emEdicao = editandoId === p.id;
                      const dadosEdicao = rascunho[p.id];
                      if (emEdicao && dadosEdicao) {
                        return (
                          <div key={p.id} className="card" style={{ background: "var(--bg-elevado, rgba(0,0,0,0.03))" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <div className="field" style={{ margin: 0 }}>
                                <label>Coletor</label>
                                <select value={dadosEdicao.coletor_id} onChange={(e) => editarCampo(p.id, "coletor_id", e.target.value)}>
                                  {coletores.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.nome}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="field" style={{ margin: 0 }}>
                                <label>Nome</label>
                                <input value={dadosEdicao.nome} onChange={(e) => editarCampo(p.id, "nome", e.target.value)} />
                              </div>
                              <div className="field" style={{ margin: 0 }}>
                                <label>Endereço</label>
                                <input value={dadosEdicao.endereco} onChange={(e) => editarCampo(p.id, "endereco", e.target.value)} />
                              </div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <div className="field" style={{ flex: "1 1 120px", margin: 0 }}>
                                  <label>Veículo</label>
                                  <select value={dadosEdicao.veiculo} onChange={(e) => editarCampo(p.id, "veiculo", e.target.value)}>
                                    {VEICULOS.map((v) => (
                                      <option key={v} value={v}>
                                        {LABEL_VEICULO[v]}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="field" style={{ flex: "1 1 100px", margin: 0 }}>
                                  <label>Nº saída</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={dadosEdicao.saida_numero}
                                    onChange={(e) => editarCampo(p.id, "saida_numero", e.target.value)}
                                  />
                                </div>
                                <div className="field" style={{ flex: "1 1 120px", margin: 0 }}>
                                  <label>Horário</label>
                                  <input
                                    type="time"
                                    value={dadosEdicao.horario_saida}
                                    onChange={(e) => editarCampo(p.id, "horario_saida", e.target.value)}
                                  />
                                </div>
                                <div className="field" style={{ flex: "1 1 100px", margin: 0 }}>
                                  <label>Ordem</label>
                                  <input type="number" min={1} value={dadosEdicao.ordem} onChange={(e) => editarCampo(p.id, "ordem", e.target.value)} />
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                {DIAS.map((d) => (
                                  <label key={d.valor} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: "normal" }}>
                                    <input
                                      type="checkbox"
                                      checked={dadosEdicao.dias_semana.includes(d.valor)}
                                      onChange={() => toggleDiaEdicao(p.id, d.valor)}
                                    />
                                    {d.label}
                                  </label>
                                ))}
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  style={{ flex: 1 }}
                                  disabled={salvandoId === p.id}
                                  onClick={() => salvarEdicao(p.id)}
                                >
                                  {salvandoId === p.id ? "Salvando..." : "Salvar"}
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={() => setEditandoId(null)}>
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      const confirmacao = confirmacaoPorParadaId.get(p.id);
                      const confirmada = !!confirmacao;
                      const semColetaHoje = !!confirmacao?.cliente_ausente;
                      return (
                        <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span className="badge-papel">{p.ordem}ª</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <strong style={{ overflowWrap: "anywhere" }}>{p.nome}</strong>
                                <span className="badge-papel" style={{ fontSize: 11 }}>Diária</span>
                              </div>
                              <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "2px 0 0" }}>{p.endereco}</p>
                            </div>
                            {estaVendoHoje && (
                              <StatusBadge
                                status={!confirmada ? "pendente" : semColetaHoje ? "recusada" : "coletada"}
                                label={!confirmada ? "Pendente hoje" : semColetaHoje ? "Sem coleta hoje" : "Confirmada"}
                              />
                            )}
                            {editando && (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button type="button" className="btn btn-secondary" style={{ padding: "4px 10px" }} onClick={() => iniciarEdicao(p)}>
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  style={{ padding: "4px 10px" }}
                                  disabled={removendoId === p.id}
                                  onClick={() => removerParada(p.id)}
                                >
                                  {removendoId === p.id ? "..." : "Remover"}
                                </button>
                              </div>
                            )}
                          </div>
                          {estaVendoHoje && (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: 34 }}>
                              {!confirmada && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: "4px 10px", fontSize: 13 }}
                                  disabled={marcandoId === p.id}
                                  onClick={() => marcarSemColetaHoje(p)}
                                >
                                  {marcandoId === p.id ? "Marcando..." : "Marcar sem coleta hoje"}
                                </button>
                              )}
                              {confirmada && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: "4px 10px", fontSize: 13 }}
                                  disabled={marcandoId === p.id}
                                  onClick={() => desfazerConfirmacaoHoje(p)}
                                >
                                  {marcandoId === p.id ? "Desfazendo..." : "Desfazer marcação de hoje"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Fora do map de gruposColetor de propósito: um coletor pode ter
          coleta por demanda aceita hoje mesmo sem nenhuma parada fixa
          cadastrada pra esse dia da semana (gruposColetor viria vazio nesse
          caso) — então essa seção não pode depender de existir grupo. */}
      {estaVendoHoje && coletorSelecionado && (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 10px" }}>Coletas por demanda de hoje</p>
          {carregandoColetasHoje && <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Carregando...</p>}
          {!carregandoColetasHoje && coletasHoje.length === 0 && (
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Nenhuma coleta por demanda aceita pra hoje.</p>
          )}
          {coletasHoje.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {coletasHoje.map((coleta, indice) => (
                <div key={coleta.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="badge-papel">{indice + 1}ª</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <strong style={{ overflowWrap: "anywhere" }}>{coleta.local}</strong>
                      <span className="badge-papel" style={{ fontSize: 11 }}>Por demanda</span>
                    </div>
                    <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "2px 0 0" }}>
                      {coleta.cliente?.estabelecimento || coleta.cliente?.nome}
                    </p>
                  </div>
                  <StatusBadge status={coleta.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
