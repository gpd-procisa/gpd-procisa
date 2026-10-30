const SUPABASE_URL = "https://vgqxnsyqrzyqjyvrlvou.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZncXhuc3lxcnp5cWp5dnJsdm91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDM1MTEsImV4cCI6MjEwODM3OTUxMX0.eEtPPNDWUaHAQxvoLIeA_Ag6RGW_TEMhoZ5wV65GX7Q";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ID_NUVEM_USUARIOS = 999999001;
const ID_NUVEM_EQUIPES  = 999999002;
const ID_NUVEM_OPCOES   = 999999003;

const ORDEM_SETORES = ["Vistoriador", "Instalador", "Ativador"];

const PROJETOS_POR_SETOR = {
    "Vistoriador": [
        "VISTORIA"
    ],
    "Instalador": [
        "CONSTRUÇÃO F",
        "CONSTRUÇÃO ON GOING",
        "CONSTRUÇÃO NAP LOTADA"
    ],
    "Ativador": [
        "ATIVAÇÃO F",
        "ATIVAÇÃO ON GOING",
        "ATIVAÇÃO NAP LOTADA"
    ]
};

const TODOS_OS_PROJETOS = [
    "VISTORIA",
    "CONSTRUÇÃO F",
    "CONSTRUÇÃO ON GOING",
    "CONSTRUÇÃO NAP LOTADA",
    "ATIVAÇÃO F",
    "ATIVAÇÃO ON GOING",
    "ATIVAÇÃO NAP LOTADA"
];

const PROJETOS_GRUPO_MALLING = [
    "VISTORIA",
    "CONSTRUÇÃO ON GOING",
    "CONSTRUÇÃO NAP LOTADA",
    "ATIVAÇÃO ON GOING",
    "ATIVAÇÃO NAP LOTADA"
];

const PROJETOS_GRUPO_PROJETO_F = [
    "CONSTRUÇÃO F",
    "ATIVAÇÃO F"
];

const OPCOES_CONCLUIDA_PADRAO = [
    "REDE INTERNA CONCLUÍDA",
    "FUSÃO / CONECTORIZAÇÃO OK",
    "TESTE ÓPTICO APROVADO",
    "CAIXAS IDENTIFICADAS",
    "LIBERADO PARA COMERCIAL"
];

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
    if (PROJETOS_POR_SETOR["Vistoriador"].includes(p)) return "Vistoriador";
    if (PROJETOS_POR_SETOR["Ativador"].includes(p)) return "Ativador";
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
    if (PROJETOS_GRUPO_PROJETO_F.includes(p)) return "PROJETO F";
    if (PROJETOS_GRUPO_MALLING.includes(p)) return "ON GOING";
    return "OUTROS";
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

let dadosAtendimento = { idEmAndamento: null, eraReaberta: false, eraProgramada: false, hEntrada: null, hSaida: null, gpsEntrada: null, gpsSaida: null, blocos: [] };
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

// PONTO 03: Alerta sonoro automático no smartphone via Web Audio API + Vibração
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
        localStorage.setItem('gpd_opcoes_pendencia', JSON.stringify(OPCOES_PENDENCIA_PADRAO));
        localStorage.setItem('gpd_opcoes_malogro', JSON.stringify(OPCOES_MALOGRO_PADRAO));
        localStorage.setItem('gpd_opcoes_imprevisto', JSON.stringify(OPCOES_IMPREVISTO_PADRAO));

        const pacoteOpcoes = {
            pendencia: OPCOES_PENDENCIA_PADRAO,
            malogro: OPCOES_MALOGRO_PADRAO,
            imprevisto: OPCOES_IMPREVISTO_PADRAO
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

function renderizarPainelOpcoesSistema() {
    const desenharLista = (arrayOpcoes, tipo, idContainer) => {
        const container = document.getElementById(idContainer);
        if (!container) return;
        container.innerHTML = "";
        arrayOpcoes.forEach((op, idx) => {
            const botoes = (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador')
                ? `<div class="flex gap-1">
                     <button onclick="editarOpcaoSistema('${tipo}', ${idx})" class="text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded font-bold text-[10px]">✏️ Editar</button>
                     <button onclick="excluirOpcaoSistema('${tipo}', ${idx})" class="text-red-600 hover:bg-red-50 px-2 py-0.5 rounded font-bold text-[10px]">🗑️</button>
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
    renderizarBlocosCampo();
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
    renderizarBlocosCampo();
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
    renderizarBlocosCampo();
}

function obterClasseCorDesfecho(desfecho) {
    const d = (desfecho || '').toUpperCase().trim();
    if (d === 'EM ANDAMENTO') {
        return 'bg-blue-600 text-white border border-blue-700 animate-pulse shadow-sm';
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

window.onload = async function() { 
    popularSelectImprevistos();
    await carregarRegistrosDaNuvem();
    popularSelectEquipes();
    verificarPermissoesSessao();
    restaurarRascunhoCampo();
    verificarImprevistoAtivoEquipeCampo();
    verificarPendenciasReabertasEProgramadasCampo(false);

    if (usuarioLogado) {
        document.getElementById('badge-usuario-logado').classList.remove('hidden');
        document.getElementById('btn-sair-gestor').classList.remove('hidden');
        document.getElementById('txt-email-ativo').innerText = usuarioLogado;
        document.getElementById('txt-nivel-ativo').innerText = nivelUsuarioLogado;
        alternarVisao('gestor');
    } else {
        alternarVisao('campo');
    }

    // Sincronização automática do Painel do Gestor a cada 180s
    setInterval(async () => {
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
            !document.getElementById('modal-expandir-tabela').classList.contains('hidden');

        if (usuarioLogado && viewGestorAtiva && !algumModalAberto) {
            await carregarRegistrosDaNuvem();
            atualizarDashboardGestor();
            const lblHora = document.getElementById('txt-hora-sync');
            if (lblHora) lblHora.innerText = new Date().toLocaleTimeString('pt-BR');
        }
    }, 180000);

    // PONTO 03: Radar em segundo plano no celular do técnico a cada 35s para tocar alerta sonoro ao receber atividade
    setInterval(async () => {
        const viewCampoAtiva = !document.getElementById('view-campo').classList.contains('hidden');
        const formAberto = !document.getElementById('bloco-pos-abertura').classList.contains('hidden');
        if (viewCampoAtiva && equipeAutenticadaSessao && !formAberto) {
            await carregarRegistrosDaNuvem();
            verificarImprevistoAtivoEquipeCampo();
            verificarPendenciasReabertasEProgramadasCampo(true);
        }
    }, 35000);
};

function aplicarRestricoesInterface() {
    const btnNovaEquipe = document.getElementById('btn-nova-equipe');
    const btnNovoUsuario = document.getElementById('btn-novo-usuario');
    const btnLimparLogs = document.getElementById('btn-limpar-logs');
    const btnImpPlan = document.getElementById('btn-importar-planilha');

    if (nivelUsuarioLogado === 'Visualizador') {
        if (btnNovaEquipe) btnNovaEquipe.classList.add('hidden');
        if (btnNovoUsuario) btnNovoUsuario.classList.add('hidden');
        if (btnLimparLogs) btnLimparLogs.classList.add('hidden');
        if (btnImpPlan) btnImpPlan.classList.add('hidden');
    } else if (nivelUsuarioLogado === 'Operador') {
        if (btnNovoUsuario) btnNovoUsuario.classList.add('hidden');
        if (btnLimparLogs) btnLimparLogs.classList.add('hidden');
        if (btnNovaEquipe) btnNovaEquipe.classList.remove('hidden');
        if (btnImpPlan) btnImpPlan.classList.remove('hidden');
    } else {
        if (btnNovaEquipe) btnNovaEquipe.classList.remove('hidden');
        if (btnNovoUsuario) btnNovoUsuario.classList.remove('hidden');
        if (btnLimparLogs) btnLimparLogs.classList.remove('hidden');
        if (btnImpPlan) btnImpPlan.classList.remove('hidden');
    }
}

async function carregarRegistrosDaNuvem() {
    try {
        let { data, error } = await supabaseClient
            .from('registros_producao')
            .select('*')
            .order('id', { ascending: false });
        
        if (error) throw error;
        
        if (data) {
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
                        if (houveAdicaoLocal) await sincronizarUsuariosNaNuvem();
                    }
                } catch (e) { console.warn("Erro ao ler JSON de usuários da nuvem:", e); }
            } else {
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
            } else if (equipesSistema.length > 0) {
                await sincronizarEquipesNaNuvem();
            }

            const rowOpcoes = data.find(r => r.id === ID_NUVEM_OPCOES || r.projeto === '__CONFIG_OPCOES__');
            if (rowOpcoes && rowOpcoes.observacoes) {
                try {
                    const nuvemOpc = JSON.parse(rowOpcoes.observacoes);
                    if (nuvemOpc.pendencia) OPCOES_PENDENCIA_PADRAO = nuvemOpc.pendencia;
                    if (nuvemOpc.malogro) OPCOES_MALOGRO_PADRAO = nuvemOpc.malogro;
                    if (nuvemOpc.imprevisto) OPCOES_IMPREVISTO_PADRAO = nuvemOpc.imprevisto;
                    popularSelectImprevistos();
                } catch (e) { console.warn("Erro ao ler JSON de opções da nuvem:", e); }
            } else {
                await sincronizarOpcoesNaNuvem();
            }

            const registrosReais = data.filter(r => 
                r.id !== ID_NUVEM_USUARIOS && 
                r.id !== ID_NUVEM_EQUIPES && 
                r.id !== ID_NUVEM_OPCOES &&
                r.equipe !== '__CONFIG_SISTEMA__' &&
                r.projeto !== '__CONFIG_USUARIOS__' &&
                r.projeto !== '__CONFIG_EQUIPES__' &&
                r.projeto !== '__CONFIG_OPCOES__'
            );

            registrosSalvos = registrosReais.map(r => {
                let obsBruta = r.observacoes || '';
                let endExtraido = '';
                let fotosExtraidas = [];
                let qtdBlocosExtraida = 1;

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

                if (obsBruta.startsWith('[END:')) {
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
        }
    } catch (err) {
        console.error("Erro ao carregar dados do Supabase:", err);
    }
}

async function recarregarDadosGestor() {
    await carregarRegistrosDaNuvem();
    popularSelectEquipes();
    atualizarDashboardGestor();
    const lblHora = document.getElementById('txt-hora-sync');
    if (lblHora) lblHora.innerText = new Date().toLocaleTimeString('pt-BR');
    alert("🔄 Dados, fotos, grupos de equipes e indicadores atualizados da nuvem!");
}

async function tentarAcessarGestor() {
    if (usuarioLogado) {
        alternarVisao('gestor');
        return;
    }

    await carregarRegistrosDaNuvem();

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
        
        document.getElementById('badge-usuario-logado').classList.remove('hidden');
        document.getElementById('btn-sair-gestor').classList.remove('hidden');
        document.getElementById('txt-email-ativo').innerText = usuarioLogado;
        document.getElementById('txt-nivel-ativo').innerText = nivelUsuarioLogado;
        
        registrarLogAuditoria("LOGIN NO SISTEMA", `Acesso ao Dashboard Gestor com nível (${nivelUsuarioLogado}).`);
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
        verificarImprevistoAtivoEquipeCampo();
        verificarPendenciasReabertasEProgramadasCampo(false);
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
