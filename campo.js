const SUPABASE_URL = "https://vgqxnsyqrzyqjyvrlvou.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZncXhuc3lxcnp5cWp5dnJsdm91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDM1MTEsImV4cCI6MjEwODM3OTUxMX0.eEtPPNDWUaHAQxvoLIeA_Ag6RGW_TEMhoZ5wV65GX7Q";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ID_NUVEM_USUARIOS  = 999999001;
const ID_NUVEM_EQUIPES   = 999999002;
const ID_NUVEM_OPCOES    = 999999003;
const ID_NUVEM_RASTREIO  = 999999004;
const ID_NUVEM_AUDITORIA = 999999005;

const LIMITE_TOTAL_SUPABASE_MB = 500;
const ORDEM_SETORES = ["Vistoriador", "Instalador", "Ativador"];

// ================= ITEM 01: ESTRUTURA DINÂMICA E EDITÁVEL DE GRUPOS E PROJETOS =================

const CATALOGO_PROJETOS_PADRAO = [
    { nome: "VISTORIA", grupo: "ON GOING", setor: "Vistoriador" },
    { nome: "CONSTRUÇÃO F", grupo: "PROJETO F", setor: "Instalador" },
    { nome: "CONSTRUÇÃO ON GOING", grupo: "ON GOING", setor: "Instalador" },
    { nome: "CONSTRUÇÃO NAP LOTADA", grupo: "ON GOING", setor: "Instalador" },
    { nome: "ATIVAÇÃO F", grupo: "PROJETO F", setor: "Ativador" },
    { nome: "ATIVAÇÃO ON GOING", grupo: "ON GOING", setor: "Ativador" },
    { nome: "ATIVAÇÃO NAP LOTADA", grupo: "ON GOING", setor: "Ativador" }
];

let GRUPOS_PROJETO_SISTEMA = JSON.parse(localStorage.getItem('gpd_grupos_projeto')) || [
    "ON GOING",
    "PROJETO F"
];

let CATALOGO_PROJETOS_SISTEMA = JSON.parse(localStorage.getItem('gpd_catalogo_projetos')) || CATALOGO_PROJETOS_PADRAO;

let PROJETOS_POR_SETOR = { "Vistoriador": [], "Instalador": [], "Ativador": [] };
let TODOS_OS_PROJETOS = [];
let PROJETOS_GRUPO_MALLING = [];
let PROJETOS_GRUPO_PROJETO_F = [];

function reconstruirMapasDeProjetosDinamicos() {
    if (!Array.isArray(GRUPOS_PROJETO_SISTEMA) || GRUPOS_PROJETO_SISTEMA.length === 0) {
        GRUPOS_PROJETO_SISTEMA = ["ON GOING", "PROJETO F"];
    }
    if (!Array.isArray(CATALOGO_PROJETOS_SISTEMA) || CATALOGO_PROJETOS_SISTEMA.length === 0) {
        CATALOGO_PROJETOS_SISTEMA = JSON.parse(JSON.stringify(CATALOGO_PROJETOS_PADRAO));
    }

    PROJETOS_POR_SETOR = { "Vistoriador": [], "Instalador": [], "Ativador": [] };
    TODOS_OS_PROJETOS = [];
    PROJETOS_GRUPO_MALLING = [];
    PROJETOS_GRUPO_PROJETO_F = [];

    CATALOGO_PROJETOS_SISTEMA.forEach(item => {
        const nomeLimpo = String(item.nome || "").trim().toUpperCase();
        if (!nomeLimpo) return;
        const grupoLimpo = String(item.grupo || GRUPOS_PROJETO_SISTEMA[0] || "ON GOING").trim().toUpperCase();
        const setorLimpo = ORDEM_SETORES.includes(item.setor) ? item.setor : "Instalador";

        item.nome = nomeLimpo;
        item.grupo = grupoLimpo;
        item.setor = setorLimpo;

        if (!GRUPOS_PROJETO_SISTEMA.includes(grupoLimpo)) {
            GRUPOS_PROJETO_SISTEMA.push(grupoLimpo);
        }

        if (!TODOS_OS_PROJETOS.includes(nomeLimpo)) {
            TODOS_OS_PROJETOS.push(nomeLimpo);
        }
        if (!PROJETOS_POR_SETOR[setorLimpo].includes(nomeLimpo)) {
            PROJETOS_POR_SETOR[setorLimpo].push(nomeLimpo);
        }

        if (grupoLimpo === "ON GOING") {
            PROJETOS_GRUPO_MALLING.push(nomeLimpo);
        } else {
            PROJETOS_GRUPO_PROJETO_F.push(nomeLimpo);
        }
    });

    localStorage.setItem('gpd_grupos_projeto', JSON.stringify(GRUPOS_PROJETO_SISTEMA));
    localStorage.setItem('gpd_catalogo_projetos', JSON.stringify(CATALOGO_PROJETOS_SISTEMA));
    popularSelectProjetosGlobal();
}

function popularSelectProjetosGlobal() {
    // 1. Atualiza o filtro de Projetos no cabeçalho azul do Gestor
    const selFiltroProj = document.getElementById('gestor-filtro-projeto');
    if (selFiltroProj) {
        const valAtual = selFiltroProj.value;
        let html = `<option value="">🏗️ Todos os Projetos</option>`;
        GRUPOS_PROJETO_SISTEMA.forEach(grp => {
            const projsDoGrupo = CATALOGO_PROJETOS_SISTEMA.filter(p => p.grupo === grp);
            if (projsDoGrupo.length > 0) {
                html += `<optgroup label="Grupo ${grp}">` +
                    projsDoGrupo.map(p => `<option value="${p.nome}">${p.nome} (${p.setor})</option>`).join('') +
                    `</optgroup>`;
            }
        });
        selFiltroProj.innerHTML = html;
        if (valAtual && TODOS_OS_PROJETOS.includes(valAtual)) {
            selFiltroProj.value = valAtual;
        }
    }

    // 2. Atualiza o select de Projetos dentro do Super Modal de Edição
    const selEditProj = document.getElementById('edit-reg-projeto');
    if (selEditProj) {
        const valEdit = selEditProj.value;
        let htmlEdit = "";
        GRUPOS_PROJETO_SISTEMA.forEach(grp => {
            const projsDoGrupo = CATALOGO_PROJETOS_SISTEMA.filter(p => p.grupo === grp);
            if (projsDoGrupo.length > 0) {
                htmlEdit += `<optgroup label="Grupo ${grp}">` +
                    projsDoGrupo.map(p => `<option value="${p.nome}">${p.nome} (${p.setor})</option>`).join('') +
                    `</optgroup>`;
            }
        });
        htmlEdit += `<option value="IMPREVISTO / ATRASO">IMPREVISTO / ATRASO</option>`;
        selEditProj.innerHTML = htmlEdit;
        if (valEdit) selEditProj.value = valEdit;
    }

    // 3. Atualiza o select de Projetos do Modo Campo caso haja equipe selecionada
    const selEqCampo = document.getElementById('sel-equipe');
    const selProjCampo = document.getElementById('sel-projeto');
    if (selEqCampo && selEqCampo.value && typeof atualizarProjetosPermitidosCampo === "function") {
        atualizarProjetosPermitidosCampo(selEqCampo.value, selProjCampo ? selProjCampo.value : null);
    }
}

const OPCOES_CONCLUIDA_PADRAO = [
    "REDE INTERNA CONCLUÍDA",
    "FUSÃO / CONECTORIZAÇÃO OK",
    "TESTE ÓPTICO APROVADO",
    "CAIXAS IDENTIFICADAS",
    "LIBERADO PARA COMERCIAL"
];

// Detecta se o acesso está sendo feito por um smartphone
function ehDispositivoMovel() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "") || (window.innerWidth <= 768);
}

function obterArraySetores(setorCampo) {
    if (!setorCampo) return ["Instalador"];
    if (Array.isArray(setorCampo)) {
        const limpos = setorCampo.map(s => String(s).trim()).filter(s => ORDEM_SETORES.includes(s));
        return limpos.length > 0 ? ORDEM_SETORES.filter(o => limpos.includes(o)) : ["Instalador"];
    }
    const partes = String(setorCampo).split(/[+,;/|]/).map(s => s.trim()).filter(s => ORDEM_SETORES.includes(s));
    return partes.length > 0 ? ORDEM_SETORES.filter(o => partes.includes(o)) : ["Instalador"];
}

function formatarSetoresString(arrSetores) {
    const validos = obterArraySetores(arrSetores);
    return validos.join(" + ");
}

function tecnicoPertenceAoSetor(setorCampo, setorAlvo) {
    if (!setorAlvo || setorAlvo === 'TODOS') return true;
    return obterArraySetores(setorCampo).includes(setorAlvo);
}

function obterProjetosPermitidosParaSetores(setorCampo) {
    const listaSetores = obterArraySetores(setorCampo);
    const projetosUnicos = new Set();
    listaSetores.forEach(s => {
        (PROJETOS_POR_SETOR[s] || []).forEach(p => projetosUnicos.add(p));
    });
    return Array.from(projetosUnicos);
}

function obterSetorDoProjeto(projeto) {
    const p = normalizarNomeProjeto(projeto);
    const encontrado = CATALOGO_PROJETOS_SISTEMA.find(item => item.nome === p);
    if (encontrado && ORDEM_SETORES.includes(encontrado.setor)) return encontrado.setor;
    if ((PROJETOS_POR_SETOR["Vistoriador"] || []).includes(p)) return "Vistoriador";
    if ((PROJETOS_POR_SETOR["Ativador"] || []).includes(p)) return "Ativador";
    return "Instalador";
}

function normalizarNomeProjeto(projBruto) {
    const p = (projBruto || '').toUpperCase().trim();
    if (p === 'ATIVAÇÃO ON GOIG') return 'ATIVAÇÃO ON GOING';
    if (p === 'CONTRUÇÃO NAP LOTADA' || p === 'NAP LOTADA CONSTRUÇÃO') return 'CONSTRUÇÃO NAP LOTADA';
    if (p === 'NAP LOTADA ATIVAÇÃO') return 'ATIVAÇÃO NAP LOTADA';
    if (p === 'CONSTRUÇÃO') return 'CONSTRUÇÃO ON GOING';
    if (p === 'ATIVAÇÃO') return 'ATIVAÇÃO ON GOING';
    if (p === 'CONSTRUÇÃO + ATIVAÇÃO' || p === 'NAP LOTADA CONSTRUÇÃO + ATIVAÇÃO') return 'CONSTRUÇÃO F';
    return p;
}

function obterMacroGrupoProjeto(projeto) {
    const p = normalizarNomeProjeto(projeto);
    const encontrado = CATALOGO_PROJETOS_SISTEMA.find(item => item.nome === p);
    if (encontrado && encontrado.grupo) return encontrado.grupo;
    if (PROJETOS_GRUPO_PROJETO_F.includes(p)) return "PROJETO F";
    if (PROJETOS_GRUPO_MALLING.includes(p)) return "ON GOING";
    return GRUPOS_PROJETO_SISTEMA[0] || "OUTROS";
}

function obterBadgeSetorHtml(setorCampo) {
    const lista = obterArraySetores(setorCampo);
    return `<div class="flex flex-wrap gap-1">` + lista.map(setor => {
        if (setor === 'Vistoriador') {
            return `<span class="bg-purple-100 text-purple-900 border border-purple-300 font-bold px-2 py-0.5 rounded text-[10px]">🔍 Vistoriador</span>`;
        }
        if (setor === 'Ativador') {
            return `<span class="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]">⚡ Ativador</span>`;
        }
        return `<span class="bg-blue-100 text-blue-900 border border-blue-300 font-bold px-2 py-0.5 rounded text-[10px]">🛠️ Instalador</span>`;
    }).join('') + `</div>`;
}

let OPCOES_PENDENCIA_PADRAO = JSON.parse(localStorage.getItem('gpd_opcoes_pendencia')) || [
    "REDE CORRETIVA",
    "ACESSO PARCIAL",
    "AGUARDANDO SÍNDICO / CLIENTE",
    "OBSTRUÇÃO INTERNA / PRUMADA",
    "FALTA DE TEMPO HÁBIL",
    "OUTROS"
];

let OPCOES_MALOGRO_PADRAO = JSON.parse(localStorage.getItem('gpd_opcoes_malogro')) || [
    "REDE CORRETIVA",
    "FROTA",
    "MATERIAL",
    "FINANCEIRO",
    "EQUIPAMENTOS",
    "ACESSO",
    "PROJETO",
    "REDE EXTERNA",
    "INFRAESTRUTURA",
    "ÁREA DE RISCO"
];

let OPCOES_IMPREVISTO_PADRAO = JSON.parse(localStorage.getItem('gpd_opcoes_imprevisto')) || [
    "CARRO COM DEFEITO",
    "FALTA DE MATERIAL",
    "FALTA DE EQUIPAMENTO",
    "SEM ATIVIDADE PROGRAMADA",
    "SEM TEMPO HÁBIL",
    "AGUARDANDO LIBERAÇÃO / BASE"
];

// Inicializa os mapas dinâmicos de projetos logo na carga do script
reconstruirMapasDeProjetosDinamicos();

const listaEquipesInicial = [
    "ANDREO FAGUNDES",
    "BRUNO MARCUS CORREA FERNANDES",
    "BRUNO SOARES DA SILVA",
    "CESAR SALES ROSA",
    "DIEGO LEMOS RIBEIRO",
    "ELDER DE OLIVEIRA MARTINS",
    "EWERTON LOPES DA SILVA",
    "FELIPE BAPTISTA FERREIRA",
    "HEVERTON ALESSANDRO RODRIGUES GUSMAO",
    "IGOR DA SILVA ALVES JANUARIO",
    "LEONARDO LISBOA BANDEIRA",
    "LUCIANO SANTOS FERREIRA",
    "MAICON LUIZ DE OLIVEIRA COSTA",
    "MARCIO VIEIRA PINTO",
    "MARCOS VINICIUS CARDOSO DE ARAUJO",
    "MARCOS VINICIUS SANTOS DA SILVA",
    "MATHEUS FRANCINI ALMEIDA",
    "MATHEUS MAGNO FERREIRA DA ROCHA",
    "PAULO CESAR FERNANDES JUNIOR",
    "PAULO RICARDO MATOLLA DE FIGUEIREDO SOARES",
    "TIAGO SILVA DE PAULA",
    "WEVERTON OTACILIO DA SILVA VERAS",
    "WILSON JOSÉ DE SOUSA JUNIOR"
];

let equipesSistema = JSON.parse(localStorage.getItem('gpd_equipes_cadastradas')) || listaEquipesInicial.map((nome, index) => ({
    id: index + 1,
    nome: nome,
    setor: "Instalador",
    status: "Ativo",
    pin: "1234"
}));

equipesSistema = equipesSistema.map(eq => ({
    ...eq,
    setor: formatarSetoresString(eq.setor || "Instalador"),
    pin: (eq.pin && String(eq.pin).trim().length >= 4) ? String(eq.pin).trim() : "1234"
}));

let telemetriaEquipes = JSON.parse(localStorage.getItem('gpd_telemetria_equipes')) || {};

let dadosAtendimento = { 
    idEmAndamento: null, 
    eraReaberta: false, 
    eraProgramada: false, 
    hEntrada: null, 
    hSaida: null, 
    gpsEntrada: null, 
    gpsSaida: null, 
    emPausa: false,
    inicioPausa: null,
    motivoPausaAtual: "",
    minutosPausados: 0,
    blocos: [] 
};

let registrosSalvos = [];
let usuariosSistema = JSON.parse(localStorage.getItem('gpd_usuarios_cadastrados')) || [
    { id: 1, nome: "Leonardo Simões de Almeida", email: "lsimoes@procisa.com.br", senha: "Leo290301@", nivel: "Master", status: "Ativo" }
];
let trilhaAuditoria = JSON.parse(localStorage.getItem('gpd_trilha_auditoria')) || [];
let usuarioLogado = sessionStorage.getItem('gpd_user_logado') || null;
let nivelUsuarioLogado = "Visualizador";
let equipeAutenticadaSessao = sessionStorage.getItem('gpd_equipe_autenticada_pin') || "";
let idsNotificadosNoCelular = new Set();

let graficoPrincipalExecutoresInstancia = null;
let graficoGrupoMallingInstancia = null;
let graficoGrupoProjetoFInstancia = null;
let graficoEvolucaoGruposInstancia = null;
let graficoProjetosInstancia = null;
let graficoDesfechosInstancia = null;
let graficoHorasPicoInstancia = null;
let graficoTempoProjetoInstancia = null;
let graficoOfensoresMalogroInstancia = null;
let graficoExpandidoInstancia = null;

let dadosFiltradosAtuais = [];
let listaImprevistosAtuais = [];
let ultimoResumoCampoTexto = "";
let itemDetalheAtualModal = null;
let totaisFinanceirosAtuais = null;

const TABELA_PRECOS = {
    "VISTORIA": { codigo: "1.01", desc: "VISTORIA", unidade: "Bloco", valor: 167.52 },
    "PROJETO ÓPTICO": { codigo: "1.02", desc: "PROJETO ÓPTICO", unidade: "Bloco", valor: 159.58 },
    "CABO RL": { codigo: "1.03", desc: "CABO RISE (RL)", unidade: "Metro", valor: 5.38 },
    "CONECTORES": { codigo: "1.04", desc: "CONECTORIZAÇÃO", unidade: "Andar", valor: 10.93 },
    "FUSÕES": { codigo: "1.05", desc: "FUSÕES", unidade: "Fusão", valor: 84.77 },
    "EMENDA MECÂNICA": { codigo: "1.06", desc: "EMENDA MECÂNICA", unidade: "Emenda", valor: 15.40 },
    "CABO DROP": { codigo: "1.07", desc: "CABO DROP MDU", unidade: "Metro", valor: 6.41 },
    "NAP": { codigo: "1.08", desc: "NAP MDU", unidade: "Unidade", valor: 38.15 },
    "DIO": { codigo: "1.09", desc: "DIO", unidade: "Unidade", valor: 44.68 },
    "CX SOBREPOR": { codigo: "1.10", desc: "INSTALAÇÃO DE CAIXA - SOPREPOR", unidade: "Unidade", valor: 83.76 },
    "CX EMBUTIDA": { codigo: "1.11", desc: "INSTALAÇÃO DE CAIXA - EMBUTIDA", unidade: "Unidade", valor: 150.76 }
};

function obterPinDaEquipe(eqObj) {
    return (eqObj && eqObj.pin && String(eqObj.pin).trim().length >= 4) ? String(eqObj.pin).trim() : "1234";
}

function atualizarBarraSegurancaPinCampo() {
    const selEq = document.getElementById('sel-equipe');
    const barraPin = document.getElementById('barra-seguranca-pin-campo');
    if (!selEq || !barraPin) return;

    if (selEq.value && equipeAutenticadaSessao === selEq.value) {
        selEq.disabled = true;
        selEq.classList.add('bg-slate-100', 'font-bold', 'text-blue-950');
        barraPin.classList.remove('hidden');
        barraPin.innerHTML = `
            <span class="text-emerald-800 font-bold flex items-center gap-1">🔒 PIN Autenticado</span>
            <div class="flex items-center gap-1.5">
                <button type="button" onclick="alterarPinPeloTecnicoCampo()" class="bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold px-2 py-0.5 rounded border border-blue-300 transition">
                    🔑 Alterar Meu PIN
                </button>
                <button type="button" onclick="desbloquearTrocaEquipeCampo()" class="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded border border-red-200 transition">
                    🚪 Sair
                </button>
            </div>
        `;
    } else {
        selEq.disabled = false;
        selEq.classList.remove('bg-slate-100', 'font-bold', 'text-blue-950');
        barraPin.classList.add('hidden');
    }
}

function tocarAlertaSonoroCelular() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        const tocarNota = (freq, inicio, duracao) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + inicio);
            gain.gain.setValueAtTime(0.22, ctx.currentTime + inicio);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + duracao);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + inicio);
            osc.stop(ctx.currentTime + inicio + duracao);
        };

        tocarNota(659.25, 0, 0.16);
        tocarNota(880.00, 0.18, 0.28);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch (e) {
        console.warn("Aviso de áudio:", e);
    }
}

async function sincronizarUsuariosNaNuvem() {
    try {
        if (!usuariosSistema.some(u => u.email.toLowerCase() === "lsimoes@procisa.com.br")) {
            usuariosSistema.unshift({ id: 1, nome: "Leonardo Simões de Almeida", email: "lsimoes@procisa.com.br", senha: "Leo290301@", nivel: "Master", status: "Ativo" });
        }
        localStorage.setItem('gpd_usuarios_cadastrados', JSON.stringify(usuariosSistema));

        const payloadConfig = {
            id: ID_NUVEM_USUARIOS,
            data_registro: "2000-01-01",
            equipe: "__CONFIG_SISTEMA__",
            membros: "__CONFIG_SISTEMA__",
            projeto: "__CONFIG_USUARIOS__",
            imovel: "__CONFIG_USUARIOS__",
            h_entrada: "00:00",
            h_saida: "00:00",
            gps_entrada: "",
            gps_saida: "",
            desfecho: "CONFIG",
            motivo_desfecho: "",
            malogros: [],
            agendamento: null,
            observacoes: JSON.stringify(usuariosSistema)
        };

        await supabaseClient.from('registros_producao').upsert([payloadConfig], { onConflict: 'id' });
    } catch (e) {
        console.warn("Aviso ao sincronizar usuários na nuvem:", e);
    }
}

async function sincronizarEquipesNaNuvem() {
    try {
        equipesSistema.sort((a, b) => a.nome.localeCompare(b.nome));
        localStorage.setItem('gpd_equipes_cadastradas', JSON.stringify(equipesSistema));

        const payloadConfig = {
            id: ID_NUVEM_EQUIPES,
            data_registro: "2000-01-01",
            equipe: "__CONFIG_SISTEMA__",
            membros: "__CONFIG_SISTEMA__",
            projeto: "__CONFIG_EQUIPES__",
            imovel: "__CONFIG_EQUIPES__",
            h_entrada: "00:00",
            h_saida: "00:00",
            gps_entrada: "",
            gps_saida: "",
            desfecho: "CONFIG",
            motivo_desfecho: "",
            malogros: [],
            agendamento: null,
            observacoes: JSON.stringify(equipesSistema)
        };

        await supabaseClient.from('registros_producao').upsert([payloadConfig], { onConflict: 'id' });
    } catch (e) {
        console.warn("Aviso ao sincronizar equipes na nuvem:", e);
    }
}

async function sincronizarOpcoesNaNuvem() {
    try {
        reconstruirMapasDeProjetosDinamicos();
        localStorage.setItem('gpd_opcoes_pendencia', JSON.stringify(OPCOES_PENDENCIA_PADRAO));
        localStorage.setItem('gpd_opcoes_malogro', JSON.stringify(OPCOES_MALOGRO_PADRAO));
        localStorage.setItem('gpd_opcoes_imprevisto', JSON.stringify(OPCOES_IMPREVISTO_PADRAO));

        const pacoteOpcoes = {
            pendencia: OPCOES_PENDENCIA_PADRAO,
            malogro: OPCOES_MALOGRO_PADRAO,
            imprevisto: OPCOES_IMPREVISTO_PADRAO,
            gruposProjeto: GRUPOS_PROJETO_SISTEMA,
            catalogoProjetos: CATALOGO_PROJETOS_SISTEMA
        };

        const payloadConfig = {
            id: ID_NUVEM_OPCOES,
            data_registro: "2000-01-01",
            equipe: "__CONFIG_SISTEMA__",
            membros: "__CONFIG_SISTEMA__",
            projeto: "__CONFIG_OPCOES__",
            imovel: "__CONFIG_OPCOES__",
            h_entrada: "00:00",
            h_saida: "00:00",
            gps_entrada: "",
            gps_saida: "",
            desfecho: "CONFIG",
            motivo_desfecho: "",
            malogros: [],
            agendamento: null,
            observacoes: JSON.stringify(pacoteOpcoes)
        };

        await supabaseClient.from('registros_producao').upsert([payloadConfig], { onConflict: 'id' });
        popularSelectImprevistos();
    } catch (e) {
        console.warn("Aviso ao sincronizar opções na nuvem:", e);
    }
}

async function sincronizarTelemetriaNaNuvem(nomeEquipe = null, dadosEquipe = null) {
    try {
        const { data } = await supabaseClient
            .from('registros_producao')
            .select('observacoes')
            .eq('id', ID_NUVEM_RASTREIO)
            .maybeSingle();

        let mapaNuvem = {};
        if (data && data.observacoes) {
            try {
                mapaNuvem = JSON.parse(data.observacoes) || {};
            } catch (e) {
                mapaNuvem = {};
            }
        }

        telemetriaEquipes = { ...mapaNuvem, ...telemetriaEquipes };
        if (nomeEquipe && dadosEquipe) {
            telemetriaEquipes[nomeEquipe] = dadosEquipe;
        }

        localStorage.setItem('gpd_telemetria_equipes', JSON.stringify(telemetriaEquipes));

        const payloadRastreio = {
            id: ID_NUVEM_RASTREIO,
            data_registro: "2000-01-01",
            equipe: "__CONFIG_SISTEMA__",
            membros: "__CONFIG_SISTEMA__",
            projeto: "__CONFIG_RASTREIO__",
            imovel: "__CONFIG_RASTREIO__",
            h_entrada: "00:00",
            h_saida: "00:00",
            gps_entrada: "",
            gps_saida: "",
            desfecho: "CONFIG",
            motivo_desfecho: "",
            malogros: [],
            agendamento: null,
            observacoes: JSON.stringify(telemetriaEquipes)
        };

        await supabaseClient.from('registros_producao').upsert([payloadRastreio], { onConflict: 'id' });
    } catch (e) {
        console.warn("Aviso ao sincronizar telemetria GPS na nuvem:", e);
    }
}

function popularSelectImprevistos() {
    const sel = document.getElementById('sel-motivo-imprevisto');
    if (!sel) return;
    sel.innerHTML = OPCOES_IMPREVISTO_PADRAO.map(op => `<option value="${op}">⚠️ ${op}</option>`).join('');

    let boxMulti = document.getElementById('box-multi-imprevistos');
    if (!boxMulti) {
        sel.classList.add('hidden');
        boxMulti = document.createElement('div');
        boxMulti.id = 'box-multi-imprevistos';
        boxMulti.className = 'grid grid-cols-1 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-300 max-h-44 overflow-y-auto text-xs';
        sel.parentNode.insertBefore(boxMulti, sel.nextSibling);
    }
    boxMulti.innerHTML = OPCOES_IMPREVISTO_PADRAO.map((op, i) => `
        <label class="flex items-center gap-2 font-bold text-slate-700 cursor-pointer hover:bg-amber-50 p-1 rounded">
            <input type="checkbox" name="chk-motivo-imprevisto" value="${op}" ${i === 0 ? 'checked' : ''} class="w-4 h-4 accent-amber-600 rounded">
            <span>⚠️ ${op}</span>
        </label>
    `).join('');
}

// ================= ITEM 04: MEDIDOR DE CAPACIDADE LIVRE E OCUPADA DA NUVEM (500 MB) =================

function calcularEstatisticasArmazenamentoNuvem() {
    try {
        const bytesRegistros = JSON.stringify(registrosSalvos || []).length;
        const bytesConfigs   = JSON.stringify(usuariosSistema || []).length +
                               JSON.stringify(equipesSistema || []).length +
                               JSON.stringify(telemetriaEquipes || {}).length +
                               JSON.stringify(trilhaAuditoria || []).length;
        const totalBytes = bytesRegistros + bytesConfigs;
        const usadoMB = Number((totalBytes / (1024 * 1024)).toFixed(2));
        const livreMB = Number(Math.max(0, LIMITE_TOTAL_SUPABASE_MB - usadoMB).toFixed(2));
        const percentual = Number(Math.min(100, (usadoMB / LIMITE_TOTAL_SUPABASE_MB) * 100).toFixed(1));
        const totalFotos = (registrosSalvos || []).reduce((acc, r) => acc + (Array.isArray(r.fotos) ? r.fotos.length : 0), 0);

        return { usadoMB, livreMB, percentual, totalRegistros: (registrosSalvos || []).length, totalFotos };
    } catch (e) {
        return { usadoMB: 0, livreMB: LIMITE_TOTAL_SUPABASE_MB, percentual: 0, totalRegistros: 0, totalFotos: 0 };
    }
}

function renderizarPainelCapacidadeNuvem() {
    const stats = calcularEstatisticasArmazenamentoNuvem();

    let corBarra = "bg-emerald-600";
    let corBoxAlerta = "bg-emerald-50 border-emerald-300 text-emerald-950";
    let msgRecomendacao = "✅ Capacidade Segura: O banco de dados está operando com ampla folga de armazenamento.";

    if (stats.percentual >= 85) {
        corBarra = "bg-red-600 animate-pulse";
        corBoxAlerta = "bg-red-100 border-red-400 text-red-950";
        msgRecomendacao = "🚨 ALERTA CRÍTICO DE CAPACIDADE (≥ 85%): Recomendamos IMEDIATAMENTE baixar o '📦 Backup Integral (.JSON)' na Central Master abaixo e clicar em '🧹 Limpar Só Fotos' para evitar lentidão ou bloqueio dos 500 MB da nuvem!";
    } else if (stats.percentual >= 70) {
        corBarra = "bg-amber-500";
        corBoxAlerta = "bg-amber-100 border-amber-400 text-amber-950";
        msgRecomendacao = "⚠️ ATENÇÃO PREVENTIVA (≥ 70%): O uso da nuvem está se aproximando do limite. Programe o download de um Backup (.JSON) e a limpeza de fotos de meses anteriores em breve.";
    }

    const htmlPainel = `
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
            <div>
                <h4 class="font-black text-slate-800 text-xs uppercase flex items-center gap-1.5">
                    ☁️ Monitoramento de Capacidade de Dados na Nuvem (Limite Supabase: ${LIMITE_TOTAL_SUPABASE_MB} MB)
                </h4>
                <p class="text-[11px] text-slate-500">
                    Total atual: <b>${stats.totalRegistros} registros</b> e <b>${stats.totalFotos} foto(s)</b> armazenadas em banco
                </p>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-xs">
                <span class="bg-blue-100 text-blue-950 border border-blue-300 font-black px-3 py-1 rounded-xl">
                    📦 Ocupado: ${stats.usadoMB} MB (${stats.percentual}%)
                </span>
                <span class="bg-emerald-100 text-emerald-950 border border-emerald-300 font-black px-3 py-1 rounded-xl">
                    🟢 Livre: ${stats.livreMB} MB (${(100 - stats.percentual).toFixed(1)}%)
                </span>
            </div>
        </div>
        <div class="w-full bg-slate-200 rounded-full h-3 overflow-hidden border border-slate-300">
            <div class="${corBarra} h-3 transition-all duration-500" style="width: ${Math.max(2, stats.percentual)}%"></div>
        </div>
        <div class="p-2.5 rounded-xl border text-[11px] font-bold flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${corBoxAlerta}">
            <span>${msgRecomendacao}</span>
            ${nivelUsuarioLogado === 'Master' ? `<button type="button" onclick="mudarSubAbaGestor('opcoes'); document.getElementById('central-master-backup-nuvem')?.scrollIntoView({behavior:'smooth'})" title="Ir direto para a Central de Backup e Limpeza Inteligente" class="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0">💾 Ir p/ Backup & Limpeza</button>` : ''}
        </div>
    `;

    const elOpcoes = document.getElementById('painel-capacidade-opcoes');
    const elAudit  = document.getElementById('painel-capacidade-auditoria');
    if (elOpcoes) elOpcoes.innerHTML = htmlPainel;
    if (elAudit) elAudit.innerHTML = htmlPainel;

    const badgeMaster = document.getElementById('badge-estimativa-peso-nuvem');
    if (badgeMaster) {
        badgeMaster.innerText = `📊 Ocupado: ${stats.usadoMB} MB (${stats.percentual}%) | Livre: ${stats.livreMB} MB`;
    }
}

// ================= ITEM 01: FUNÇÕES DE INCLUSÃO, EDIÇÃO E EXCLUSÃO DE GRUPOS E PROJETOS =================

function renderizarPainelOpcoesSistema() {
    reconstruirMapasDeProjetosDinamicos();
    renderizarPainelCapacidadeNuvem();

    const podeEditar = (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador');

    // 1. Renderiza Lista de Grupos de Projeto
    const contGrupos = document.getElementById('lista-gestao-grupos-projeto');
    if (contGrupos) {
        contGrupos.innerHTML = "";
        GRUPOS_PROJETO_SISTEMA.forEach((grp, idx) => {
            const qtdProjs = CATALOGO_PROJETOS_SISTEMA.filter(p => p.grupo === grp).length;
            const botoes = podeEditar
                ? `<div class="flex gap-1">
                     <button onclick="editarGrupoProjetoSistema(${idx})" title="Renomear este Grupo de Projetos" class="text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded font-bold text-[10px]">✏️ Editar</button>
                     <button onclick="excluirGrupoProjetoSistema(${idx})" title="Excluir este Grupo de Projetos" class="text-red-600 hover:bg-red-50 px-2 py-0.5 rounded font-bold text-[10px]">🗑️</button>
                   </div>`
                : `<span class="text-slate-400 text-[10px]">Leitura</span>`;

            contGrupos.innerHTML += `
                <div class="py-2 flex justify-between items-center hover:bg-indigo-50/40 px-1.5 rounded">
                    <div>
                        <span class="font-black text-indigo-950">${grp}</span>
                        <span class="ml-1.5 text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-semibold">${qtdProjs} projeto(s)</span>
                    </div>
                    ${botoes}
                </div>
            `;
        });
    }

    // 2. Renderiza Lista de Tipos de Projetos / Serviços
    const contProjetos = document.getElementById('lista-gestao-projetos-sistema');
    if (contProjetos) {
        contProjetos.innerHTML = "";
        CATALOGO_PROJETOS_SISTEMA.forEach((proj, idx) => {
            const badgeSetor = obterBadgeSetorHtml(proj.setor);
            const botoes = podeEditar
                ? `<div class="flex gap-1 shrink-0">
                     <button onclick="editarProjetoSistema(${idx})" title="Editar Nome, Grupo ou Setor deste Projeto" class="text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded font-bold text-[10px] border border-blue-200">✏️ Editar</button>
                     <button onclick="excluirProjetoSistema(${idx})" title="Remover este Tipo de Projeto da lista" class="text-red-600 hover:bg-red-50 px-2 py-0.5 rounded font-bold text-[10px] border border-red-200">🗑️</button>
                   </div>`
                : `<span class="text-slate-400 text-[10px]">Leitura</span>`;

            contProjetos.innerHTML += `
                <div class="py-2 flex flex-wrap justify-between items-center gap-2 hover:bg-cyan-50/40 px-1.5 rounded">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-black text-slate-800">${proj.nome}</span>
                        <span class="bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold px-2 py-0.5 rounded text-[9px]">📂 ${proj.grupo}</span>
                        ${badgeSetor}
                    </div>
                    ${botoes}
                </div>
            `;
        });
    }

    // 3. Renderiza Listas de Pendência, Malogro e Imprevisto
    const desenharLista = (arrayOpcoes, tipo, idContainer) => {
        const container = document.getElementById(idContainer);
        if (!container) return;
        container.innerHTML = "";
        arrayOpcoes.forEach((op, idx) => {
            const botoes = podeEditar
                ? `<div class="flex gap-1">
                     <button onclick="editarOpcaoSistema('${tipo}', ${idx})" title="Renomear esta opção" class="text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded font-bold text-[10px]">✏️ Editar</button>
                     <button onclick="excluirOpcaoSistema('${tipo}', ${idx})" title="Excluir esta opção" class="text-red-600 hover:bg-red-50 px-2 py-0.5 rounded font-bold text-[10px]">🗑️</button>
                   </div>`
                : `<span class="text-slate-400 text-[10px]">Leitura</span>`;

            container.innerHTML += `
                <div class="py-2 flex justify-between items-center hover:bg-slate-50 px-1 rounded">
                    <span class="font-bold text-slate-700">${op}</span>
                    ${botoes}
                </div>
            `;
        });
    };

    desenharLista(OPCOES_PENDENCIA_PADRAO, 'pendencia', 'lista-gestao-pendencia');
    desenharLista(OPCOES_MALOGRO_PADRAO, 'malogro', 'lista-gestao-malogro');
    desenharLista(OPCOES_IMPREVISTO_PADRAO, 'imprevisto', 'lista-gestao-imprevisto');
    popularSelectImprevistos();
}

async function adicionarNovoGrupoProjetoSistema() {
    if (nivelUsuarioLogado === 'Visualizador') { alert("⚠️ Permissão insuficiente."); return; }
    const nome = prompt("📂 NOVO GRUPO DE PROJETOS\n\nDigite o nome do novo Grupo (Ex: EXPANSÃO, ESPECIAL, PROJETO G):")?.trim().toUpperCase();
    if (!nome) return;

    if (GRUPOS_PROJETO_SISTEMA.includes(nome)) {
        alert("⚠️ Este grupo já está cadastrado.");
        return;
    }

    GRUPOS_PROJETO_SISTEMA.push(nome);
    registrarLogAuditoria("NOVO GRUPO DE PROJETO", `Criado o grupo de projetos '${nome}'.`);
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
}

async function editarGrupoProjetoSistema(idx) {
    if (nivelUsuarioLogado === 'Visualizador') { alert("⚠️ Permissão insuficiente."); return; }
    const atual = GRUPOS_PROJETO_SISTEMA[idx];
    if (!atual) return;

    const novo = prompt(`✏️ RENOMEAR GRUPO DE PROJETOS\n\nNome atual: ${atual}\nDigite o novo nome para este grupo:`, atual)?.trim().toUpperCase();
    if (!novo || novo === atual) return;

    GRUPOS_PROJETO_SISTEMA[idx] = novo;
    CATALOGO_PROJETOS_SISTEMA.forEach(p => {
        if (p.grupo === atual) p.grupo = novo;
    });

    registrarLogAuditoria("EDIÇÃO DE GRUPO DE PROJETO", `Grupo '${atual}' renomeado para '${novo}'.`);
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
}

async function excluirGrupoProjetoSistema(idx) {
    if (nivelUsuarioLogado === 'Visualizador') { alert("⚠️ Permissão insuficiente."); return; }
    if (GRUPOS_PROJETO_SISTEMA.length <= 1) {
        alert("⚠️ O sistema precisa manter pelo menos 1 grupo de projetos ativo.");
        return;
    }

    const alvo = GRUPOS_PROJETO_SISTEMA[idx];
    const vinculados = CATALOGO_PROJETOS_SISTEMA.filter(p => p.grupo === alvo);

    if (vinculados.length > 0) {
        const outroGrupo = GRUPOS_PROJETO_SISTEMA.find((_, i) => i !== idx) || "ON GOING";
        if (!confirm(`⚠️ O grupo "${alvo}" possui ${vinculados.length} projeto(s) vinculado(s).\n\nSe confirmar a exclusão, esses projetos serão movidos automaticamente para o grupo "${outroGrupo}". Deseja continuar?`)) {
            return;
        }
        CATALOGO_PROJETOS_SISTEMA.forEach(p => {
            if (p.grupo === alvo) p.grupo = outroGrupo;
        });
    } else {
        if (!confirm(`Deseja realmente excluir o grupo "${alvo}"?`)) return;
    }

    GRUPOS_PROJETO_SISTEMA.splice(idx, 1);
    registrarLogAuditoria("EXCLUSÃO DE GRUPO DE PROJETO", `Grupo '${alvo}' removido.`);
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
}

async function adicionarNovoProjetoSistema() {
    if (nivelUsuarioLogado === 'Visualizador') { alert("⚠️ Permissão insuficiente."); return; }

    const nome = prompt("🏗️ NOVO TIPO DE PROJETO / SERVIÇO (Passo 1 de 3)\n\nDigite o nome do novo projeto (Ex: MANUTENÇÃO MDU, VISTORIA F):")?.trim().toUpperCase();
    if (!nome) return;

    if (CATALOGO_PROJETOS_SISTEMA.some(p => p.nome === nome)) {
        alert("⚠️ Já existe um projeto com este nome.");
        return;
    }

    const opcoesGruposTexto = GRUPOS_PROJETO_SISTEMA.map((g, i) => `${i + 1} - ${g}`).join('\n');
    const respGrupo = prompt(`📂 VINCULAR AO GRUPO (Passo 2 de 3)\n\nEscolha o número ou digite o nome do Grupo para "${nome}":\n${opcoesGruposTexto}`, "1")?.trim().toUpperCase();
    if (!respGrupo) return;

    let grupoEscolhido = GRUPOS_PROJETO_SISTEMA[0];
    const numGrp = parseInt(respGrupo, 10);
    if (!isNaN(numGrp) && GRUPOS_PROJETO_SISTEMA[numGrp - 1]) {
        grupoEscolhido = GRUPOS_PROJETO_SISTEMA[numGrp - 1];
    } else if (GRUPOS_PROJETO_SISTEMA.includes(respGrupo)) {
        grupoEscolhido = respGrupo;
    } else {
        grupoEscolhido = respGrupo;
        GRUPOS_PROJETO_SISTEMA.push(grupoEscolhido);
    }

    const respSetor = prompt(
        `👷 FUNÇÃO / SETOR EXECUTOR (Passo 3 de 3)\n\nQual função executa o projeto "${nome}" em campo?\n1 - Vistoriador\n2 - Instalador\n3 - Ativador`,
        "2"
    )?.trim();

    let setorEscolhido = "Instalador";
    if (respSetor === "1" || (respSetor && respSetor.toLowerCase().startsWith("vist"))) setorEscolhido = "Vistoriador";
    else if (respSetor === "3" || (respSetor && respSetor.toLowerCase().startsWith("ativ"))) setorEscolhido = "Ativador";

    CATALOGO_PROJETOS_SISTEMA.push({
        nome: nome,
        grupo: grupoEscolhido,
        setor: setorEscolhido
    });

    registrarLogAuditoria("NOVO PROJETO CADASTRADO", `Projeto '${nome}' adicionado no grupo '${grupoEscolhido}' para o setor '${setorEscolhido}'.`);
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof renderizarTabelaEquipes === "function") renderizarTabelaEquipes();
    if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
}

async function editarProjetoSistema(idx) {
    if (nivelUsuarioLogado === 'Visualizador') { alert("⚠️ Permissão insuficiente."); return; }
    const atual = CATALOGO_PROJETOS_SISTEMA[idx];
    if (!atual) return;

    const novoNome = prompt(`✏️ EDITAR PROJETO (Passo 1 de 3)\n\nNome atual: ${atual.nome}\nDigite o novo nome (ou mantenha o atual):`, atual.nome)?.trim().toUpperCase();
    if (!novoNome) return;

    const opcoesGruposTexto = GRUPOS_PROJETO_SISTEMA.map((g, i) => `${i + 1} - ${g}`).join('\n');
    const respGrupo = prompt(`📂 ALTERAR GRUPO (Passo 2 de 3)\n\nGrupo atual: ${atual.grupo}\nDigite o nome ou número do Grupo:\n${opcoesGruposTexto}`, atual.grupo)?.trim().toUpperCase();
    if (!respGrupo) return;

    let novoGrupo = atual.grupo;
    const numGrp = parseInt(respGrupo, 10);
    if (!isNaN(numGrp) && GRUPOS_PROJETO_SISTEMA[numGrp - 1]) {
        novoGrupo = GRUPOS_PROJETO_SISTEMA[numGrp - 1];
    } else {
        novoGrupo = respGrupo;
        if (!GRUPOS_PROJETO_SISTEMA.includes(novoGrupo)) GRUPOS_PROJETO_SISTEMA.push(novoGrupo);
    }

    const respSetor = prompt(
        `👷 ALTERAR SETOR EXECUTOR (Passo 3 de 3)\n\nSetor atual: ${atual.setor}\n1 - Vistoriador\n2 - Instalador\n3 - Ativador`,
        atual.setor === "Vistoriador" ? "1" : (atual.setor === "Ativador" ? "3" : "2")
    )?.trim();

    let novoSetor = atual.setor;
    if (respSetor === "1" || (respSetor && respSetor.toLowerCase().startsWith("vist"))) novoSetor = "Vistoriador";
    else if (respSetor === "2" || (respSetor && respSetor.toLowerCase().startsWith("inst"))) novoSetor = "Instalador";
    else if (respSetor === "3" || (respSetor && respSetor.toLowerCase().startsWith("ativ"))) novoSetor = "Ativador";

    const nomeAntigo = atual.nome;
    CATALOGO_PROJETOS_SISTEMA[idx] = {
        nome: novoNome,
        grupo: novoGrupo,
        setor: novoSetor
    };

    registrarLogAuditoria("EDIÇÃO DE PROJETO", `Projeto '${nomeAntigo}' atualizado para '${novoNome}' (Grupo: ${novoGrupo} | Setor: ${novoSetor}).`);
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof renderizarTabelaEquipes === "function") renderizarTabelaEquipes();
    if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
}

async function excluirProjetoSistema(idx) {
    if (nivelUsuarioLogado === 'Visualizador') { alert("⚠️ Permissão insuficiente."); return; }
    if (CATALOGO_PROJETOS_SISTEMA.length <= 1) {
        alert("⚠️ O sistema deve possuir pelo menos 1 projeto ativo.");
        return;
    }

    const alvo = CATALOGO_PROJETOS_SISTEMA[idx];
    if (!confirm(`Deseja realmente remover o projeto "${alvo.nome}" (${alvo.grupo}) da lista de opções?`)) return;

    CATALOGO_PROJETOS_SISTEMA.splice(idx, 1);
    registrarLogAuditoria("EXCLUSÃO DE PROJETO", `Projeto '${alvo.nome}' removido do catálogo.`);
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof renderizarTabelaEquipes === "function") renderizarTabelaEquipes();
    if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
}

async function adicionarNovaOpcaoSistema(tipo) {
    if (nivelUsuarioLogado === 'Visualizador') { alert("⚠️ Permissão insuficiente."); return; }
    const nome = prompt("Digite o nome da nova opção:")?.trim().toUpperCase();
    if (!nome) return;

    if (tipo === 'pendencia' && !OPCOES_PENDENCIA_PADRAO.includes(nome)) OPCOES_PENDENCIA_PADRAO.push(nome);
    if (tipo === 'malogro' && !OPCOES_MALOGRO_PADRAO.includes(nome)) OPCOES_MALOGRO_PADRAO.push(nome);
    if (tipo === 'imprevisto' && !OPCOES_IMPREVISTO_PADRAO.includes(nome)) OPCOES_IMPREVISTO_PADRAO.push(nome);

    registrarLogAuditoria("NOVA OPÇÃO CADASTRADA", `Adicionada opção '${nome}' em ${tipo.toUpperCase()}`);
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof renderizarBlocosCampo === "function") renderizarBlocosCampo();
}

async function editarOpcaoSistema(tipo, index) {
    if (nivelUsuarioLogado === 'Visualizador') { alert("⚠️ Permissão insuficiente."); return; }
    let lista = tipo === 'pendencia' ? OPCOES_PENDENCIA_PADRAO : (tipo === 'malogro' ? OPCOES_MALOGRO_PADRAO : OPCOES_IMPREVISTO_PADRAO);
    const atual = lista[index];
    const novo = prompt(`Renomear a opção "${atual}" para:`, atual)?.trim().toUpperCase();
    if (!novo || novo === atual) return;

    lista[index] = novo;
    registrarLogAuditoria("EDIÇÃO DE OPÇÃO", `Opção '${atual}' alterada para '${novo}' (${tipo.toUpperCase()})`);
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof renderizarBlocosCampo === "function") renderizarBlocosCampo();
}

async function excluirOpcaoSistema(tipo, index) {
    if (nivelUsuarioLogado === 'Visualizador') { alert("⚠️ Permissão insuficiente."); return; }
    let lista = tipo === 'pendencia' ? OPCOES_PENDENCIA_PADRAO : (tipo === 'malogro' ? OPCOES_MALOGRO_PADRAO : OPCOES_IMPREVISTO_PADRAO);
    const alvo = lista[index];
    if (!confirm(`Deseja realmente excluir a opção "${alvo}"?`)) return;

    lista.splice(index, 1);
    registrarLogAuditoria("EXCLUSÃO DE OPÇÃO", `Opção '${alvo}' removida de ${tipo.toUpperCase()}`);
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof renderizarBlocosCampo === "function") renderizarBlocosCampo();
}

function obterClasseCorDesfecho(desfecho) {
    const d = (desfecho || '').toUpperCase().trim();
    if (d === 'EM ANDAMENTO') {
        return 'bg-blue-600 text-white border border-blue-700 animate-pulse shadow-sm';
    }
    if (d === 'PARALISADA') {
        return 'bg-orange-500 text-white border border-orange-600 animate-pulse shadow-sm font-black';
    }
    if (d === 'PROGRAMADA') {
        return 'bg-cyan-100 text-cyan-900 border border-cyan-300 font-black';
    }
    if (d === 'REABERTA') {
        return 'bg-purple-600 text-white border border-purple-700 animate-pulse shadow-sm';
    }
    if (d === 'CONCLUIDA' || d === 'CONCLUÍDA' || d === 'IMPREVISTO RESOLVIDO') {
        return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
    }
    if (d === 'PENDENTE' || d === 'IMPREVISTO') {
        return 'bg-amber-100 text-amber-800 border border-amber-300';
    }
    if (d === 'MALOGRADA') {
        return 'bg-red-100 text-red-800 border border-red-300';
    }
    if (d === 'MÚLTIPLO') {
        return 'bg-indigo-100 text-indigo-900 border border-indigo-300 font-black';
    }
    return 'bg-slate-100 text-slate-700 border border-slate-300';
}

function obterDataLocalISO(dateObj = new Date()) {
    return new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}

// ================= INICIALIZAÇÃO INSTANTÂNEA E OTIMIZADA PARA MOBILE =================

window.onload = async function() { 
    const isMobile = ehDispositivoMovel();

    reconstruirMapasDeProjetosDinamicos();
    popularSelectImprevistos();
    popularSelectEquipes();
    verificarPermissoesSessao();
    restaurarRascunhoCampo();

    if (isMobile) {
        const grupoTopo = document.getElementById('grupo-botoes-visao-topo');
        const rodapeMobile = document.getElementById('rodape-acesso-gestor-mobile');
        if (grupoTopo && !usuarioLogado) grupoTopo.classList.add('hidden');
        if (rodapeMobile) rodapeMobile.classList.remove('hidden');
        alternarVisao('campo');
    } else if (usuarioLogado) {
        document.getElementById('badge-usuario-logado').classList.remove('hidden');
        document.getElementById('btn-sair-gestor').classList.remove('hidden');
        document.getElementById('txt-email-ativo').innerText = usuarioLogado;
        document.getElementById('txt-nivel-ativo').innerText = nivelUsuarioLogado;
        alternarVisao('gestor');
    } else {
        alternarVisao('campo');
    }

    if (isMobile || !usuarioLogado) {
        await carregarRegistrosModoCampoLeve();
    } else {
        await carregarRegistrosDaNuvem(true);
    }

    popularSelectEquipes();
    popularSelectProjetosGlobal();
    verificarImprevistoAtivoEquipeCampo();
    verificarPendenciasReabertasEProgramadasCampo(false);
    if (typeof atualizarBarraExpedienteCampo === "function") {
        atualizarBarraExpedienteCampo();
    }
    if (typeof atualizarAbaMinhasAtividadesCampo === "function") {
        atualizarAbaMinhasAtividadesCampo(false);
    }

    if (!isMobile && usuarioLogado && typeof atualizarDashboardGestor === "function") {
        atualizarDashboardGestor();
    }

    setInterval(async () => {
        if (typeof modoConsultaBackupAtivo !== "undefined" && modoConsultaBackupAtivo) return;
        const viewGestorAtiva = !document.getElementById('view-gestor').classList.contains('hidden');
        const algumModalAberto = 
            !document.getElementById('modal-edicao').classList.contains('hidden') ||
            !document.getElementById('modal-explosao').classList.contains('hidden') ||
            !document.getElementById('modal-detalhes').classList.contains('hidden') ||
            !document.getElementById('modal-zoom-foto').classList.contains('hidden') ||
            !document.getElementById('modal-equipe').classList.contains('hidden') ||
            !document.getElementById('modal-usuario').classList.contains('hidden') ||
            !document.getElementById('modal-imprevisto').classList.contains('hidden') ||
            !document.getElementById('modal-importar-planilha').classList.contains('hidden') ||
            !document.getElementById('modal-expandir-grafico').classList.contains('hidden') ||
            !document.getElementById('modal-expandir-tabela').classList.contains('hidden') ||
            (document.getElementById('modal-transferir-atividade') && !document.getElementById('modal-transferir-atividade').classList.contains('hidden'));

        if (usuarioLogado && viewGestorAtiva && !algumModalAberto) {
            await carregarRegistrosDaNuvem(true);
            atualizarDashboardGestor();
            const lblHora = document.getElementById('txt-hora-sync');
            if (lblHora) lblHora.innerText = new Date().toLocaleTimeString('pt-BR');
        }
    }, 180000);

    setInterval(async () => {
        if (typeof modoConsultaBackupAtivo !== "undefined" && modoConsultaBackupAtivo) return;
        const viewGestorAtiva = !document.getElementById('view-gestor').classList.contains('hidden');
        const subDispAtiva = !document.getElementById('subview-disponibilidade')?.classList.contains('hidden');
        const subMapaAtiva = !document.getElementById('subview-mapa')?.classList.contains('hidden');
        if (usuarioLogado && viewGestorAtiva && (subDispAtiva || subMapaAtiva)) {
            await carregarRegistrosDaNuvem(true);
            if (typeof renderizarPainelDisponibilidade === "function") {
                renderizarPainelDisponibilidade();
            }
        }
    }, 30000);

    setInterval(async () => {
        const viewCampoAtiva = !document.getElementById('view-campo').classList.contains('hidden');
        const formAberto = !document.getElementById('bloco-pos-abertura').classList.contains('hidden');
        if (viewCampoAtiva && equipeAutenticadaSessao && !formAberto) {
            await carregarRegistrosModoCampoLeve();
            verificarImprevistoAtivoEquipeCampo();
            verificarPendenciasReabertasEProgramadasCampo(true);
            if (typeof atualizarAbaMinhasAtividadesCampo === "function") {
                atualizarAbaMinhasAtividadesCampo(false);
            }
        }
    }, 35000);
};

function aplicarRestricoesInterface() {
    const btnNovaEquipe = document.getElementById('btn-nova-equipe');
    const btnNovoUsuario = document.getElementById('btn-novo-usuario');
    const btnLimparLogs = document.getElementById('btn-limpar-logs');
    const btnImpPlan = document.getElementById('btn-importar-planilha');
    const btnBoletimWhats = document.getElementById('btn-boletim-whats-gestor');
    const alertaImprevistos = document.getElementById('alerta-imprevistos-supervisao');

    const abasRestritasVisualizador = [
        'disponibilidade', 
        'mapa',
        'imprevistos', 
        'financeiro', 
        'equipes', 
        'opcoes', 
        'usuarios', 
        'bonificacao', 
        'auditoria'
    ];

    if (nivelUsuarioLogado === 'Visualizador') {
        if (btnNovaEquipe) btnNovaEquipe.classList.add('hidden');
        if (btnNovoUsuario) btnNovoUsuario.classList.add('hidden');
        if (btnLimparLogs) btnLimparLogs.classList.add('hidden');
        if (btnImpPlan) btnImpPlan.classList.add('hidden');
        if (btnBoletimWhats) btnBoletimWhats.classList.add('hidden');
        if (alertaImprevistos) alertaImprevistos.classList.add('hidden');

        abasRestritasVisualizador.forEach(aba => {
            const btnAba = document.getElementById(`subtab-btn-${aba}`);
            const viewAba = document.getElementById(`subview-${aba}`);
            if (btnAba) btnAba.classList.add('hidden');
            if (viewAba) viewAba.classList.add('hidden');
        });

        const viewAtivVisivel = !document.getElementById('subview-atividades')?.classList.contains('hidden');
        const viewGrafVisivel = !document.getElementById('subview-graficos')?.classList.contains('hidden');
        const viewMatVisivel  = !document.getElementById('subview-materiais')?.classList.contains('hidden');

        if (!viewAtivVisivel && !viewGrafVisivel && !viewMatVisivel && typeof mudarSubAbaGestor === "function") {
            mudarSubAbaGestor('atividades');
        }
    } else if (nivelUsuarioLogado === 'Operador') {
        if (btnNovoUsuario) btnNovoUsuario.classList.add('hidden');
        if (btnLimparLogs) btnLimparLogs.classList.add('hidden');
        if (btnNovaEquipe) btnNovaEquipe.classList.remove('hidden');
        if (btnImpPlan) btnImpPlan.classList.remove('hidden');
        if (btnBoletimWhats) btnBoletimWhats.classList.remove('hidden');

        abasRestritasVisualizador.forEach(aba => {
            const btnAba = document.getElementById(`subtab-btn-${aba}`);
            if (btnAba) btnAba.classList.remove('hidden');
        });
    } else {
        if (btnNovaEquipe) btnNovaEquipe.classList.remove('hidden');
        if (btnNovoUsuario) btnNovoUsuario.classList.remove('hidden');
        if (btnLimparLogs) btnLimparLogs.classList.remove('hidden');
        if (btnImpPlan) btnImpPlan.classList.remove('hidden');
        if (btnBoletimWhats) btnBoletimWhats.classList.remove('hidden');

        abasRestritasVisualizador.forEach(aba => {
            const btnAba = document.getElementById(`subtab-btn-${aba}`);
            if (btnAba) btnAba.classList.remove('hidden');
        });
    }
}

async function processarPacoteDadosNuvem(data, permitirUploadInicialConfig = false) {
    if (!data) return;

    const rowUsuarios = data.find(r => r.id === ID_NUVEM_USUARIOS || r.projeto === '__CONFIG_USUARIOS__');
    if (rowUsuarios && rowUsuarios.observacoes) {
        try {
            const nuvemUsers = JSON.parse(rowUsuarios.observacoes);
            if (Array.isArray(nuvemUsers) && nuvemUsers.length > 0) {
                const locais = JSON.parse(localStorage.getItem('gpd_usuarios_cadastrados')) || [];
                let houveAdicaoLocal = false;
                locais.forEach(uLocal => {
                    if (uLocal.email && !nuvemUsers.some(uNuvem => uNuvem.email.toLowerCase() === uLocal.email.toLowerCase())) {
                        nuvemUsers.push(uLocal);
                        houveAdicaoLocal = true;
                    }
                });
                usuariosSistema = nuvemUsers;
                localStorage.setItem('gpd_usuarios_cadastrados', JSON.stringify(usuariosSistema));
                if (houveAdicaoLocal && permitirUploadInicialConfig) await sincronizarUsuariosNaNuvem();
            }
        } catch (e) { console.warn("Erro ao ler JSON de usuários da nuvem:", e); }
    } else if (permitirUploadInicialConfig) {
        await sincronizarUsuariosNaNuvem();
    }

    const rowEquipes = data.find(r => r.id === ID_NUVEM_EQUIPES || r.projeto === '__CONFIG_EQUIPES__');
    if (rowEquipes && rowEquipes.observacoes) {
        try {
            const nuvemEq = JSON.parse(rowEquipes.observacoes);
            if (Array.isArray(nuvemEq) && nuvemEq.length > 0) {
                equipesSistema = nuvemEq.map(eq => ({
                    ...eq,
                    setor: formatarSetoresString(eq.setor || "Instalador"),
                    pin: (eq.pin && String(eq.pin).trim().length >= 4) ? String(eq.pin).trim() : "1234"
                }));
                localStorage.setItem('gpd_equipes_cadastradas', JSON.stringify(equipesSistema));
            }
        } catch (e) { console.warn("Erro ao ler JSON de equipes da nuvem:", e); }
    } else if (equipesSistema.length > 0 && permitirUploadInicialConfig) {
        await sincronizarEquipesNaNuvem();
    }

    const rowOpcoes = data.find(r => r.id === ID_NUVEM_OPCOES || r.projeto === '__CONFIG_OPCOES__');
    if (rowOpcoes && rowOpcoes.observacoes) {
        try {
            const nuvemOpc = JSON.parse(rowOpcoes.observacoes);
            if (Array.isArray(nuvemOpc.pendencia)) OPCOES_PENDENCIA_PADRAO = nuvemOpc.pendencia;
            if (Array.isArray(nuvemOpc.malogro)) OPCOES_MALOGRO_PADRAO = nuvemOpc.malogro;
            if (Array.isArray(nuvemOpc.imprevisto)) OPCOES_IMPREVISTO_PADRAO = nuvemOpc.imprevisto;
            if (Array.isArray(nuvemOpc.gruposProjeto) && nuvemOpc.gruposProjeto.length > 0) {
                GRUPOS_PROJETO_SISTEMA = nuvemOpc.gruposProjeto;
            }
            if (Array.isArray(nuvemOpc.catalogoProjetos) && nuvemOpc.catalogoProjetos.length > 0) {
                CATALOGO_PROJETOS_SISTEMA = nuvemOpc.catalogoProjetos;
            }
            reconstruirMapasDeProjetosDinamicos();
            popularSelectImprevistos();
        } catch (e) { console.warn("Erro ao ler JSON de opções da nuvem:", e); }
    } else if (permitirUploadInicialConfig) {
        await sincronizarOpcoesNaNuvem();
    }

    const rowRastreio = data.find(r => r.id === ID_NUVEM_RASTREIO || r.projeto === '__CONFIG_RASTREIO__');
    if (rowRastreio && rowRastreio.observacoes) {
        try {
            const nuvemRast = JSON.parse(rowRastreio.observacoes);
            if (nuvemRast && typeof nuvemRast === 'object') {
                telemetriaEquipes = nuvemRast;
                localStorage.setItem('gpd_telemetria_equipes', JSON.stringify(telemetriaEquipes));
            }
        } catch (e) { console.warn("Erro ao ler JSON de rastreio da nuvem:", e); }
    }

    const registrosReais = data.filter(r => 
        r.id !== ID_NUVEM_USUARIOS && 
        r.id !== ID_NUVEM_EQUIPES && 
        r.id !== ID_NUVEM_OPCOES &&
        r.id !== ID_NUVEM_RASTREIO &&
        r.id !== ID_NUVEM_AUDITORIA &&
        r.equipe !== '__CONFIG_SISTEMA__' &&
        r.projeto !== '__CONFIG_USUARIOS__' &&
        r.projeto !== '__CONFIG_EQUIPES__' &&
        r.projeto !== '__CONFIG_OPCOES__' &&
        r.projeto !== '__CONFIG_RASTREIO__' &&
        r.projeto !== '__CONFIG_AUDITORIA__'
    );

    registrosSalvos = registrosReais.map(r => {
        let obsBruta = r.observacoes || '';
        let endExtraido = '';
        let liberouAcessoExtraido = '';
        let fotosExtraidas = [];
        let qtdBlocosExtraida = 1;
        let tempoPausadoExtraido = 0;

        const posFotos = obsBruta.indexOf('[FOTOS:');
        if (posFotos !== -1) {
            const fimFotos = obsBruta.lastIndexOf(']');
            if (fimFotos > posFotos) {
                const jsonStr = obsBruta.substring(posFotos + 7, fimFotos);
                try {
                    fotosExtraidas = JSON.parse(jsonStr);
                } catch (e) { console.warn("Erro ao extrair fotos:", e); }
                obsBruta = (obsBruta.substring(0, posFotos) + obsBruta.substring(fimFotos + 1)).trim();
            }
        }

        const matchBlocos = obsBruta.match(/\[BLOCOS:\s*(\d+)\]/i);
        if (matchBlocos) {
            qtdBlocosExtraida = Math.max(1, Math.min(20, parseInt(matchBlocos[1], 10) || 1));
            obsBruta = obsBruta.replace(matchBlocos[0], '').trim();
        }

        const matchPausaTotal = obsBruta.match(/\[PAUSA_TOTAL:\s*(\d+)\]/i);
        if (matchPausaTotal) {
            tempoPausadoExtraido = parseInt(matchPausaTotal[1], 10) || 0;
            obsBruta = obsBruta.replace(matchPausaTotal[0], '').trim();
        }

        const matchPausaInicio = obsBruta.match(/\[PAUSA_INICIO:\s*(\d+)\]/i);
        if (matchPausaInicio) {
            obsBruta = obsBruta.replace(matchPausaInicio[0], '').trim();
        }

        const matchLiberou = obsBruta.match(/\[LIBEROU_ACESSO:\s*([^\]]+)\]/i);
        if (matchLiberou) {
            liberouAcessoExtraido = matchLiberou[1].trim();
            obsBruta = obsBruta.replace(matchLiberou[0], '').trim();
        }

        const matchEnd = obsBruta.match(/\[END:\s*([^\]]+)\]/i);
        if (matchEnd) {
            endExtraido = matchEnd[1].trim();
            obsBruta = obsBruta.replace(matchEnd[0], '').trim();
        } else if (obsBruta.startsWith('[END:')) {
            let fimTag = obsBruta.indexOf(']');
            if (fimTag !== -1) {
                endExtraido = obsBruta.substring(5, fimTag).trim();
                obsBruta = obsBruta.substring(fimTag + 1).trim();
            }
        }

        const projBruto = r.projeto || '';
        const projNorm = (projBruto === 'IMPREVISTO / ATRASO') ? projBruto : normalizarNomeProjeto(projBruto);

        return {
            id: r.id,
            dataRegistro: r.data_registro || '',
            equipe: r.equipe || '',
            membros: r.membros || '',
            projeto: projNorm,
            imovel: r.imovel || '',
            endereco: endExtraido,
            liberouAcesso: liberouAcessoExtraido,
            tempoPausadoMinutos: tempoPausadoExtraido,
            qtdBlocosProgramados: qtdBlocosExtraida,
            fotos: Array.isArray(fotosExtraidas) ? fotosExtraidas : [],
            hEntrada: r.h_entrada || '',
            hSaida: r.h_saida || '',
            gpsEntrada: r.gps_entrada || '',
            gpsSaida: r.gps_saida || '',
            desfecho: r.desfecho || '',
            motivoDesfecho: r.motivo_desfecho || '',
            malogros: r.malogros || [],
            responsavel: r.responsavel || '',
            contato: r.contato || '',
            email: r.email || '',
            agendamento: r.agendamento || '',
            andares: r.andares || '',
            hps: r.hps || '',
            servicoObra: r.servico_obra || 'SIM',
            observacoes: obsBruta,
            fusoes: Number(r.fusoes) || 0,
            conectores: Number(r.conectores) || 0,
            caboRL: Number(r.cabo_rl) || 0,
            caboDrop: Number(r.cabo_drop) || 0,
            nap: Number(r.nap) || 0,
            dio: Number(r.dio) || 0,
            cxSobrepor: Number(r.cx_sobrepor) || 0,
            cxEmbutida: Number(r.cx_embutida) || 0,
            cxFosc: Number(r.cx_fosc) || 0
        };
    });

    renderizarPainelCapacidadeNuvem();
}

// Carregador Ultra-Leve exclusivo para o Modo Campo no Smartphone
async function carregarRegistrosModoCampoLeve() {
    try {
        const hojeISO = obterDataLocalISO();
        const eqAtiva = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || "";

        const promConfig = supabaseClient
            .from('registros_producao')
            .select('*')
            .in('id', [ID_NUVEM_USUARIOS, ID_NUVEM_EQUIPES, ID_NUVEM_OPCOES, ID_NUVEM_RASTREIO]);

        let queryAtiv = supabaseClient
            .from('registros_producao')
            .select('*')
            .order('id', { ascending: false });

        if (eqAtiva) {
            queryAtiv = queryAtiv.or(`equipe.eq."${eqAtiva}",data_registro.eq.${hojeISO}`).limit(120);
        } else {
            queryAtiv = queryAtiv.or(`data_registro.eq.${hojeISO},desfecho.in.(PROGRAMADA,REABERTA,EM ANDAMENTO,PARALISADA,IMPREVISTO)`).limit(120);
        }

        const [resConfig, resAtiv] = await Promise.all([promConfig, queryAtiv]);

        const combinados = [
            ...(resConfig.data || []),
            ...(resAtiv.data || [])
        ];

        const mapaUnico = new Map();
        combinados.forEach(item => mapaUnico.set(item.id, item));

        await processarPacoteDadosNuvem(Array.from(mapaUnico.values()), false);
    } catch (err) {
        console.warn("Aviso no carregamento leve 4G:", err);
    }
}

async function carregarRegistrosDaNuvem(forcarCompletoGestor = false) {
    const viewGestorVisivel = !document.getElementById('view-gestor')?.classList.contains('hidden');
    if (!forcarCompletoGestor && !viewGestorVisivel) {
        return await carregarRegistrosModoCampoLeve();
    }

    try {
        let { data, error } = await supabaseClient
            .from('registros_producao')
            .select('*')
            .order('id', { ascending: false });
        
        if (error) throw error;
        if (data) {
            await processarPacoteDadosNuvem(data, true);
        }
    } catch (err) {
        console.error("Erro ao carregar dados completos do Supabase:", err);
    }
}

async function recarregarDadosGestor() {
    await carregarRegistrosDaNuvem(true);
    popularSelectEquipes();
    popularSelectProjetosGlobal();
    atualizarDashboardGestor();
    const lblHora = document.getElementById('txt-hora-sync');
    if (lblHora) lblHora.innerText = new Date().toLocaleTimeString('pt-BR');
    alert("🔄 Dados, posições GPS no mapa, fotos, projetos e indicadores atualizados da nuvem!");
}

async function tentarAcessarGestor() {
    if (usuarioLogado) {
        alternarVisao('gestor');
        return;
    }

    await carregarRegistrosModoCampoLeve();

    let emailInformado = prompt("🔒 Digite o seu e-mail corporativo:");
    if (!emailInformado) return;
    emailInformado = emailInformado.trim().toLowerCase();

    let senhaInformada = prompt("🔑 Digite a sua senha de acesso:");
    if (!senhaInformada) return;
    senhaInformada = senhaInformada.trim();

    let usuarioEncontrado = usuariosSistema.find(u => 
        u.email && u.email.trim().toLowerCase() === emailInformado && 
        u.senha && u.senha.trim() === senhaInformada && 
        u.status === "Ativo"
    );

    if (usuarioEncontrado || (emailInformado === "lsimoes@procisa.com.br" && senhaInformada === "Leo290301@")) {
        usuarioLogado = emailInformado;
        sessionStorage.setItem('gpd_user_logado', usuarioLogado);
        verificarPermissoesSessao();
        
        const grupoTopo = document.getElementById('grupo-botoes-visao-topo');
        if (grupoTopo) grupoTopo.classList.remove('hidden');

        document.getElementById('badge-usuario-logado').classList.remove('hidden');
        document.getElementById('btn-sair-gestor').classList.remove('hidden');
        document.getElementById('txt-email-ativo').innerText = usuarioLogado;
        document.getElementById('txt-nivel-ativo').innerText = nivelUsuarioLogado;
        
        registrarLogAuditoria("LOGIN NO SISTEMA", `Acesso ao Dashboard Gestor com nível (${nivelUsuarioLogado}).`);
        await carregarRegistrosDaNuvem(true);
        alternarVisao('gestor');
    } else {
        alert("❌ E-mail ou senha incorretos, ou usuário não autorizado.");
    }
}

function fazerLogoutGestor() {
    registrarLogAuditoria("LOGOUT", `Saída do painel gerencial.`);
    sessionStorage.removeItem('gpd_user_logado');
    usuarioLogado = null;
    nivelUsuarioLogado = "Visualizador";
    document.getElementById('badge-usuario-logado').classList.add('hidden');
    document.getElementById('btn-sair-gestor').classList.add('hidden');
    if (ehDispositivoMovel()) {
        const grupoTopo = document.getElementById('grupo-botoes-visao-topo');
        if (grupoTopo) grupoTopo.classList.add('hidden');
    }
    alternarVisao('campo');
    alert("Sessão encerrada com segurança.");
}

function alternarVisao(visao) {
    const vGestor = document.getElementById('view-gestor');
    const vCampo = document.getElementById('view-campo');
    const btnGestor = document.getElementById('btn-modo-gestor');
    const btnCampo = document.getElementById('btn-modo-campo');
    const subtitle = document.getElementById('header-subtitle');
    const barraAcoesHeader = document.getElementById('header-gestor-acoes');
    const subBarraFixa = document.getElementById('header-gestor-subbarra');

    if (visao === 'gestor') {
        if (!usuarioLogado) {
            tentarAcessarGestor();
            return;
        }
        vGestor.classList.remove('hidden');
        vCampo.classList.add('hidden');
        if (barraAcoesHeader) barraAcoesHeader.classList.remove('hidden');
        if (subBarraFixa) subBarraFixa.classList.remove('hidden');

        btnGestor.className = "px-3 py-1.5 text-xs font-medium rounded-lg transition bg-white text-blue-950 shadow-sm font-bold";
        btnCampo.className = "px-3 py-1.5 text-xs font-medium rounded-lg transition text-cyan-200 hover:text-white";
        subtitle.innerText = "Painel Gerencial - Setor Construção MDU • PROCISA RJ";
        
        aplicarRestricoesInterface();
        popularSelectProjetosGlobal();
        atualizarDashboardGestor();
    } else {
        vGestor.classList.add('hidden');
        vCampo.classList.remove('hidden');
        if (barraAcoesHeader) barraAcoesHeader.classList.add('hidden');
        if (subBarraFixa) subBarraFixa.classList.add('hidden');

        btnCampo.className = "px-3 py-1.5 text-xs font-medium rounded-lg transition bg-white text-blue-950 shadow-sm font-bold";
        btnGestor.className = "px-3 py-1.5 text-xs font-medium rounded-lg transition text-cyan-200 hover:text-white";
        subtitle.innerText = "Setor Construção MDU • PROCISA RJ";
        atualizarBarraSegurancaPinCampo();
        if (typeof atualizarBarraExpedienteCampo === "function") {
            atualizarBarraExpedienteCampo();
        }
        verificarImprevistoAtivoEquipeCampo();
        verificarPendenciasReabertasEProgramadasCampo(false);
        if (typeof atualizarAbaMinhasAtividadesCampo === "function") {
            atualizarAbaMinhasAtividadesCampo(false);
        }
    }
}

// ================= FUNÇÕES DE SESSÃO, EQUIPES E AUDITORIA =================

function verificarPermissoesSessao() {
    if (!usuarioLogado) return;
    let u = usuariosSistema.find(user => user.email.toLowerCase() === usuarioLogado.toLowerCase());
    if (u) {
        nivelUsuarioLogado = u.nivel;
    } else if (usuarioLogado.toLowerCase() === "lsimoes@procisa.com.br") {
        nivelUsuarioLogado = "Master";
    } else {
        nivelUsuarioLogado = "Visualizador";
    }
}

function registrarLogAuditoria(acao, detalhes) {
    let userAtivo = usuarioLogado || "Sistema / Campo";
    let novoLog = {
        id: Date.now(),
        dataHora: new Date().toLocaleString('pt-BR'),
        usuario: userAtivo,
        acao: acao,
        detalhes: detalhes
    };
    trilhaAuditoria.unshift(novoLog);
    localStorage.setItem('gpd_trilha_auditoria', JSON.stringify(trilhaAuditoria));
}

function popularSelectEquipes() {
    equipesSistema.sort((a, b) => a.nome.localeCompare(b.nome));
    
    const selCampo = document.getElementById('sel-equipe');
    const selFiltro = document.getElementById('gestor-filtro-equipe');
    const valorAtualCampo = selCampo ? selCampo.value : "";
    
    if (selCampo) selCampo.innerHTML = '<option value="">Selecione a Equipe...</option>';
    if (selFiltro) selFiltro.innerHTML = '<option value="">👥 Todas as Equipes</option>';

    equipesSistema.forEach(eq => {
        const strSetores = formatarSetoresString(eq.setor);

        if (eq.status === "Ativo" && selCampo) {
            selCampo.innerHTML += `<option value="${eq.nome}">${eq.nome} (${strSetores})</option>`;
        }
        if (selFiltro) {
            selFiltro.innerHTML += `<option value="${eq.nome}">${eq.nome} [${strSetores}] (${eq.status})</option>`;
        }
    });

    if (selCampo && (valorAtualCampo || equipeAutenticadaSessao)) {
        const eqRestaurar = valorAtualCampo || equipeAutenticadaSessao;
        selCampo.value = eqRestaurar;
        if (typeof atualizarProjetosPermitidosCampo === "function") {
            atualizarProjetosPermitidosCampo(eqRestaurar);
        }
        atualizarBarraSegurancaPinCampo();
    }
}
