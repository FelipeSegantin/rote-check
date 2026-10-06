import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import { supabase } from "../lib/supabase";

// Encaixa os pontos de GPS brutos (registrados a cada 20s, então cortam
// esquina e "atravessam" quarteirão) nas ruas de verdade, usando o serviço
// público de "map matching" do OSRM (Open Source Routing Machine) — de
// graça, sem precisar de chave de API, mas é um servidor de demonstração
// (não pensado pra uso pesado em produção): por isso qualquer falha aqui
// (fora do ar, sem cobertura da região, limite de uso) cai de volta pro
// traço reto entre os pontos crus, em vez de quebrar o mapa.
const OSRM_MATCH_URL = "https://router.project-osrm.org/match/v1/driving";
// Máximo de pontos por chamada — o servidor público do OSRM recusa
// requisições com request muito grande; junto com o raio de tolerância
// (pro GPS do celular, que não é perfeito), isso cobre um dia inteiro de
// trajeto dividindo em vários pedaços.
const OSRM_TAMANHO_BLOCO = 100;
const OSRM_RAIO_METROS = 25;

async function encaixarBlocoNaRua(bloco) {
  const coords = bloco.map((p) => `${p.longitude},${p.latitude}`).join(";");
  const radiuses = bloco.map(() => OSRM_RAIO_METROS).join(";");
  const resposta = await fetch(`${OSRM_MATCH_URL}/${coords}?geometries=geojson&overview=full&radiuses=${radiuses}`);
  if (!resposta.ok) throw new Error(`OSRM respondeu ${resposta.status}`);
  const json = await resposta.json();
  if (json.code !== "Ok" || !json.matchings?.length) throw new Error("OSRM não encontrou correspondência pra esse trecho");
  // Às vezes o OSRM retorna mais de um "matching" quando o GPS pula longe
  // demais entre dois pontos pra ele conseguir ligar num trajeto só —
  // concatena tudo numa linha única em vez de desenhar só o primeiro
  // pedaço e sumir com o resto do trajeto.
  return json.matchings.flatMap((m) => m.geometry.coordinates.map(([lon, lat]) => [lat, lon]));
}

// Divide os pontos do dia em blocos de até OSRM_TAMANHO_BLOCO, com 1 ponto
// de sobreposição entre um bloco e o próximo (pro trajeto encaixado de um
// bloco emendar com o do bloco seguinte, sem um corte visível no meio do
// dia). Retorna null quando não dá pra encaixar nada (poucos pontos, ou
// todas as chamadas falharam) — quem chama cai pro traço reto nesse caso.
async function encaixarNaRua(pontos) {
  // Pontos repetidos (coletor parado no mesmo lugar por um tempo) só
  // atrapalham o OSRM e multiplicam blocos à toa — manda só os distintos.
  const distintos = pontos.filter((p, i) => {
    if (i === 0) return true;
    const anterior = pontos[i - 1];
    return p.latitude !== anterior.latitude || p.longitude !== anterior.longitude;
  });
  if (distintos.length < 2) return null;

  const blocos = [];
  for (let inicio = 0; inicio < distintos.length; inicio += OSRM_TAMANHO_BLOCO - 1) {
    const bloco = distintos.slice(inicio, inicio + OSRM_TAMANHO_BLOCO);
    if (bloco.length < 2) break;
    blocos.push(bloco);
    if (inicio + OSRM_TAMANHO_BLOCO >= distintos.length) break;
  }

  const linhaCompleta = [];
  let usouRuas = false;
  for (const bloco of blocos) {
    // Falhou um bloco (ex.: aquele trecho específico sem cobertura)? Não
    // descarta o trajeto inteiro — só aquele pedaço fica sem encaixe; os
    // outros blocos que deram certo continuam valendo.
    try {
      linhaCompleta.push(...(await encaixarBlocoNaRua(bloco)));
      usouRuas = true;
      continue;
    } catch {
      // tenta o plano B logo abaixo
    }
    // Plano B: roteia pelas ruas passando pelos pontos desse pedaço.
    try {
      linhaCompleta.push(...(await rotearBlocoPelasRuas(bloco)));
      usouRuas = true;
      continue;
    } catch {
      // Último recurso: mantém os pontos crus desse pedaço, pra não abrir
      // um buraco no meio do trajeto.
      linhaCompleta.push(...bloco.map((p) => [p.latitude, p.longitude]));
    }
  }
  // Só considera "encaixado" se pelo menos um pedaço usou as ruas; se tudo
  // caiu no último recurso, devolve null (o aviso de linha reta aparece).
  return usouRuas && linhaCompleta.length > 0 ? linhaCompleta : null;
}

// Quando o "map matching" não consegue encaixar um pedaço (GPS muito
// esparso/impreciso, ou sem correspondência), usa o serviço de ROTAS do
// mesmo OSRM: liga os pontos seguindo as ruas de verdade, em vez de uma
// reta atravessando quarteirão. Reduz pra no máximo 25 pontos por pedido
// (sempre mantendo o primeiro e o último) pra não sobrecarregar o servidor
// público e gratuito.
const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving";
const OSRM_MAX_PONTOS_ROTA = 25;

function reduzirPontos(bloco, maximo) {
  if (bloco.length <= maximo) return bloco;
  const passo = (bloco.length - 1) / (maximo - 1);
  const saida = [];
  for (let i = 0; i < maximo; i++) saida.push(bloco[Math.round(i * passo)]);
  return saida;
}

async function rotearBlocoPelasRuas(bloco) {
  const pontos = reduzirPontos(bloco, OSRM_MAX_PONTOS_ROTA);
  const coords = pontos.map((p) => `${p.longitude},${p.latitude}`).join(";");
  const resposta = await fetch(`${OSRM_ROUTE_URL}/${coords}?geometries=geojson&overview=full`);
  if (!resposta.ok) throw new Error(`OSRM (rota) respondeu ${resposta.status}`);
  const json = await resposta.json();
  if (json.code !== "Ok" || !json.routes?.length) throw new Error("OSRM não achou rota pra esse trecho");
  return json.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
}

// Enquadra o mapa no trajeto (ou no último ponto, se só houver um) uma vez
// por coletor/dia — e de novo quando o trajeto encaixado nas ruas chega.
// Não reenquadra a cada ponto novo ao vivo, pra não "puxar" o mapa de volta
// enquanto o gerente está mexendo (arrastando/dando zoom).
function AjustarVista({ chave, linha }) {
  const mapa = useMap();
  useEffect(() => {
    if (!linha || linha.length === 0) return;
    if (linha.length === 1) {
      mapa.setView(linha[0], 16);
      return;
    }
    mapa.fitBounds(linha, { padding: [30, 30], maxZoom: 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return null;
}

function hojeYMD() {
  // Usa data local (não UTC) — o resto do componente monta "início/fim do
  // dia" a partir dessa string com `new Date(\`${data}T00:00:00\`)`, que o
  // JS interpreta no fuso local. Usar toISOString() (sempre UTC) aqui
  // desalinhava os dois perto da meia-noite UTC, fazendo o "hoje" ao vivo
  // sumir por algumas horas em fusos atrás de UTC (como o do Brasil).
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Mostra o trajeto de um coletor num dia — hoje (padrão, ao vivo, via
// Supabase Realtime) ou qualquer dia passado (histórico, só lê o que já
// está salvo). Os pontos GPS nunca são apagados, então qualquer dia
// anterior sempre pode ser revisitado aqui — não precisa gerar nem
// guardar nenhuma imagem à parte. Os tiles vêm do OpenStreetMap; o
// rastreamento em si (onde o coletor está e por onde passou) é 100%
// construído dentro do app.
export default function MapaRota({ coletorId, data }) {
  const [pontos, setPontos] = useState([]);
  const diaEscolhido = data || hojeYMD();
  const ehHoje = diaEscolhido === hojeYMD();

  // Trajeto já encaixado nas ruas (null enquanto carrega, ou quando o
  // encaixe falhou/não rolou — nesse caso o desenho cai pro traço reto
  // entre os pontos de GPS crus, igual era antes).
  const [linhaEncaixada, setLinhaEncaixada] = useState(null);
  const [encaixando, setEncaixando] = useState(false);

  useEffect(() => {
    if (!coletorId) return;

    let ativo = true;

    async function carregarHistoricoDoDia() {
      const inicioDia = new Date(`${diaEscolhido}T00:00:00`);
      const fimDia = new Date(`${diaEscolhido}T23:59:59.999`);
      const { data: linhas } = await supabase
        .from("posicoes_gps")
        .select("latitude, longitude, registrado_em")
        .eq("coletor_id", coletorId)
        .gte("registrado_em", inicioDia.toISOString())
        .lte("registrado_em", fimDia.toISOString())
        .order("registrado_em", { ascending: true });
      if (ativo) setPontos(linhas || []);
    }
    carregarHistoricoDoDia();

    // Um dia passado nunca recebe pontos novos — só assina o realtime
    // quando é hoje, pra não ficar uma inscrição parada à toa.
    if (!ehHoje) return;

    const canal = supabase
      .channel(`posicoes-${coletorId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posicoes_gps", filter: `coletor_id=eq.${coletorId}` },
        (payload) => setPontos((atual) => [...atual, payload.new])
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [coletorId, diaEscolhido, ehHoje]);

  // Reencaixa sempre que os pontos do dia mudam — mas só depois de uma
  // pausa (1,5s): ao vivo, a lista de pontos cresce um de cada vez a cada
  // 20s, e sem essa espera cada ponto novo chamaria o OSRM na hora,
  // sobrecarregando à toa o servidor público dele.
  useEffect(() => {
    if (pontos.length < 2) {
      setLinhaEncaixada(null);
      return;
    }
    let cancelado = false;
    const temporizador = setTimeout(async () => {
      setEncaixando(true);
      try {
        const linha = await encaixarNaRua(pontos);
        if (!cancelado) setLinhaEncaixada(linha);
      } catch {
        if (!cancelado) setLinhaEncaixada(null);
      } finally {
        if (!cancelado) setEncaixando(false);
      }
    }, 1500);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [pontos]);

  const ultimo = pontos[pontos.length - 1];
  const centro = ultimo ? [ultimo.latitude, ultimo.longitude] : [-22.31, -49.06]; // Bauru como fallback

  if (pontos.length === 0) {
    return (
      <p style={{ color: "var(--text-dim)" }}>
        {ehHoje
          ? "Nenhuma posição registrada ainda hoje — o rastreamento começa quando o coletor abre o app."
          : "Nenhuma posição registrada nesse dia."}
      </p>
    );
  }

  return (
    <div className="scroll-x" style={{ borderRadius: "var(--radius)", overflow: "hidden" }}>
      <MapContainer center={centro} zoom={15} style={{ height: "min(65vh, 480px)", minHeight: 340, width: "100%" }}>
        {/* Estilo "Voyager" da CARTO (dados do OpenStreetMap): ruas, nomes e
            quadras bem destacados, gratuito e sem chave de API. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        <AjustarVista
          chave={`${coletorId}|${diaEscolhido}|${linhaEncaixada ? "ruas" : "cru"}`}
          linha={linhaEncaixada || pontos.map((p) => [p.latitude, p.longitude])}
        />
        {pontos.length > 1 && (
          <Polyline
            positions={linhaEncaixada || pontos.map((p) => [p.latitude, p.longitude])}
            color="#e6a800"
            weight={5}
            opacity={0.9}
          />
        )}
        {ultimo && ehHoje && <Marker position={[ultimo.latitude, ultimo.longitude]} />}
      </MapContainer>
      {encaixando && (
        <p style={{ color: "var(--text-dim)", fontSize: 12, margin: "6px 0 0" }}>Encaixando o trajeto nas ruas...</p>
      )}
      {!encaixando && pontos.length > 1 && !linhaEncaixada && (
        <p style={{ color: "var(--text-dim)", fontSize: 12, margin: "6px 0 0" }}>
          Não deu pra encaixar o trajeto nas ruas agora — mostrando a linha reta entre os pontos registrados.
        </p>
      )}
    </div>
  );
}

// Chamar periodicamente dentro da tela do coletor (ex.: a cada 15s
// enquanto uma coleta está em andamento) para alimentar o rastreamento.
export async function registrarPosicaoAtual(coletorId) {
  if (!("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(async (pos) => {
    await supabase.from("posicoes_gps").insert({
      coletor_id: coletorId,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      // Setado aqui em vez de confiar só no "default now()" da coluna no
      // banco de verdade — o cliente falso do modo demo (mockSupabase.js)
      // não aplica defaults de coluna, então sem isso toda posição
      // registrada AO VIVO (fora dos dados de exemplo já semeados) ficava
      // sem registrado_em e nunca aparecia em nenhuma busca por
      // intervalo de tempo (mapa histórico, print de rota etc.).
      registrado_em: new Date().toISOString(),
    });
  });
}
