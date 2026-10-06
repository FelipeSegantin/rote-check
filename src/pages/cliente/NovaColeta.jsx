import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth.jsx";
import { casarClienteEsperado } from "../../lib/clientesEsperados.js";
import { calcularJanelaPedido } from "../../lib/janelaPedido.js";

// Veículo, horário e tipo de produto não são mais escolhidos pelo cliente
// — isso passou a vir do roteiro que o despachante/gerente já monta pra
// cada coletor (ver aba "Rotas"), então o cliente só pede a coleta e o
// encaixe (com qual coletor, veículo e horário) acontece do lado de lá.
export default function NovaColeta() {
  const { perfil } = useAuth();
  const navigate = useNavigate();

  // O endereço do cliente vem pré-preenchido com o que foi cadastrado
  // (nome do estabelecimento + endereço), então normalmente não precisa
  // digitar nada — mas o campo continua editável, caso essa coleta em
  // especial seja em outro lugar. Só preenche sozinho até a pessoa mexer
  // no campo (não sobrescreve o que ela já editou quando o perfil termina
  // de carregar).
  const [local, setLocal] = useState("");
  const [localEditadoManualmente, setLocalEditadoManualmente] = useState(false);

  useEffect(() => {
    if (localEditadoManualmente || !perfil) return;
    setLocal([perfil.estabelecimento, perfil.endereco].filter(Boolean).join(" — "));
  }, [perfil, localEditadoManualmente]);

  function atualizarLocal(valor) {
    setLocal(valor);
    setLocalEditadoManualmente(true);
  }

  const [observacao, setObservacao] = useState("");
  const [foto, setFoto] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  // Avisa quando o veículo que normalmente atende esse estabelecimento é
  // moto — caixa grande não cabe. Primeiro tenta casar com certeza pelo
  // CNPJ do cadastro (mais confiável — não depende de ter digitado o nome
  // do estabelecimento igualzinho ao da planilha); se o cliente não tem
  // CNPJ cadastrado ou nenhum da planilha bate, cai pro jeito antigo: casa
  // pelo nome do estabelecimento. Se nem isso bater, não mostra aviso.
  const [veiculoEsperado, setVeiculoEsperado] = useState(null);
  const [confirmouAvisoMoto, setConfirmouAvisoMoto] = useState(false);

  // Prazo pra pedir coleta com base na saída do roteiro fixo do coletor que
  // atende esse cliente (ver janelaPedido.js): cada saída (ex.: 13:45,
  // 15:00, 15:30...) aceita pedido novo até o próprio horário dela — depois
  // disso, o pedido passa a mirar a saída seguinte. Quem não tem rota
  // conhecida (não bateu com a planilha) segue sem essa restrição, igual
  // sempre foi.
  const [janelaPedido, setJanelaPedido] = useState({ temRota: false });

  // Casa o cliente com clientes_esperados (pra saber o veículo esperado e o
  // coletor_id) e, achando o coletor, busca as saídas do roteiro fixo dele
  // pra calcular a janela de pedido — usada tanto pra mostrar o aviso na
  // tela quanto (chamada de novo, com o relógio na hora) pra travar o
  // envio de verdade em handleSubmit.
  async function buscarClienteEJanela() {
    if (!perfil?.estabelecimento && !perfil?.cnpj) {
      return { veiculo: null, janela: { temRota: false } };
    }
    const { data: esperados } = await supabase.from("clientes_esperados").select("nome, veiculo, cnpj, coletor_id");
    const achado = casarClienteEsperado(perfil, esperados || []);
    if (!achado?.coletor_id) {
      return { veiculo: achado?.veiculo || null, janela: { temRota: false } };
    }
    const { data: paradas } = await supabase
      .from("paradas_fixas")
      .select("saida_numero, horario_saida, dias_semana")
      .eq("coletor_id", achado.coletor_id);
    return { veiculo: achado.veiculo || null, janela: calcularJanelaPedido(paradas || []) };
  }

  useEffect(() => {
    let ativo = true;
    buscarClienteEJanela().then(({ veiculo, janela }) => {
      if (!ativo) return;
      setVeiculoEsperado(veiculo);
      setJanelaPedido(janela);
    });
    return () => {
      ativo = false;
    };
  }, [perfil?.estabelecimento, perfil?.cnpj]);

  const precisaConfirmarMoto = veiculoEsperado === "MOTO";
  const pedidoFechadoPorHorario = janelaPedido.temRota && janelaPedido.disponivel === false;

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");

    if (!local.trim()) {
      setErro("Informe o local da coleta.");
      return;
    }

    if (precisaConfirmarMoto && !confirmouAvisoMoto) {
      setErro("Marque a confirmação do aviso sobre a moto antes de enviar.");
      return;
    }

    setEnviando(true);

    // Confere de novo, na hora de enviar (não só o que já estava na tela)
    // — evita pedir depois do prazo se a pessoa ficou com a tela aberta e
    // só apertou "Confirmar" depois que o horário virou.
    const { janela: janelaNaHora } = await buscarClienteEJanela();
    setJanelaPedido(janelaNaHora);
    if (janelaNaHora.temRota && janelaNaHora.disponivel === false) {
      setErro("As coletas de hoje já fecharam pra sua rota. Peça de novo amanhã, com folga antes da primeira saída.");
      setEnviando(false);
      return;
    }

    try {
      let fotoUrl = null;
      if (foto) {
        const caminho = `${perfil.id}/${Date.now()}-${foto.name}`;
        const { error: erroUpload } = await supabase.storage.from("fotos-coletas").upload(caminho, foto);
        if (erroUpload) throw erroUpload;
        const { data } = supabase.storage.from("fotos-coletas").getPublicUrl(caminho);
        fotoUrl = data.publicUrl;
      }

      const { error } = await supabase.from("coletas").insert({
        cliente_id: perfil.id,
        local,
        // Placeholder até o encaixe por roteiro ficar pronto — o cliente não
        // escolhe mais veículo nem horário; quem decide isso agora é o
        // despachante/gerente, encaixando essa coleta no roteiro do
        // coletor certo (ver aba "Rotas"). Tipo de produto também não é
        // mais escolhido pelo cliente — quem precisar de mais detalhe do
        // pacote (ex.: se é frágil) usa o campo de observação.
        veiculo_tipo: "fiorino",
        tipo_produto: "caixa",
        horario_solicitado: new Date().toISOString(),
        observacao,
        foto_url: fotoUrl,
        risco_atraso: false,
        // No banco de verdade isso já nasce "pendente" sozinho (default do
        // schema), mas o modo demonstração não aplica esse default — sem
        // isso a coleta nova ficava sem status e sumia da lista separada
        // por seção.
        status: "pendente",
      });
      // O insert dispara o trigger que avisa gerente/despachante via push.
      if (error) throw error;

      navigate("/");
    } catch (err) {
      console.error(err);
      setErro("Não foi possível pedir a coleta. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="app-content">
      <h1>Nova coleta</h1>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Local da coleta</label>
          {perfil?.endereco ? (
            <>
              <input value={local} onChange={(e) => atualizarLocal(e.target.value)} />
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
                Preenchido com o nome e o endereço do seu cadastro — edite se essa coleta for em outro lugar.
              </p>
            </>
          ) : (
            <div className="card" style={{ padding: "10px 12px" }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--danger)" }}>
                Você ainda não tem um endereço cadastrado.
              </p>
              <Link to="/configuracoes" style={{ fontSize: 14 }}>
                Cadastrar endereço em Configurações
              </Link>
            </div>
          )}
        </div>

        {janelaPedido.temRota && janelaPedido.disponivel && (
          <p style={{ margin: "-8px 0 16px", fontSize: 13, color: "var(--text-dim)" }}>
            Sua próxima saída é às {janelaPedido.saida} — peça até {janelaPedido.limite} pra entrar nela.
          </p>
        )}

        {pedidoFechadoPorHorario && (
          <div className="card" style={{ borderColor: "var(--danger)", marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--danger)" }}>
              <strong>As coletas de hoje já fecharam pra sua rota.</strong> A última saída (
              {janelaPedido.ultimaSaida}) já passou. Peça de novo amanhã, antes da próxima saída.
            </p>
          </div>
        )}

        {precisaConfirmarMoto && (
          <div className="card" style={{ borderColor: "var(--amber)", marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--amber)" }}>
              <strong>Atenção:</strong> sua coleta é feita de moto — caixa grande não cabe.
            </p>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, fontWeight: "normal", fontSize: 14 }}>
              <input
                type="checkbox"
                checked={confirmouAvisoMoto}
                onChange={(e) => setConfirmouAvisoMoto(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              Entendi — meu item não é uma caixa grande.
            </label>
          </div>
        )}

        <div className="field">
          <label>Observação (opcional)</label>
          <textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>

        <div className="field">
          <label>Foto (opcional)</label>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => setFoto(e.target.files?.[0] || null)} />
        </div>

        {erro && <p style={{ color: "var(--danger)", fontSize: 14 }}>{erro}</p>}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%" }}
          disabled={enviando || pedidoFechadoPorHorario || (precisaConfirmarMoto && !confirmouAvisoMoto)}
        >
          {enviando ? "Enviando..." : pedidoFechadoPorHorario ? "Coletas de hoje já fecharam" : "Confirmar coleta"}
        </button>
      </form>
    </div>
  );
}
