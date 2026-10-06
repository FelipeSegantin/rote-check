-- =====================================================================
-- RoteCheck — schema principal
-- Rode isto no SQL editor do Supabase (ou via `supabase db push`).
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pg_net; -- necessário para os triggers chamarem a Edge Function

-- ---------------------------------------------------------------------
-- PERFIS (cliente, despachante, gerente, coletor)
-- ---------------------------------------------------------------------
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  papel text not null check (papel in ('cliente', 'despachante', 'gerente', 'coletor')),
  nome text not null, -- nome de quem está cadastrado (login/conta)
  telefone text,
  foto_url text,
  -- campos de cliente
  estabelecimento text, -- nome do local/loja (mostrado nas coletas em vez do nome pessoal)
  cnpj text,
  endereco text,
  cep text,
  -- coletor pendente de aprovação do gerente
  aprovado boolean not null default true,
  usuario_coletor text unique, -- login simples do coletor
  -- preferência de aparência — vale pra qualquer papel, sincroniza entre
  -- aparelhos porque fica na conta (não é só localStorage do navegador)
  tema text not null default 'sistema' check (tema in ('sistema', 'claro', 'escuro')),
  -- coletor: horário em que apertou "Iniciar o dia" (null = não iniciou
  -- ainda). Fica null de novo ao apertar "Encerrar o dia". É isso que
  -- despachante e gerente enxergam na aba Chat → Coletores pra saber quem
  -- já está trabalhando.
  dia_iniciado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- "create table if not exists" acima não adiciona colunas novas a uma
-- tabela "perfis" que já existia de uma versão anterior deste schema —
-- os "if not exists" abaixo cobrem isso, então rodar este arquivo de novo
-- num projeto já criado sempre deixa as colunas em dia, sem duplicar nada.
alter table perfis add column if not exists estabelecimento text;
alter table perfis add column if not exists tema text not null default 'sistema';
alter table perfis drop constraint if exists perfis_tema_check;
alter table perfis add constraint perfis_tema_check check (tema in ('sistema', 'claro', 'escuro'));
alter table perfis add column if not exists dia_iniciado_em timestamptz;

-- ---------------------------------------------------------------------
-- CONVITES — único jeito de virar despachante ou gerente (fora o
-- primeiríssimo gerente da empresa, ver rotecheck_existe_gerente_aprovado
-- mais abaixo). O gerente gera um código, manda o link pra pessoa
-- (.../cadastro?convite=<codigo>), e ele só funciona uma vez — depois de
-- usado, ninguém mais entra com aquele link. Cliente e coletor continuam
-- com cadastro aberto (não usam esta tabela).
-- ---------------------------------------------------------------------
create table if not exists convites (
  id uuid primary key default uuid_generate_v4(),
  codigo text not null unique,
  papel text not null check (papel in ('despachante', 'gerente')),
  criado_por uuid not null references perfis(id),
  usado boolean not null default false,
  usado_por uuid references perfis(id),
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- VEÍCULOS — cadastro/controle de frota feito pelo gerente
-- ---------------------------------------------------------------------
create table if not exists veiculos (
  id uuid primary key default uuid_generate_v4(),
  tipo text not null check (tipo in ('fiorino', 'van', 'moto')),
  placa text not null unique,
  status text not null default 'disponivel' check (status in ('disponivel', 'manutencao')),
  observacao text, -- ex.: motivo da manutenção ("batida no para-choque")
  coletor_id uuid references perfis(id),
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- COLETAS
-- ---------------------------------------------------------------------
create table if not exists coletas (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid not null references perfis(id),
  coletor_id uuid references perfis(id), -- definido quando o gerente aceita
  veiculo_tipo text not null check (veiculo_tipo in ('fiorino', 'van', 'moto')),
  tipo_produto text not null check (tipo_produto in ('caixa', 'envelope', 'fragil')),
  local text not null,
  horario_solicitado timestamptz not null,
  observacao text,
  risco_atraso boolean not null default false, -- pedido em cima da hora
  status text not null default 'pendente'
    check (status in ('pendente', 'aceita', 'recusada', 'coletada')),
  motivo_recusa text,
  foto_url text, -- foto tirada na hora da coleta
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ROTAS (sugestão automática + edição manual)
-- ---------------------------------------------------------------------
create table if not exists rotas (
  id uuid primary key default uuid_generate_v4(),
  coletor_id uuid not null references perfis(id),
  data date not null default current_date,
  coletas_ordem uuid[] not null default '{}', -- ids de "coletas", na ordem da rota
  editado_manualmente boolean not null default false,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PARADAS FIXAS (roteiro semanal) — os lugares que cada coletor já
-- atende sempre, todo dia ou em dias certos da semana, com veículo já
-- definido (isso vem de fora do app, hoje é a planilha que o Felipe
-- mantém). Diferente de "coletas": não é um pedido que alguém aceita ou
-- recusa, é uma referência fixa que despachante/gerente cadastram e
-- editam na aba Roteiro. Endereços que NÃO têm uma parada fixa aqui são
-- os "por demanda" — o cliente pede pelo app normalmente (tela Nova
-- coleta), sem precisar aparecer nesta tabela.
create table if not exists paradas_fixas (
  id uuid primary key default uuid_generate_v4(),
  coletor_id uuid not null references perfis(id),
  base text not null default 'AGF RIO BRANCO', -- de onde o coletor sai/volta
  saida_numero int not null default 1, -- 1ª, 2ª, 3ª saída do dia... (agrupa paradas da mesma leva)
  horario_saida time, -- horário que essa saída começa (pode ficar em branco)
  veiculo text not null default 'CARRO', -- texto livre (CARRO, MOTO...) — não é o mesmo enum de coletas.veiculo_tipo
  nome text not null, -- nome do estabelecimento/lugar
  endereco text not null,
  dias_semana int[] not null default '{1,2,3,4,5,6}', -- 1=segunda ... 6=sábado
  ordem int not null default 1, -- ordem dentro da saída
  ativa boolean not null default true, -- desativar em vez de apagar, pra manter histórico
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_paradas_fixas_coletor on paradas_fixas (coletor_id, saida_numero, ordem);

-- ---------------------------------------------------------------------
-- CONFIRMAÇÕES DE PARADA FIXA — registra, por dia, que o coletor passou
-- numa parada do roteiro fixo e tirou a foto confirmando a coleta ali
-- (mesma ideia do foto_url de "coletas", só que aqui é pra cada parada do
-- roteiro semanal, que não tem uma linha própria em "coletas"). Uma linha
-- por parada por dia — reabrir o app ou reiniciar o dia não duplica nem
-- desfaz o que já foi confirmado.
-- ---------------------------------------------------------------------
create table if not exists confirmacoes_parada_fixa (
  id uuid primary key default uuid_generate_v4(),
  parada_fixa_id uuid not null references paradas_fixas(id) on delete cascade,
  coletor_id uuid not null references perfis(id),
  data date not null default current_date,
  foto_url text,
  -- Marca "cliente não atendeu" (o coletor esteve no local mas ninguém
  -- entregou nada) — nesse caso foto_url guarda a foto tirada como prova
  -- de que o coletor esteve lá. Quando false, a parada foi confirmada
  -- normalmente e não precisa de foto nenhuma.
  cliente_ausente boolean not null default false,
  confirmado_em timestamptz not null default now(),
  unique (parada_fixa_id, data)
);
create index if not exists idx_confirmacoes_parada_fixa_coletor_data on confirmacoes_parada_fixa (coletor_id, data);
-- Quem de fato registrou essa linha — o próprio coletor (confirmando na
-- hora, com ou sem foto) ou o despachante/gerente marcando "sem coleta
-- hoje" de longe, sem precisar o coletor passar no local pra constatar.
-- Null nas linhas antigas (de antes dessa coluna existir), onde sempre foi
-- o próprio coletor mesmo.
alter table confirmacoes_parada_fixa add column if not exists marcado_por uuid references perfis(id);

-- ---------------------------------------------------------------------
-- CLIENTES ESPERADOS — referência de quem ainda vai se cadastrar (vem da
-- mesma planilha do roteiro, mas são os endereços "por demanda": sem
-- parada fixa, o cliente pede pelo app). Serve só pra saber de antemão
-- qual veículo normalmente atende cada um (CARRO ou MOTO), casando pelo
-- nome do estabelecimento no cadastro do cliente — usado pra avisar na
-- tela de "Nova coleta" quando o veículo é moto (caixa grande não cabe).
-- Não é uma conta de verdade (isso só existe quando a pessoa se cadastra
-- em "perfis"); é só uma tabela de consulta.
-- ---------------------------------------------------------------------
create table if not exists clientes_esperados (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  endereco text,
  veiculo text not null default 'CARRO',
  coletor_id uuid references perfis(id),
  -- CNPJ (só dígitos, sem máscara) da planilha de cadastro de clientes,
  -- casado por nome/fantasia na importação (ver importar_producao.js) —
  -- fica nulo quando não deu pra casar com confiança. Usado em Nova Coleta
  -- pra identificar o cliente com certeza (via perfis.cnpj) em vez de só
  -- pelo nome do estabelecimento digitado no cadastro, que pode não bater
  -- exatamente com o nome da planilha.
  cnpj text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_clientes_esperados_nome on clientes_esperados (nome);
create index if not exists idx_clientes_esperados_cnpj on clientes_esperados (cnpj);

-- ---------------------------------------------------------------------
-- SOLICITAÇÕES DE USUÁRIO ESQUECIDO — "Esqueci meu usuário" (ver
-- RecuperarUsuario.jsx). A pessoa não consegue logar pra provar quem é
-- (é esse o problema), então se identifica por CNPJ + nome do
-- estabelecimento; um gerente/despachante confere e Aceita ou Recusa
-- (AbaSolicitacoesUsuario.jsx). Só depois de aceita é que a própria
-- pessoa define o novo login. Como quem cria/lê isso é sempre alguém
-- DESLOGADO, o acesso não passa por RLS direto na tabela — vai só pelas
-- funções security definer abaixo, que devolvem só o que cada etapa
-- precisa (mesmo padrão de rotecheck_verificar_convite).
-- ---------------------------------------------------------------------
create table if not exists solicitacoes_usuario (
  id uuid primary key default uuid_generate_v4(),
  cnpj text not null,
  estabelecimento text not null,
  perfil_id uuid references perfis(id), -- achado por CNPJ no momento da solicitação; null se não bateu com ninguém
  status text not null default 'pendente' check (status in ('pendente', 'aceita', 'recusada')),
  novo_login text, -- preenchido só depois que a pessoa define o novo login, já aceito
  criado_em timestamptz not null default now(),
  atendido_em timestamptz, -- quando a equipe aceitou/recusou
  concluido_em timestamptz -- quando a pessoa terminou de trocar o login
);
create index if not exists idx_solicitacoes_usuario_cnpj on solicitacoes_usuario (cnpj);

-- ---------------------------------------------------------------------
-- POSIÇÕES GPS (trajeto do coletor, em tempo real via Supabase Realtime)
-- ---------------------------------------------------------------------
create table if not exists posicoes_gps (
  id bigint generated always as identity primary key,
  coletor_id uuid not null references perfis(id),
  latitude double precision not null,
  longitude double precision not null,
  registrado_em timestamptz not null default now()
);
create index if not exists idx_posicoes_coletor_tempo on posicoes_gps (coletor_id, registrado_em desc);

-- ---------------------------------------------------------------------
-- PRINTS DE ROTA — um "print" (imagem) do trajeto de uma saída específica
-- do coletor, do "Iniciar rota" ao "Finalizar rota" na tela dele. Gerado
-- no navegador a partir dos pontos de posicoes_gps daquele intervalo e
-- subido pro bucket de Storage `prints-rotas`. Guardado só por 15 dias —
-- ver rotecheck_limpar_prints_antigos() e o agendamento via pg_cron mais
-- abaixo.
-- ---------------------------------------------------------------------
create table if not exists prints_rotas (
  id uuid primary key default uuid_generate_v4(),
  coletor_id uuid not null references perfis(id),
  iniciado_em timestamptz not null,
  encerrado_em timestamptz not null,
  foto_url text not null,
  criado_em timestamptz not null default now()
);
create index if not exists idx_prints_rotas_coletor_tempo on prints_rotas (coletor_id, iniciado_em desc);

-- ---------------------------------------------------------------------
-- CHAT — dois tipos de conversa na mesma tabela, nunca misturados:
-- (1) por coleta: cliente com equipe (gerente/despachante) — coleta_id
--     preenchido, coletor_id nulo;
-- (2) por coletor: coletor com equipe (gerente/despachante) — coletor_id
--     preenchido, coleta_id nulo. Não existe chat direto entre cliente e
--     coletor em nenhum dos dois casos.
-- ---------------------------------------------------------------------
create table if not exists mensagens (
  id uuid primary key default uuid_generate_v4(),
  coleta_id uuid references coletas(id) on delete cascade,
  coletor_id uuid references perfis(id) on delete cascade,
  remetente_id uuid not null references perfis(id),
  texto text not null,
  criado_em timestamptz not null default now(),
  constraint mensagens_um_tipo_de_conversa check (
    (coleta_id is not null and coletor_id is null) or
    (coleta_id is null and coletor_id is not null)
  )
);
create index if not exists idx_mensagens_coleta_tempo on mensagens (coleta_id, criado_em);
create index if not exists idx_mensagens_coletor_tempo on mensagens (coletor_id, criado_em);

-- Colunas novas pra quem já rodou este schema antes de o chat com o
-- coletor existir (mesma lógica do "add column if not exists" de perfis
-- lá em cima).
alter table mensagens alter column coleta_id drop not null;
alter table mensagens add column if not exists coletor_id uuid references perfis(id) on delete cascade;
alter table mensagens drop constraint if exists mensagens_um_tipo_de_conversa;
alter table mensagens add constraint mensagens_um_tipo_de_conversa check (
  (coleta_id is not null and coletor_id is null) or
  (coleta_id is null and coletor_id is not null)
);

-- ---------------------------------------------------------------------
-- PUSH SUBSCRIPTIONS (uma linha por dispositivo/navegador inscrito)
-- ---------------------------------------------------------------------
create table if not exists push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references perfis(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- NOTIFICAÇÕES (histórico — além do push em si, fica registrado no app)
-- ---------------------------------------------------------------------
create table if not exists notificacoes (
  id bigint generated always as identity primary key,
  user_id uuid not null references perfis(id) on delete cascade,
  coleta_id uuid references coletas(id),
  -- preenchido só pra 'nova_mensagem' vinda do chat de um coletor com a
  -- equipe (ver mensagens.coletor_id acima) — nunca junto com coleta_id.
  coletor_id uuid references perfis(id),
  tipo text not null, -- 'nova_coleta' | 'coleta_aceita' | 'coleta_recusada' | 'coleta_atribuida' | 'coleta_concluida' | 'nova_mensagem' | 'conta_aprovada' | 'nova_solicitacao_usuario'
  titulo text not null,
  corpo text not null,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table notificacoes add column if not exists coletor_id uuid references perfis(id);

-- =====================================================================
-- GATILHOS DE PUSH NOTIFICATION
--
-- Estratégia: a Edge Function `send-push` recebe { tipo, coleta_id } e
-- decide sozinha quem notificar e com qual texto. Os triggers do banco
-- só avisam "aconteceu X na coleta Y" via pg_net (HTTP async, não
-- bloqueia a transação).
-- =====================================================================

-- A Supabase passou a bloquear "alter database ... set app.settings.x"
-- (erro 42501: permission denied to set parameter) — o jeito atual de
-- guardar esses dois valores é o Vault (ver instruções no fim do arquivo).
-- "security definer" é necessário porque vault.decrypted_secrets só pode
-- ser lida pelo dono da função (postgres), não pelo papel de quem disparou
-- o gatilho (anon/authenticated) — sem isso, cliente/despachante/gerente
-- comuns não conseguiriam nem ler o segredo indiretamente.
create or replace function rotecheck_url_send_push()
returns text language sql stable security definer set search_path = public, vault as $$
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'send_push_url'),
    ''
  );
$$;

create or replace function rotecheck_service_role_key()
returns text language sql stable security definer set search_path = public, vault as $$
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
    ''
  );
$$;

create or replace function fn_notificar_nova_coleta()
returns trigger language plpgsql as $$
begin
  -- O aviso de push é só um "extra": se o pg_net ou a Edge Function
  -- falharem (ou ainda não estiverem configurados), isso NUNCA pode
  -- derrubar a operação de verdade (aqui, criar a coleta) — por isso todo
  -- net.http_post nos gatilhos de notificação vai dentro de um bloco com
  -- "exception when others" que engole o erro e segue em frente.
  begin
    perform net.http_post(
      url := rotecheck_url_send_push(),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || rotecheck_service_role_key()
      ),
      body := jsonb_build_object('tipo', 'nova_coleta', 'coleta_id', new.id)
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_nova_coleta on coletas;
create trigger trg_nova_coleta
  after insert on coletas
  for each row execute function fn_notificar_nova_coleta();

create or replace function fn_notificar_status_coleta()
returns trigger language plpgsql as $$
begin
  -- Ver comentário em fn_notificar_nova_coleta: o "begin/exception when
  -- others" é o que garante que uma falha no aviso (push ainda não
  -- configurado, Edge Function fora do ar etc.) nunca impede a coleta de
  -- ser aceita/recusada/coletada de verdade — sem isso, um erro aqui
  -- derrubava a transação inteira e a mudança de status nem chegava a
  -- salvar (foi exatamente isso que fez coletas "aceitas" sumirem do
  -- painel do despachante/gerente).
  if new.status is distinct from old.status and new.status in ('aceita', 'recusada', 'coletada') then
    begin
      perform net.http_post(
        url := rotecheck_url_send_push(),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || rotecheck_service_role_key()
        ),
        body := jsonb_build_object(
          'tipo', case new.status
            when 'aceita' then 'coleta_aceita'
            when 'recusada' then 'coleta_recusada'
            else 'coleta_concluida'
          end,
          'coleta_id', new.id
        )
      );
    exception when others then
      null;
    end;
  end if;

  -- Quando a coleta é aceita, o coletor que ficou responsável também
  -- precisa saber que tem uma coleta nova pra ele — pedido do Felipe,
  -- separado do aviso acima (que vai pro cliente): tipo diferente, pra
  -- Edge Function mandar pra pessoa certa com o texto certo.
  if new.status is distinct from old.status and new.status = 'aceita' and new.coletor_id is not null then
    begin
      perform net.http_post(
        url := rotecheck_url_send_push(),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || rotecheck_service_role_key()
        ),
        body := jsonb_build_object('tipo', 'coleta_atribuida', 'coleta_id', new.id)
      );
    exception when others then
      null;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_status_coleta on coletas;
create trigger trg_status_coleta
  after update on coletas
  for each row execute function fn_notificar_status_coleta();

-- Mensagem nova no chat de uma coleta — a Edge Function decide o
-- destinatário conforme quem mandou (cliente manda -> avisa despachante e
-- gerente; equipe manda -> avisa o cliente dono da coleta), então aqui só
-- avisamos qual mensagem foi criada.
create or replace function fn_notificar_nova_mensagem()
returns trigger language plpgsql as $$
begin
  begin
    perform net.http_post(
      url := rotecheck_url_send_push(),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || rotecheck_service_role_key()
      ),
      body := jsonb_build_object('tipo', 'nova_mensagem', 'mensagem_id', new.id)
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_nova_mensagem on mensagens;
create trigger trg_nova_mensagem
  after insert on mensagens
  for each row execute function fn_notificar_nova_mensagem();

-- Conta aprovada (cliente ou coletor que estava com perfis.aprovado=false
-- e um gerente/despachante aprovou, aba Convites) — avisa a própria pessoa
-- que já pode usar o app. Só dispara na transição false -> true, nunca
-- em qualquer outra edição de perfil.
create or replace function fn_notificar_conta_aprovada()
returns trigger language plpgsql as $$
begin
  -- Mesma blindagem: aprovar um cadastro não pode travar por causa do
  -- aviso de push (essa é a mais crítica das quatro — sem o "exception",
  -- um push mal configurado faria o próprio botão "Aprovar" parecer que
  -- não funciona).
  if new.aprovado is distinct from old.aprovado and new.aprovado = true then
    begin
      perform net.http_post(
        url := rotecheck_url_send_push(),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || rotecheck_service_role_key()
        ),
        body := jsonb_build_object('tipo', 'conta_aprovada', 'perfil_id', new.id)
      );
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_conta_aprovada on perfis;
create trigger trg_conta_aprovada
  after update on perfis
  for each row execute function fn_notificar_conta_aprovada();

-- Pedido novo de "esqueci meu usuário" (rotecheck_criar_solicitacao_usuario,
-- aba Convites -> Solicitações) — avisa gerente/despachante que tem gente
-- esperando resposta.
create or replace function fn_notificar_nova_solicitacao_usuario()
returns trigger language plpgsql as $$
begin
  begin
    perform net.http_post(
      url := rotecheck_url_send_push(),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || rotecheck_service_role_key()
      ),
      body := jsonb_build_object('tipo', 'nova_solicitacao_usuario', 'solicitacao_id', new.id)
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_nova_solicitacao_usuario on solicitacoes_usuario;
create trigger trg_nova_solicitacao_usuario
  after insert on solicitacoes_usuario
  for each row execute function fn_notificar_nova_solicitacao_usuario();

-- =====================================================================
-- Configuração necessária (rodar uma vez, com a service role key real):
--
--   select vault.create_secret(
--     'https://<PROJECT_REF>.supabase.co/functions/v1/send-push',
--     'send_push_url'
--   );
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--
-- Isso é necessário porque os triggers rodam dentro do Postgres e
-- precisam saber a URL da Edge Function e uma credencial para chamá-la.
-- Se algum dos dois nomes já existir no Vault (rodando esse schema.sql de
-- novo, por exemplo), troca "vault.create_secret" por:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'send_push_url'),
--     'https://<PROJECT_REF>.supabase.co/functions/v1/send-push'
--   );
-- (mesma ideia pra 'service_role_key').
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções auxiliares (security definer) para as políticas de RLS abaixo.
--
-- Rodam com o dono da função, então ignoram RLS por dentro — isso evita o
-- problema clássico de uma policy em "perfis" precisar reconsultar
-- "perfis" dentro dela mesma (recursão), e centraliza a checagem de
-- "aprovado = true" num único lugar em vez de repetir em cada policy: um
-- despachante/gerente recém-cadastrado (ainda pendente) NÃO deve ter
-- acesso de equipe enquanto não for aprovado.
-- ---------------------------------------------------------------------
create or replace function rotecheck_papel_aprovado()
returns text
language sql security definer stable
set search_path = public
as $$
  select papel from perfis where id = auth.uid() and aprovado = true;
$$;

-- Usada na tela de cadastro: "já existe algum gerente aprovado, ou essa é
-- a primeira conta?" — sem isso, o primeiro gerente da empresa ficaria
-- pendente esperando um gerente aprovar, e não existiria nenhum ainda
-- pra fazer essa aprovação. Só devolve um booleano (não expõe nenhum
-- dado), por isso pode ficar liberada mesmo antes de logar.
create or replace function rotecheck_existe_gerente_aprovado()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from perfis where papel = 'gerente' and aprovado = true);
$$;

-- Só confere um código de convite (não consome) — usada assim que a tela
-- de cadastro abre com "?convite=<codigo>" na URL, pra mostrar o papel do
-- convite ou um aviso de "inválido/já usado" antes da pessoa preencher
-- qualquer coisa. Não expõe nada além do papel de UM código específico.
create or replace function rotecheck_verificar_convite(p_codigo text)
returns text
language sql security definer stable
set search_path = public
as $$
  select papel from convites where codigo = p_codigo and usado = false;
$$;

-- Consome o convite (marca como usado, trava a linha com "for update" pra
-- duas pessoas não conseguirem usar o mesmo código ao mesmo tempo) e já
-- cria o perfil aprovado na hora — foi convidado por um gerente de
-- verdade, não precisa de uma segunda aprovação depois. Dá erro se o
-- código não existir ou já tiver sido usado.
--
-- IMPORTANTE sobre a ordem abaixo: o perfil precisa ser criado ANTES de
-- marcar o convite como usado, porque "convites.usado_por" referencia
-- "perfis(id)" (chave estrangeira) — se tentar preencher esse campo antes
-- do perfil existir, o banco recusa (foi um bug real, corrigido numa
-- sessão anterior: toda vez que alguém tentava se cadastrar por convite,
-- dava erro de chave estrangeira e nada era criado).
create or replace function rotecheck_cadastrar_via_convite(p_codigo text, p_nome text, p_telefone text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_convite_id uuid;
  v_papel text;
begin
  select id, papel into v_convite_id, v_papel
    from convites
    where codigo = p_codigo and usado = false
    for update;

  if v_convite_id is null then
    raise exception 'Esse convite não é válido ou já foi usado.';
  end if;

  insert into perfis (id, papel, nome, telefone, aprovado)
  values (auth.uid(), v_papel, p_nome, p_telefone, true);

  update convites set usado = true, usado_por = auth.uid(), usado_em = now() where id = v_convite_id;

  return v_papel;
end;
$$;

-- Cria o primeiríssimo gerente da empresa (só existe pra isso — depois
-- disso, despachante/gerente só entram por convite de um gerente já
-- aprovado). A checagem de "ainda não existe gerente nenhum" acontece
-- AQUI dentro, do lado do banco — não dá pra confiar só na tela de
-- cadastro escondendo o botão, porque qualquer um com o anon key
-- conseguiria chamar a API direto. Dá erro se já existir um gerente.
create or replace function rotecheck_cadastrar_primeiro_gerente(p_nome text, p_telefone text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if rotecheck_existe_gerente_aprovado() then
    raise exception 'Já existe um gerente cadastrado nesta empresa.';
  end if;

  insert into perfis (id, papel, nome, telefone, aprovado)
  values (auth.uid(), 'gerente', p_nome, p_telefone, true);
end;
$$;

-- Substitui de uma vez o roteiro fixo (paradas_fixas) de um ou mais
-- coletores — usado pela tela de Roteiro quando despachante/gerente sobe
-- a planilha "ROTEIRO ATUALIZADO" de novo (ver src/lib/planilhaRoteiro.js
-- e AbaRoteiro.jsx). "security invoker" (padrão, sem "security definer")
-- de propósito: quem chama já precisa ter permissão de despachante/gerente
-- pela RLS normal de paradas_fixas, essa função só existe pra apagar +
-- inserir como uma transação única (se der erro no meio, nada fica pela
-- metade) em vez de duas chamadas separadas do navegador.
create or replace function rotecheck_atualizar_roteiro(p_coletores_ids uuid[], p_paradas jsonb)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_count int;
begin
  delete from paradas_fixas where coletor_id = any(p_coletores_ids);

  insert into paradas_fixas (coletor_id, base, saida_numero, horario_saida, veiculo, nome, endereco, dias_semana, ordem, ativa)
  select
    (item->>'coletor_id')::uuid,
    item->>'base',
    (item->>'saida_numero')::int,
    nullif(item->>'horario_saida', '')::time,
    item->>'veiculo',
    item->>'nome',
    item->>'endereco',
    (select array_agg(x::int) from jsonb_array_elements_text(item->'dias_semana') as x),
    (item->>'ordem')::int,
    true
  from jsonb_array_elements(p_paradas) as item;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- "Esqueci meu usuário" (3 funções, ver comentário na tabela
-- solicitacoes_usuario acima): quem chama estas duas primeiras está
-- DESLOGADO, então elas rodam security definer pra poder ler/gravar sem
-- precisar de uma policy de RLS que deixaria a tabela (ou pior, "perfis")
-- legível por qualquer anônimo.

-- Cria a solicitação já casando com o cliente pelo CNPJ (o casamento
-- acontece AQUI dentro, sem nunca devolver dado nenhum de "perfis" pra
-- quem chamou) e devolve só o id da solicitação criada, que o navegador
-- guarda pra acompanhar o status depois.
create or replace function rotecheck_criar_solicitacao_usuario(p_cnpj text, p_estabelecimento text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_perfil_id uuid;
  v_id uuid;
begin
  select id into v_perfil_id from perfis where papel = 'cliente' and cnpj = p_cnpj limit 1;

  insert into solicitacoes_usuario (cnpj, estabelecimento, perfil_id, status)
  values (p_cnpj, p_estabelecimento, v_perfil_id, 'pendente')
  returning id into v_id;

  return v_id;
end;
$$;

-- Lê só os campos que a tela precisa mostrar, de UMA solicitação
-- específica (o id funciona como uma senha de acompanhamento — só quem
-- tem o link/id consegue ler aquela solicitação, ninguém lista as
-- outras).
create or replace function rotecheck_ler_solicitacao_usuario(p_id uuid)
returns json
language sql security definer stable
set search_path = public
as $$
  select json_build_object(
    'id', id, 'cnpj', cnpj, 'estabelecimento', estabelecimento,
    'status', status, 'novo_login', novo_login
  )
  from solicitacoes_usuario where id = p_id;
$$;

-- Troca o login (e-mail de auth.users, não uma coluna de "perfis" — o
-- app não guarda e-mail duplicado ali) de quem teve a solicitação
-- aceita. Confere de novo, do lado do banco, que está tudo certo (aceita,
-- ainda não trocada, e-mail novo livre) antes de mexer em auth.users —
-- não dá pra confiar só na tela escondendo os botões.
create or replace function rotecheck_trocar_login(p_solicitacao_id uuid, p_novo_login text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_status text;
  v_novo_login_atual text;
  v_perfil_id uuid;
begin
  select status, novo_login, perfil_id into v_status, v_novo_login_atual, v_perfil_id
    from solicitacoes_usuario where id = p_solicitacao_id
    for update;

  if v_status is null then
    raise exception 'Solicitação não encontrada.';
  end if;
  if v_status <> 'aceita' then
    raise exception 'Essa solicitação ainda não foi aceita por ninguém da equipe.';
  end if;
  if v_novo_login_atual is not null then
    raise exception 'O usuário dessa solicitação já foi trocado.';
  end if;
  if v_perfil_id is null then
    raise exception 'Não achamos a conta ligada a essa solicitação.';
  end if;
  if exists (select 1 from auth.users where email = p_novo_login) then
    raise exception 'Esse e-mail já está em uso por outra conta.';
  end if;

  update auth.users
    set email = p_novo_login, email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = v_perfil_id;

  update solicitacoes_usuario
    set novo_login = p_novo_login, concluido_em = now()
    where id = p_solicitacao_id;

  return json_build_object('novo_login', p_novo_login);
end;
$$;

grant execute on function rotecheck_criar_solicitacao_usuario(text, text) to anon, authenticated;
grant execute on function rotecheck_ler_solicitacao_usuario(uuid) to anon, authenticated;
grant execute on function rotecheck_trocar_login(uuid, text) to anon, authenticated;

-- Apaga prints de rota (linha da tabela + o arquivo no Storage) com mais
-- de 15 dias. security definer porque quem chama isso é um usuário comum
-- (gerente abrindo a aba Mapa — ver GerenteHome.jsx) que normalmente não
-- teria permissão de apagar o print de OUTRO coletor nem de mexer direto
-- em storage.objects; a função roda com o dono (bypassa RLS) só pra essa
-- faxina específica. Também é chamada automaticamente todo dia pelo
-- pg_cron agendado logo abaixo, então a limpeza não depende de alguém
-- abrir o app.
create or replace function rotecheck_limpar_prints_antigos()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  delete from storage.objects
    where bucket_id = 'prints-rotas'
      and created_at < now() - interval '15 days';

  delete from prints_rotas
    where criado_em < now() - interval '15 days';
end;
$$;

grant execute on function rotecheck_papel_aprovado() to anon, authenticated;
grant execute on function rotecheck_existe_gerente_aprovado() to anon, authenticated;
grant execute on function rotecheck_verificar_convite(text) to anon, authenticated;
grant execute on function rotecheck_cadastrar_via_convite(text, text, text) to authenticated;
grant execute on function rotecheck_cadastrar_primeiro_gerente(text, text) to authenticated;
grant execute on function rotecheck_atualizar_roteiro(uuid[], jsonb) to authenticated;
grant execute on function rotecheck_limpar_prints_antigos() to authenticated;

-- Agendamento automático (recomendado, opcional): roda a limpeza todo dia
-- de madrugada sozinha, sem depender de ninguém abrir o app. Precisa da
-- extensão pg_cron ativada no projeto (Database → Extensions, no painel
-- do Supabase) — se não tiver, comente as duas linhas abaixo; a limpeza
-- continua acontecendo de qualquer forma quando o gerente abre a aba
-- Mapa, só que aí depende de alguém abrir o app de vez em quando.
--
-- create extension if not exists pg_cron with schema extensions;
-- select cron.schedule('limpar-prints-rotas-antigos', '30 3 * * *', $$select rotecheck_limpar_prints_antigos();$$);

-- ---------------------------------------------------------------------
-- RLS (Row Level Security) — versão base, ajustar conforme o caso
--
-- Todo "create policy" abaixo vem com um "drop policy if exists" na
-- frente (mesmo quando o nome não mudou), pra este arquivo poder ser
-- rodado de novo com segurança num projeto que já existia — Postgres não
-- tem "create or replace policy".
-- ---------------------------------------------------------------------
alter table perfis enable row level security;
alter table coletas enable row level security;
alter table mensagens enable row level security;
alter table veiculos enable row level security;
alter table rotas enable row level security;
alter table push_subscriptions enable row level security;
alter table notificacoes enable row level security;
alter table posicoes_gps enable row level security;
alter table convites enable row level security;
alter table prints_rotas enable row level security;
alter table paradas_fixas enable row level security;
alter table confirmacoes_parada_fixa enable row level security;
alter table clientes_esperados enable row level security;
alter table solicitacoes_usuario enable row level security;

drop policy if exists "usuario vê e edita o próprio perfil" on perfis;
create policy "usuario vê e edita o próprio perfil"
  on perfis for select using (auth.uid() = id);

-- Sem uma policy de insert, ninguém conseguia criar a própria linha em
-- "perfis" depois de se cadastrar (auth.signUp só cria o login; o perfil
-- é um insert separado, feito pela própria pessoa recém-criada logo em
-- seguida) — toda tela de cadastro (cliente/coletor) dependia disso e
-- ficaria travada sem essa policy. Restrita a "papel in (cliente,
-- coletor)" e "aprovado = false": despachante/gerente só entram pelas
-- funções security definer (convite ou primeiro gerente), que ignoram
-- RLS — sem essa restrição aqui, qualquer pessoa logada conseguiria criar
-- a própria linha já como gerente aprovado direto pela API, sem convite
-- nenhum.
drop policy if exists "usuario cria o próprio perfil" on perfis;
create policy "usuario cria o próprio perfil"
  on perfis for insert
  with check (auth.uid() = id and papel in ('cliente', 'coletor') and aprovado = false);

-- "with check" garante que a pessoa não consegue, nesse mesmo update, se
-- auto-aprovar ou trocar o próprio papel (só telefone/foto/tema/endereço
-- etc.) — quem aprova ou muda o papel de alguém é sempre outra pessoa (um
-- gerente, pela policy "gerente atualiza qualquer perfil" abaixo).
drop policy if exists "usuario atualiza o próprio perfil" on perfis;
create policy "usuario atualiza o próprio perfil"
  on perfis for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and papel = (select p.papel from perfis p where p.id = auth.uid())
    and aprovado = (select p.aprovado from perfis p where p.id = auth.uid())
  );

-- Gerente e despachante (equipe) precisam ver a lista de coletores (pra
-- escolher quem vai buscar cada coleta) e o gerente precisa ver todo
-- mundo na aba "Usuários"/"Aprovações". Só o gerente pode aprovar/trocar
-- o papel ou recusar (apagar) o cadastro de alguém.
drop policy if exists "gerente vê todos os perfis" on perfis;
drop policy if exists "equipe vê todos os perfis" on perfis;
create policy "equipe vê todos os perfis"
  on perfis for select using (rotecheck_papel_aprovado() in ('gerente', 'despachante'));

drop policy if exists "gerente atualiza qualquer perfil" on perfis;
create policy "gerente atualiza qualquer perfil"
  on perfis for update using (rotecheck_papel_aprovado() = 'gerente');

-- Recusar um cadastro pendente apaga a linha de "perfis". O login em
-- auth.users continua existindo (apagar esse de vez exige uma Edge
-- Function com a service role key — fora do escopo por enquanto), então
-- por enquanto uma conta recusada não consegue recadastrar com o mesmo
-- e-mail/usuário.
drop policy if exists "gerente remove qualquer perfil" on perfis;
create policy "gerente remove qualquer perfil"
  on perfis for delete using (rotecheck_papel_aprovado() = 'gerente');

drop policy if exists "cliente vê suas coletas" on coletas;
create policy "cliente vê suas coletas"
  on coletas for select using (
    cliente_id = auth.uid() or coletor_id = auth.uid()
    or rotecheck_papel_aprovado() in ('gerente', 'despachante')
  );
drop policy if exists "cliente cria coleta" on coletas;
create policy "cliente cria coleta"
  on coletas for insert with check (cliente_id = auth.uid());
-- Gerente e despachante aceitam/recusam (e atribuem o coletor); o próprio
-- coletor atualiza a coleta que é dele (status coletada, foto etc.).
drop policy if exists "gerente e coletor atualizam coleta" on coletas; -- nome usado numa versão anterior deste arquivo
drop policy if exists "equipe e coletor atualizam coleta" on coletas;
create policy "equipe e coletor atualizam coleta"
  on coletas for update using (
    coletor_id = auth.uid()
    or rotecheck_papel_aprovado() in ('gerente', 'despachante')
  );

-- Chat por coleta: cliente dono da coleta + equipe (gerente/despachante).
-- Chat por coletor: o próprio coletor + equipe. Nunca existe comunicação
-- direta entre cliente e coletor em nenhum dos dois.
drop policy if exists "cliente e equipe veem as mensagens da coleta" on mensagens;
create policy "cliente e equipe veem as mensagens da coleta"
  on mensagens for select using (
    exists (select 1 from coletas c where c.id = coleta_id and c.cliente_id = auth.uid())
    or coletor_id = auth.uid()
    or rotecheck_papel_aprovado() in ('gerente', 'despachante')
  );
drop policy if exists "cliente e equipe enviam mensagem na coleta" on mensagens;
create policy "cliente e equipe enviam mensagem na coleta"
  on mensagens for insert with check (
    remetente_id = auth.uid()
    and (
      exists (select 1 from coletas c where c.id = coleta_id and c.cliente_id = auth.uid())
      or coletor_id = auth.uid()
      or rotecheck_papel_aprovado() in ('gerente', 'despachante')
    )
  );

-- Frota: qualquer pessoa logada pode consultar (útil pro despachante ver o
-- que está disponível), só o gerente cadastra/edita/remove veículos.
drop policy if exists "usuarios logados veem a frota" on veiculos;
create policy "usuarios logados veem a frota"
  on veiculos for select using (auth.uid() is not null);
drop policy if exists "gerente gerencia a frota" on veiculos;
create policy "gerente gerencia a frota"
  on veiculos for insert with check (rotecheck_papel_aprovado() = 'gerente');
drop policy if exists "gerente atualiza a frota" on veiculos;
create policy "gerente atualiza a frota"
  on veiculos for update using (rotecheck_papel_aprovado() = 'gerente');
drop policy if exists "gerente remove da frota" on veiculos;
create policy "gerente remove da frota"
  on veiculos for delete using (rotecheck_papel_aprovado() = 'gerente');

-- Rotas: o coletor só vê a própria rota do dia; gerente/despachante veem e
-- montam a rota de qualquer coletor.
drop policy if exists "coletor ve a propria rota" on rotas;
create policy "coletor ve a propria rota"
  on rotas for select using (
    coletor_id = auth.uid()
    or rotecheck_papel_aprovado() in ('gerente', 'despachante')
  );
drop policy if exists "gerente e despachante montam rotas" on rotas;
create policy "gerente e despachante montam rotas"
  on rotas for insert with check (rotecheck_papel_aprovado() in ('gerente', 'despachante'));
drop policy if exists "gerente e despachante editam rotas" on rotas;
create policy "gerente e despachante editam rotas"
  on rotas for update using (rotecheck_papel_aprovado() in ('gerente', 'despachante'));

drop policy if exists "usuario gerencia a própria subscription de push" on push_subscriptions;
create policy "usuario gerencia a própria subscription de push"
  on push_subscriptions for all using (user_id = auth.uid());

drop policy if exists "usuario vê as próprias notificações" on notificacoes;
create policy "usuario vê as próprias notificações"
  on notificacoes for select using (user_id = auth.uid());

drop policy if exists "coletor registra a própria posição" on posicoes_gps;
create policy "coletor registra a própria posição"
  on posicoes_gps for insert with check (coletor_id = auth.uid());
drop policy if exists "gerente/despachante e o próprio coletor veem posições" on posicoes_gps;
create policy "gerente/despachante e o próprio coletor veem posições"
  on posicoes_gps for select using (
    coletor_id = auth.uid()
    or rotecheck_papel_aprovado() in ('gerente', 'despachante')
  );

-- Convites: só o gerente gera/lista/cancela — quem usa um convite não
-- acessa esta tabela diretamente, só através de rotecheck_verificar_convite
-- e rotecheck_cadastrar_via_convite (security definer), que ignoram RLS.
drop policy if exists "gerente gerencia convites" on convites;
create policy "gerente gerencia convites"
  on convites for all
  using (rotecheck_papel_aprovado() = 'gerente')
  with check (rotecheck_papel_aprovado() = 'gerente');

-- Prints de rota: só o próprio coletor grava (ao finalizar uma saída), só
-- o próprio coletor e o gerente veem — despachante fica de fora aqui de
-- propósito, igual combinado pro mapa: despachante só acompanha ao vivo,
-- quem revisita histórico (mapa OU prints) é o gerente.
drop policy if exists "coletor grava os próprios prints de rota" on prints_rotas;
create policy "coletor grava os próprios prints de rota"
  on prints_rotas for insert with check (coletor_id = auth.uid());
-- Despachante passou a ver os prints também (antes só gerente) — pedido
-- do Felipe pra acompanhar o fim do expediente de cada coletor direto do
-- perfil dele, sem depender do gerente repassar.
drop policy if exists "coletor e gerente veem prints de rota" on prints_rotas;
drop policy if exists "coletor, despachante e gerente veem prints de rota" on prints_rotas;
create policy "coletor, despachante e gerente veem prints de rota"
  on prints_rotas for select using (
    coletor_id = auth.uid()
    or rotecheck_papel_aprovado() in ('gerente', 'despachante')
  );

-- Paradas fixas (roteiro semanal): despachante e gerente cadastram e
-- editam; o próprio coletor só enxerga as suas (pra ver seu roteiro no
-- celular, se algum dia precisar), sem poder mudar nada.
drop policy if exists "despachante e gerente gerenciam paradas fixas" on paradas_fixas;
create policy "despachante e gerente gerenciam paradas fixas"
  on paradas_fixas for all
  using (rotecheck_papel_aprovado() in ('despachante', 'gerente'))
  with check (rotecheck_papel_aprovado() in ('despachante', 'gerente'));
drop policy if exists "coletor vê as próprias paradas fixas" on paradas_fixas;
create policy "coletor vê as próprias paradas fixas"
  on paradas_fixas for select using (coletor_id = auth.uid());

-- Confirmações de parada fixa: o coletor cria/lê só as suas próprias (é
-- ele quem confirma, na hora, tirando a foto). Despachante e gerente agora
-- também podem marcar "sem coleta hoje" de longe (sem precisar o coletor
-- passar no local) — por isso passaram de só leitura ("for select") pra
-- acesso completo ("for all"), igual ao coletor; coletor_id continua sendo
-- de qual coletor é a parada (não quem marcou — isso é o marcado_por).
drop policy if exists "coletor confirma as próprias paradas fixas" on confirmacoes_parada_fixa;
create policy "coletor confirma as próprias paradas fixas"
  on confirmacoes_parada_fixa for all
  using (coletor_id = auth.uid())
  with check (coletor_id = auth.uid());
drop policy if exists "despachante e gerente veem confirmações de paradas fixas" on confirmacoes_parada_fixa;
drop policy if exists "despachante e gerente marcam confirmações de paradas fixas" on confirmacoes_parada_fixa;
create policy "despachante e gerente marcam confirmações de paradas fixas"
  on confirmacoes_parada_fixa for all
  using (rotecheck_papel_aprovado() in ('despachante', 'gerente'))
  with check (rotecheck_papel_aprovado() in ('despachante', 'gerente'));

-- Clientes esperados: qualquer pessoa logada pode LER (o cliente precisa
-- disso pra checar se o nome do estabelecimento dele bate com algum e
-- mostrar o aviso de moto em "Nova coleta"); só despachante/gerente
-- cadastram/editam/apagam.
drop policy if exists "qualquer logado vê clientes esperados" on clientes_esperados;
create policy "qualquer logado vê clientes esperados"
  on clientes_esperados for select using (auth.uid() is not null);
drop policy if exists "despachante e gerente gerenciam clientes esperados" on clientes_esperados;
create policy "despachante e gerente gerenciam clientes esperados"
  on clientes_esperados for all
  using (rotecheck_papel_aprovado() in ('despachante', 'gerente'))
  with check (rotecheck_papel_aprovado() in ('despachante', 'gerente'));

-- Solicitações de usuário esquecido: só a equipe (gerente/despachante) lê
-- e decide (aceita/recusa) pela tela AbaSolicitacoesUsuario.jsx. Quem cria
-- a solicitação e quem troca o próprio login NÃO acessa esta tabela
-- direto (está deslogado) — passa pelas funções security definer acima,
-- que ignoram RLS.
drop policy if exists "equipe ve e decide solicitacoes de usuario" on solicitacoes_usuario;
create policy "equipe ve e decide solicitacoes de usuario"
  on solicitacoes_usuario for all
  using (rotecheck_papel_aprovado() in ('gerente', 'despachante'))
  with check (rotecheck_papel_aprovado() in ('gerente', 'despachante'));

-- Storage do bucket `prints-rotas` (crie-o pelo painel, igual os outros
-- dois — ver README) — sem isso, o upload do print pelo coletor falha
-- com "new row violates row-level security policy" mesmo o bucket sendo
-- público, já que "público" só libera a LEITURA do arquivo, não quem
-- pode enviar. O caminho usado no upload é sempre "<coletor_id>/...",
-- então basta conferir que a primeira pasta do caminho é o próprio uid.
drop policy if exists "coletor envia print pra própria pasta" on storage.objects;
create policy "coletor envia print pra própria pasta"
  on storage.objects for insert
  with check (bucket_id = 'prints-rotas' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "qualquer um lê prints-rotas (bucket público)" on storage.objects;
create policy "qualquer um lê prints-rotas (bucket público)"
  on storage.objects for select using (bucket_id = 'prints-rotas');
