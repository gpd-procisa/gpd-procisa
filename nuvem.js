// ================= NUVEM.JS - SINCRONIZAÇÃO SUPABASE, PAGINAÇÃO TOTAL E TELEMETRIA BLINDADA =================
const SUPABASE_URL = "https://vgqxnsyqrzyqjyvrlvou.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZncXhuc3lxcnp5cWp5dnJsdm91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDM1MTEsImV4cCI6MjEwODM3OTUxMX0.eEtPPNDWUaHAQxvoLIeA_Ag6RGW_TEMhoZ5wV65GX7Q";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ID_NUVEM_USUARIOS  = 999999001;
const ID_NUVEM_EQUIPES   = 999999002;
const ID_NUVEM_OPCOES    = 999999003;
const ID_NUVEM_RASTREIO  = 999999004;
const ID_NUVEM_AUDITORIA = 999999005;

const PROJETO_SOLIC_COMBUSTIVEL = "__SOLIC_COMBUSTIVEL__";
const PROJETO_SOLIC_MATERIAL    = "__SOLIC_MATERIAL__";
const PRAZO_EXPURGO_48H_MS      = 48 * 60 * 60 * 1000;

const LIMITE_TOTAL_SUPABASE_MB = 8000; // 8 GB Plano Pro
const ORDEM_SETORES = ["Vistoriador", "Instalador", "Ativador"];
let cargaInicialGestorConcluida = false;

// ================= COFRE DE FOTOS SOB DEMANDA (LAZY LOADING) =================
const cacheFotosSobDemanda = new Map();
let totalBytesFotosAcumuladas = 0;

function reciclarContagemBytesFotos() {
    let soma = 0;
    cacheFotosSobDemanda.forEach(arr => {
        if (Array.isArray(arr) && arr.length > 0) {
            soma += JSON.stringify(arr).length;
        }
    });
    totalBytesFotosAcumuladas = soma;
}

async function obterFotosSobDemandaDoRegistro(idReg) {
    if (cacheFotosSobDemanda.has(idReg)) {
        const emCache = cacheFotosSobDemanda.get(idReg) || [];
        if (emCache.length > 0) return emCache;
    }
    try {
        const { data } = await supabaseClient
            .from('registros_producao')
            .select('observacoes')
            .eq('id', idReg)
            .maybeSingle();

        if (data && data.observacoes) {
            const obs = data.observacoes;
            const posFotos = obs.indexOf('[FOTOS:');
            if (posFotos !== -1) {
                const fimFotos = obs.lastIndexOf(']');
                if (fimFotos > posFotos) {
                    const fotos = JSON.parse(obs.substring(posFotos + 7, fimFotos));
                    if (Array.isArray(fotos)) {
                        cacheFotosSobDemanda.set(idReg, fotos);
                        reciclarContagemBytesFotos();
                        return fotos;
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Aviso ao buscar fotos sob demanda:", e);
    }
    return [];
}

// ================= MOTOR REAL-TIME WEBSOCKETS =================
let canalRealtimeGpd = null;
let statusConexaoRealtime = "CONECTANDO";
let timerDebounceRealtime = null;

function atualizarIndicadorVisualRealtime(estado) {
    statusConexaoRealtime = estado;
    const lblSync = document.getElementById('lbl-status-autosync');
    const badgeModoLeve = document.getElementById('badge-modo-leve-4g');
    const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (lblSync) {
        if (estado === 'ONLINE') {
            lblSync.className = "text-[10px] bg-emerald-950 text-emerald-300 px-2.5 py-1.5 rounded-lg border border-emerald-600 font-mono flex items-center gap-1.5 shadow-sm";
            lblSync.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span> <b>AO VIVO (Real-Time):</b> <span id="txt-hora-sync" class="text-white">${horaAgora}</span>`;
        } else if (estado === 'RECONECTANDO') {
            lblSync.className = "text-[10px] bg-amber-950 text-amber-300 px-2.5 py-1.5 rounded-lg border border-amber-600 font-mono flex items-center gap-1.5";
            lblSync.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block"></span> <b>Sincronismo Ativo:</b> <span id="txt-hora-sync" class="text-white">${horaAgora}</span>`;
        }
    }

    if (badgeModoLeve) {
        badgeModoLeve.innerText = estado === 'ONLINE' ? "🟢 Ao Vivo 4G" : "⚡ 4G Leve";
    }
}

function iniciarEscutaRealtimeSupabase() {
    try {
        if (canalRealtimeGpd) return;

        canalRealtimeGpd = supabaseClient
            .channel('gpd-procisa-realtime-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'registros_producao' },
                (payload) => {
                    tratarEventoRealtimeRecebido(payload);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    atualizarIndicadorVisualRealtime('ONLINE');
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    atualizarIndicadorVisualRealtime('RECONECTANDO');
                }
            });
    } catch (e) {
        console.warn("Aviso ao iniciar canal Realtime:", e);
    }
}

async function tratarEventoRealtimeRecebido(payload) {
    try {
        if (typeof modoConsultaBackupAtivo !== "undefined" && modoConsultaBackupAtivo) return;

        const tipoEvento = payload.eventType;
        const regNovo = payload.new;
        const regAntigo = payload.old;

        if (tipoEvento === 'DELETE' && regAntigo && regAntigo.id) {
            const idRemovido = Number(regAntigo.id);
            cacheFotosSobDemanda.delete(idRemovido);
            reciclarContagemBytesFotos();
            registrosSalvos = (registrosSalvos || []).filter(r => r.id !== idRemovido);
        } else if ((tipoEvento === 'INSERT' || tipoEvento === 'UPDATE') && regNovo && regNovo.id) {
            await processarPacoteDadosNuvem([regNovo], false, false);
        }

        atualizarIndicadorVisualRealtime('ONLINE');

        if (timerDebounceRealtime) clearTimeout(timerDebounceRealtime);
        timerDebounceRealtime = setTimeout(() => {
            const viewGestorVisivel = !document.getElementById('view-gestor')?.classList.contains('hidden');
            const viewCampoVisivel = !document.getElementById('view-campo')?.classList.contains('hidden');

            if (viewGestorVisivel && usuarioLogado) {
                const algumModalEdicaoAberto =
                    !document.getElementById('modal-edicao')?.classList.contains('hidden') ||
                    !document.getElementById('modal-equipe')?.classList.contains('hidden') ||
                    !document.getElementById('modal-usuario')?.classList.contains('hidden') ||
                    !document.getElementById('modal-importar-planilha')?.classList.contains('hidden') ||
                    (document.getElementById('modal-transferir-atividade') && !document.getElementById('modal-transferir-atividade').classList.contains('hidden'));

                if (!algumModalEdicaoAberto && typeof atualizarDashboardGestor === "function") {
                    atualizarDashboardGestor();
                } else if (typeof renderizarPainelDisponibilidade === "function") {
                    renderizarPainelDisponibilidade();
                }
            }

            if (viewCampoVisivel) {
                if (typeof renderizarResumoSolicitacoesCampo === "function") renderizarResumoSolicitacoesCampo();
                if (equipeAutenticadaSessao) {
                    if (typeof atualizarBarraExpedienteCampo === "function") atualizarBarraExpedienteCampo();
                    const formAberto = !document.getElementById('bloco-pos-abertura')?.classList.contains('hidden');
                    if (!formAberto) {
                        if (typeof verificarImprevistoAtivoEquipeCampo === "function") verificarImprevistoAtivoEquipeCampo();
                        if (typeof verificarPendenciasReabertasEProgramadasCampo === "function") verificarPendenciasReabertasEProgramadasCampo(true);
                        if (typeof atualizarAbaMinhasAtividadesCampo === "function") atualizarAbaMinhasAtividadesCampo(false);
                    }
                }
            }
        }, 350);
    } catch (e) {
        console.warn("Aviso ao processar evento Realtime:", e);
    }
}

function lerJsonSeguroLocal(chave, valorPadrao) {
    try {
        const bruto = localStorage.getItem(chave);
        if (!bruto) return valorPadrao;
        const parsed = JSON.parse(bruto);
        return parsed !== null && parsed !== undefined ? parsed : valorPadrao;
    } catch (e) {
        localStorage.removeItem(chave);
        return valorPadrao;
    }
}

// ================= ESTRUTURA DE GRUPOS E PROJETOS =================
const CATALOGO_PROJETOS_PADRAO = [
    { nome: "VISTORIA", grupo: "ON GOING", setor: "Vistoriador" },
    { nome: "CONSTRUÇÃO F", grupo: "PROJETO F", setor: "Instalador" },
    { nome: "CONSTRUÇÃO ON GOING", grupo: "ON GOING", setor: "Instalador" },
    { nome: "CONSTRUÇÃO NAP LOTADA", grupo: "ON GOING", setor: "Instalador" },
    { nome: "ATIVAÇÃO F", grupo: "PROJETO F", setor: "Ativador" },
    { nome: "ATIVAÇÃO ON GOING", grupo: "ON GOING", setor: "Ativador" },
    { nome: "ATIVAÇÃO NAP LOTADA", grupo: "ON GOING", setor: "Ativador" }
];

let GRUPOS_PROJETO_SISTEMA = lerJsonSeguroLocal('gpd_grupos_projeto', ["ON GOING", "PROJETO F"]);
let CATALOGO_PROJETOS_SISTEMA = lerJsonSeguroLocal('gpd_catalogo_projetos', JSON.parse(JSON.stringify(CATALOGO_PROJETOS_PADRAO)));

let PROJETOS_POR_SETOR = {
    "Vistoriador": ["VISTORIA"],
    "Instalador": ["CONSTRUÇÃO F", "CONSTRUÇÃO ON GOING", "CONSTRUÇÃO NAP LOTADA"],
    "Ativador": ["ATIVAÇÃO F", "ATIVAÇÃO ON GOING", "ATIVAÇÃO NAP LOTADA"]
};

let TODOS_OS_PROJETOS = [
    "VISTORIA",
    "CONSTRUÇÃO F",
    "CONSTRUÇÃO ON GOING",
    "CONSTRUÇÃO NAP LOTADA",
    "ATIVAÇÃO F",
    "ATIVAÇÃO ON GOING",
    "ATIVAÇÃO NAP LOTADA"
];

let PROJETOS_GRUPO_MALLING = [
    "VISTORIA",
    "CONSTRUÇÃO ON GOING",
    "CONSTRUÇÃO NAP LOTADA",
    "ATIVAÇÃO ON GOING",
    "ATIVAÇÃO NAP LOTADA"
];

let PROJETOS_GRUPO_PROJETO_F = [
    "CONSTRUÇÃO F",
    "ATIVAÇÃO F"
];

const OPCOES_CONCLUIDA_PADRAO = [
    "REDE INTERNA CONCLUÍDA",
    "FUSÃO / CONECTORIZAÇÃO OK",
    "TESTE ÓPTICO APROVADO",
    "CAIXAS IDENTIFICADAS",
    "LIBERADO PARA COMERCIAL",
    "REDE GPON NÃO CONSTRUÍDA"
];

let OPCOES_COMBUSTIVEL_PADRAO = lerJsonSeguroLocal('gpd_opcoes_combustivel', [
    "ROTA LONGA / DESLOCAMENTO EXTRA",
    "SALDO DO CARTÃO INSUFICIENTE",
    "APOIO A OUTRA EQUIPE",
    "ATENDIMENTO EM OUTRO MUNICÍPIO",
    "RESERVA TÉCNICA / EMERGÊNCIA"
]);

let OPCOES_MATERIAL_SOLICITACAO = lerJsonSeguroLocal('gpd_opcoes_material_solic', [
    "CABO RL (m)",
    "CONECTORES (un)",
    "CABO DROP (m)",
    "NAP (un)",
    "DIO (un)",
    "FUSÕES / TUBETES (un)",
    "CX. SOBREPOR (un)",
    "CX. EMBUTIDA (un)",
    "CX. FOSC (un)"
]);

function reconstruirMapasDeProjetosDinamicos(atualizarSelectsNaTela = true) {
    try {
        if (!Array.isArray(GRUPOS_PROJETO_SISTEMA) || GRUPOS_PROJETO_SISTEMA.length === 0) {
            GRUPOS_PROJETO_SISTEMA = ["ON GOING", "PROJETO F"];
        }
        if (!Array.isArray(CATALOGO_PROJETOS_SISTEMA) || CATALOGO_PROJETOS_SISTEMA.length === 0) {
            CATALOGO_PROJETOS_SISTEMA = JSON.parse(JSON.stringify(CATALOGO_PROJETOS_PADRAO));
        }

        const novosPorSetor = { "Vistoriador": [], "Instalador": [], "Ativador": [] };
        const novosTodos = [];
        const novosMalling = [];
        const novosProjF = [];

        CATALOGO_PROJETOS_SISTEMA.forEach(item => {
            if (!item || typeof item !== 'object') return;
            const nomeLimpo = String(item.nome || "").trim().toUpperCase();
            if (!nomeLimpo) return;
            const grupoLimpo = String(item.grupo || GRUPOS_PROJETO_SISTEMA[0] || "ON GOING").trim().toUpperCase();
            const setorLimpo = ORDEM_SETORES.includes(item.setor) ? item.setor : "Instalador";

            item.nome = nomeLimpo;
            item.grupo = grupoLimpo;
            item.setor = setorLimpo;

            if (!GRUPOS_PROJETO_SISTEMA.includes(grupoLimpo)) GRUPOS_PROJETO_SISTEMA.push(grupoLimpo);
            if (!novosTodos.includes(nomeLimpo)) novosTodos.push(nomeLimpo);
            if (!novosPorSetor[setorLimpo].includes(nomeLimpo)) novosPorSetor[setorLimpo].push(nomeLimpo);
            if (grupoLimpo === "ON GOING") novosMalling.push(nomeLimpo);
            else novosProjF.push(nomeLimpo);
        });

        if (novosTodos.length > 0) {
            PROJETOS_POR_SETOR = novosPorSetor;
            TODOS_OS_PROJETOS = novosTodos;
            PROJETOS_GRUPO_MALLING = novosMalling;
            PROJETOS_GRUPO_PROJETO_F = novosProjF;
        }

        localStorage.setItem('gpd_grupos_projeto', JSON.stringify(GRUPOS_PROJETO_SISTEMA));
        localStorage.setItem('gpd_catalogo_projetos', JSON.stringify(CATALOGO_PROJETOS_SISTEMA));

        if (atualizarSelectsNaTela) popularSelectProjetosGlobal();
    } catch (e) {
        console.warn("Aviso ao reconstruir catálogo de projetos:", e);
    }
}

function popularSelectProjetosGlobal() {
    try {
        const selFiltroProj = document.getElementById('gestor-filtro-projeto');
        if (selFiltroProj) {
            const valAtual = selFiltroProj.value;
            let html = `<option value="">🏗️ Todos os Projetos</option>`;
            GRUPOS_PROJETO_SISTEMA.forEach(grp => {
                const projsDoGrupo = CATALOGO_PROJETOS_SISTEMA.filter(p => p && p.grupo === grp);
                if (projsDoGrupo.length > 0) {
                    html += `<optgroup label="Grupo ${grp}">` +
                        projsDoGrupo.map(p => `<option value="${p.nome}">${p.nome} (${p.setor})</option>`).join('') +
                        `</optgroup>`;
                }
            });
            selFiltroProj.innerHTML = html;
            if (valAtual && TODOS_OS_PROJETOS.includes(valAtual)) selFiltroProj.value = valAtual;
        }

        const selEditProj = document.getElementById('edit-reg-projeto');
        if (selEditProj) {
            const valEdit = selEditProj.value;
            let htmlEdit = "";
            GRUPOS_PROJETO_SISTEMA.forEach(grp => {
                const projsDoGrupo = CATALOGO_PROJETOS_SISTEMA.filter(p => p && p.grupo === grp);
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

        const selEqCampo = document.getElementById('sel-equipe');
        const selProjCampo = document.getElementById('sel-projeto');
        if (selEqCampo && selEqCampo.value && typeof atualizarProjetosPermitidosCampo === "function") {
            atualizarProjetosPermitidosCampo(selEqCampo.value, selProjCampo ? selProjCampo.value : null);
        }
    } catch (e) {
        console.warn("Aviso ao popular selects de projetos:", e);
    }
}

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
    return obterArraySetores(arrSetores).join(" + ");
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
    const resultado = Array.from(projetosUnicos);
    return resultado.length > 0 ? resultado : TODOS_OS_PROJETOS;
}

function obterSetorDoProjeto(projeto) {
    const p = normalizarNomeProjeto(projeto);
    const encontrado = (CATALOGO_PROJETOS_SISTEMA || []).find(item => item && item.nome === p);
    if (encontrado && ORDEM_SETORES.includes(encontrado.setor)) return encontrado.setor;
    if ((PROJETOS_POR_SETOR["Vistoriador"] || []).includes(p)) return "Vistoriador";
    if ((PROJETOS_POR_SETOR["Ativador"] || []).includes(p)) return "Ativador";
    return "Instalador";
}

function normalizarNomeProjeto(projBruto) {
    const p = (projBruto || '').toUpperCase().trim();
    if (p === PROJETO_SOLIC_COMBUSTIVEL || p === PROJETO_SOLIC_MATERIAL) return p;
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
    const encontrado = (CATALOGO_PROJETOS_SISTEMA || []).find(item => item && item.nome === p);
    if (encontrado && encontrado.grupo) return encontrado.grupo;
    if (PROJETOS_GRUPO_PROJETO_F.includes(p)) return "PROJETO F";
    if (PROJETOS_GRUPO_MALLING.includes(p)) return "ON GOING";
    return (GRUPOS_PROJETO_SISTEMA && GRUPOS_PROJETO_SISTEMA[0]) || "OUTROS";
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

function obterBadgeDiscretoCategoriaTecnico(nomeEquipe) {
    const chave = String(nomeEquipe || '').trim().toUpperCase();
    const eqObj = (equipesSistema || []).find(e => String(e.nome || '').trim().toUpperCase() === chave);
    const setores = obterArraySetores(eqObj ? eqObj.setor : "Instalador");
    return setores.map(s => {
        if (s === 'Vistoriador') return `<span class="ml-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-purple-100 text-purple-800 border border-purple-200 align-middle">🔍 Vistoriador</span>`;
        if (s === 'Ativador') return `<span class="ml-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 align-middle">⚡ Ativador</span>`;
        return `<span class="ml-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-100 text-blue-800 border border-blue-200 align-middle">🛠️ Instalador</span>`;
    }).join('');
}

let OPCOES_PENDENCIA_PADRAO = lerJsonSeguroLocal('gpd_opcoes_pendencia', [
    "REDE CORRETIVA",
    "ACESSO PARCIAL",
    "AGUARDANDO SÍNDICO / CLIENTE",
    "OBSTRUÇÃO INTERNA / PRUMADA",
    "FALTA DE TEMPO HÁBIL",
    "OUTROS"
]);

let OPCOES_MALOGRO_PADRAO = lerJsonSeguroLocal('gpd_opcoes_malogro', [
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
]);

let OPCOES_IMPREVISTO_PADRAO = lerJsonSeguroLocal('gpd_opcoes_imprevisto', [
    "CARRO COM DEFEITO",
    "FALTA DE MATERIAL",
    "FALTA DE EQUIPAMENTO",
    "SEM ATIVIDADE PROGRAMADA",
    "SEM TEMPO HÁBIL",
    "AGUARDANDO LIBERAÇÃO / BASE"
]);

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

let equipesSistema = lerJsonSeguroLocal('gpd_equipes_cadastradas', listaEquipesInicial.map((nome, index) => ({
    id: index + 1,
    nome: nome,
    setor: "Instalador",
    status: "Ativo",
    pin: "1234"
})));

if (!Array.isArray(equipesSistema) || equipesSistema.length === 0) {
    equipesSistema = listaEquipesInicial.map((nome, index) => ({
        id: index + 1,
        nome: nome,
        setor: "Instalador",
        status: "Ativo",
        pin: "1234"
    }));
}

equipesSistema = equipesSistema.map(eq => ({
    ...eq,
    setor: formatarSetoresString(eq.setor || "Instalador"),
    pin: (eq.pin && String(eq.pin).trim().length >= 4) ? String(eq.pin).trim() : "1234"
}));

let telemetriaEquipes = lerJsonSeguroLocal('gpd_telemetria_equipes', {});

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
let usuariosSistema = lerJsonSeguroLocal('gpd_usuarios_cadastrados', [
    { id: 1, nome: "Leonardo Simões de Almeida", email: "lsimoes@procisa.com.br", senha: "Leo290301@", nivel: "Master", status: "Ativo" }
]);
let trilhaAuditoria = lerJsonSeguroLocal('gpd_trilha_auditoria', []);
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
let listaSolicitacoesCombustivelAtuais = [];
let listaSolicitacoesMaterialAtuais = [];
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
    } catch (e) {}
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
        reconstruirMapasDeProjetosDinamicos(true);
        localStorage.setItem('gpd_opcoes_pendencia', JSON.stringify(OPCOES_PENDENCIA_PADRAO));
        localStorage.setItem('gpd_opcoes_malogro', JSON.stringify(OPCOES_MALOGRO_PADRAO));
        localStorage.setItem('gpd_opcoes_imprevisto', JSON.stringify(OPCOES_IMPREVISTO_PADRAO));
        localStorage.setItem('gpd_opcoes_combustivel', JSON.stringify(OPCOES_COMBUSTIVEL_PADRAO));
        localStorage.setItem('gpd_opcoes_material_solic', JSON.stringify(OPCOES_MATERIAL_SOLICITACAO));

        const pacoteOpcoes = {
            pendencia: OPCOES_PENDENCIA_PADRAO,
            malogro: OPCOES_MALOGRO_PADRAO,
            imprevisto: OPCOES_IMPREVISTO_PADRAO,
            combustivel: OPCOES_COMBUSTIVEL_PADRAO,
            materialSolicitacao: OPCOES_MATERIAL_SOLICITACAO,
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

function mesclarTelemetriaSemSobrescreverMaisRecente(mapaNuvem, mapaLocal) {
    const resultado = { ...(mapaNuvem || {}) };
    Object.entries(mapaLocal || {}).forEach(([eq, infoLoc]) => {
        if (!infoLoc || typeof infoLoc !== 'object') return;
        const infoNuv = resultado[eq];
        if (!infoNuv) {
            resultado[eq] = infoLoc;
            return;
        }
        const dataLoc = String(infoLoc.data || '');
        const dataNuv = String(infoNuv.data || '');
        const tsLoc = Number(infoLoc.timestampUltimoSinal) || 0;
        const tsNuv = Number(infoNuv.timestampUltimoSinal) || 0;

        if (dataLoc > dataNuv) {
            resultado[eq] = infoLoc;
        } else if (dataLoc === dataNuv) {
            if (infoNuv.statusTurno === 'DISPONIVEL' && infoLoc.statusTurno === 'ENCERRADO' && tsLoc <= tsNuv) {
                resultado[eq] = infoNuv;
            } else if (tsLoc > tsNuv) {
                resultado[eq] = infoLoc;
            }
        }
    });
    return resultado;
}

async function carregarTelemetriaDaNuvem() {
    try {
        const { data } = await supabaseClient
            .from('registros_producao')
            .select('observacoes')
            .eq('id', ID_NUVEM_RASTREIO)
            .maybeSingle();

        if (data && data.observacoes) {
            const mapaNuvem = JSON.parse(data.observacoes) || {};
            telemetriaEquipes = mesclarTelemetriaSemSobrescreverMaisRecente(mapaNuvem, telemetriaEquipes);
            localStorage.setItem('gpd_telemetria_equipes', JSON.stringify(telemetriaEquipes));
        }
    } catch (e) {
        console.warn("Aviso ao carregar telemetria da nuvem:", e);
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

        telemetriaEquipes = mesclarTelemetriaSemSobrescreverMaisRecente(mapaNuvem, telemetriaEquipes);

        if (nomeEquipe && dadosEquipe) {
            dadosEquipe.timestampUltimoSinal = Date.now();
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

// ================= MEDIDOR DE CAPACIDADE DA NUVEM =================
function calcularEstatisticasArmazenamentoNuvem() {
    try {
        const bytesRegistrosLeves = JSON.stringify(registrosSalvos || []).length;
        const bytesConfigs = JSON.stringify(usuariosSistema || []).length +
                             JSON.stringify(equipesSistema || []).length +
                             JSON.stringify(telemetriaEquipes || {}).length +
                             JSON.stringify(trilhaAuditoria || []).length;
        const totalBytes = bytesRegistrosLeves + totalBytesFotosAcumuladas + bytesConfigs;
        const usadoMB = Number((totalBytes / (1024 * 1024)).toFixed(2));
        const livreMB = Number(Math.max(0, LIMITE_TOTAL_SUPABASE_MB - usadoMB).toFixed(2));
        const percentual = Number(Math.min(100, (usadoMB / LIMITE_TOTAL_SUPABASE_MB) * 100).toFixed(1));
        const totalFotos = (registrosSalvos || []).reduce((acc, r) => acc + (Number(r.qtdFotos) || (Array.isArray(r.fotos) ? r.fotos.length : 0)), 0);

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
        msgRecomendacao = "🚨 ALERTA CRÍTICO DE CAPACIDADE (≥ 85%): Recomendamos baixar o '📦 Backup Integral (.JSON)' e clicar em '🧹 Limpar Só Fotos'.";
    } else if (stats.percentual >= 70) {
        corBarra = "bg-amber-500";
        corBoxAlerta = "bg-amber-100 border-amber-400 text-amber-950";
        msgRecomendacao = "⚠️ ATENÇÃO PREVENTIVA (≥ 70%): O uso da nuvem está se aproximando do limite.";
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
            ${nivelUsuarioLogado === 'Master' ? `<button type="button" onclick="mudarSubAbaGestor('opcoes'); document.getElementById('central-master-backup-nuvem')?.scrollIntoView({behavior:'smooth'})" class="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0">💾 Ir p/ Backup & Limpeza</button>` : ''}
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

// ================= OPÇÕES DO SISTEMA =================
function renderizarPainelOpcoesSistema() {
    reconstruirMapasDeProjetosDinamicos(true);
    renderizarPainelCapacidadeNuvem();

    const podeEditar = (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador');

    const contGrupos = document.getElementById('lista-gestao-grupos-projeto');
    if (contGrupos) {
        contGrupos.innerHTML = "";
        GRUPOS_PROJETO_SISTEMA.forEach((grp, idx) => {
            const qtdProjs = CATALOGO_PROJETOS_SISTEMA.filter(p => p && p.grupo === grp).length;
            const botoes = podeEditar
                ? `<div class="flex gap-1">
                     <button onclick="editarGrupoProjetoSistema(${idx})" class="text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded font-bold text-[10px]">✏️ Editar</button>
                     <button onclick="excluirGrupoProjetoSistema(${idx})" class="text-red-600 hover:bg-red-50 px-2 py-0.5 rounded font-bold text-[10px]">🗑️</button>
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

    const contProjetos = document.getElementById('lista-gestao-projetos-sistema');
    if (contProjetos) {
        contProjetos.innerHTML = "";
        CATALOGO_PROJETOS_SISTEMA.forEach((proj, idx) => {
            const badgeSetor = obterBadgeSetorHtml(proj.setor);
            const botoes = podeEditar
                ? `<div class="flex gap-1 shrink-0">
                     <button onclick="editarProjetoSistema(${idx})" class="text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded font-bold text-[10px] border border-blue-200">✏️ Editar</button>
                     <button onclick="excluirProjetoSistema(${idx})" class="text-red-600 hover:bg-red-50 px-2 py-0.5 rounded font-bold text-[10px] border border-red-200">🗑️</button>
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

    const desenharLista = (arrayOpcoes, tipo, idContainer) => {
        const container = document.getElementById(idContainer);
        if (!container) return;
        container.innerHTML = "";
        arrayOpcoes.forEach((op, idx) => {
            const botoes = podeEditar
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

    desenharLista(OPCOES_COMBUSTIVEL_PADRAO, 'combustivel', 'lista-gestao-combustivel');
    desenharLista(OPCOES_MATERIAL_SOLICITACAO, 'material_solic', 'lista-gestao-material-solic');
    desenharLista(OPCOES_PENDENCIA_PADRAO, 'pendencia', 'lista-gestao-pendencia');
    desenharLista(OPCOES_MALOGRO_PADRAO, 'malogro', 'lista-gestao-malogro');
    desenharLista(OPCOES_IMPREVISTO_PADRAO, 'imprevisto', 'lista-gestao-imprevisto');
    popularSelectImprevistos();
}

async function adicionarNovoGrupoProjetoSistema() {
    if (nivelUsuarioLogado === 'Visualizador') return;
    const nome = prompt("📂 NOVO GRUPO DE PROJETOS\n\nDigite o nome do novo Grupo:")?.trim().toUpperCase();
    if (!nome || GRUPOS_PROJETO_SISTEMA.includes(nome)) return;
    GRUPOS_PROJETO_SISTEMA.push(nome);
    registrarLogAuditoria("NOVO GRUPO DE PROJETO", `Criado o grupo '${nome}'.`);
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
}

async function editarGrupoProjetoSistema(idx) {
    if (nivelUsuarioLogado === 'Visualizador') return;
    const atual = GRUPOS_PROJETO_SISTEMA[idx];
    if (!atual) return;
    const novo = prompt(`✏️ RENOMEAR GRUPO DE PROJETOS\n\nNome atual: ${atual}`, atual)?.trim().toUpperCase();
    if (!novo || novo === atual) return;
    GRUPOS_PROJETO_SISTEMA[idx] = novo;
    CATALOGO_PROJETOS_SISTEMA.forEach(p => { if (p && p.grupo === atual) p.grupo = novo; });
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
}

async function excluirGrupoProjetoSistema(idx) {
    if (nivelUsuarioLogado === 'Visualizador' || GRUPOS_PROJETO_SISTEMA.length <= 1) return;
    const alvo = GRUPOS_PROJETO_SISTEMA[idx];
    const outroGrupo = GRUPOS_PROJETO_SISTEMA.find((_, i) => i !== idx) || "ON GOING";
    if (!confirm(`Deseja excluir o grupo "${alvo}"?`)) return;
    CATALOGO_PROJETOS_SISTEMA.forEach(p => { if (p && p.grupo === alvo) p.grupo = outroGrupo; });
    GRUPOS_PROJETO_SISTEMA.splice(idx, 1);
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
}

async function adicionarNovoProjetoSistema() {
    if (nivelUsuarioLogado === 'Visualizador') return;
    const nome = prompt("🏗️ Digite o nome do novo projeto:")?.trim().toUpperCase();
    if (!nome || CATALOGO_PROJETOS_SISTEMA.some(p => p && p.nome === nome)) return;
    const opcoesGruposTexto = GRUPOS_PROJETO_SISTEMA.map((g, i) => `${i + 1} - ${g}`).join('\n');
    const respGrupo = prompt(`📂 Escolha o Grupo para "${nome}":\n${opcoesGruposTexto}`, "1")?.trim().toUpperCase();
    if (!respGrupo) return;
    let grupoEscolhido = GRUPOS_PROJETO_SISTEMA[parseInt(respGrupo, 10) - 1] || respGrupo;
    if (!GRUPOS_PROJETO_SISTEMA.includes(grupoEscolhido)) GRUPOS_PROJETO_SISTEMA.push(grupoEscolhido);

    const respSetor = prompt(`👷 Qual função executa "${nome}"?\n1 - Vistoriador\n2 - Instalador\n3 - Ativador`, "2")?.trim();
    let setorEscolhido = respSetor === "1" ? "Vistoriador" : (respSetor === "3" ? "Ativador" : "Instalador");

    CATALOGO_PROJETOS_SISTEMA.push({ nome, grupo: grupoEscolhido, setor: setorEscolhido });
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
}

async function editarProjetoSistema(idx) {
    if (nivelUsuarioLogado === 'Visualizador') return;
    const atual = CATALOGO_PROJETOS_SISTEMA[idx];
    if (!atual) return;
    const novoNome = prompt(`✏️ Nome do projeto:`, atual.nome)?.trim().toUpperCase();
    if (!novoNome) return;
    const respGrupo = prompt(`📂 Grupo:`, atual.grupo)?.trim().toUpperCase();
    if (!respGrupo) return;
    const respSetor = prompt(`👷 Setor (1-Vistoriador, 2-Instalador, 3-Ativador):`, atual.setor === "Vistoriador" ? "1" : (atual.setor === "Ativador" ? "3" : "2"))?.trim();
    let novoSetor = respSetor === "1" ? "Vistoriador" : (respSetor === "3" ? "Ativador" : "Instalador");

    CATALOGO_PROJETOS_SISTEMA[idx] = { nome: novoNome, grupo: respGrupo, setor: novoSetor };
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
}

async function excluirProjetoSistema(idx) {
    if (nivelUsuarioLogado === 'Visualizador' || CATALOGO_PROJETOS_SISTEMA.length <= 1) return;
    const alvo = CATALOGO_PROJETOS_SISTEMA[idx];
    if (!confirm(`Remover o projeto "${alvo.nome}"?`)) return;
    CATALOGO_PROJETOS_SISTEMA.splice(idx, 1);
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
    if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
}

function obterArrayPorTipoOpcao(tipo) {
    if (tipo === 'pendencia') return OPCOES_PENDENCIA_PADRAO;
    if (tipo === 'malogro') return OPCOES_MALOGRO_PADRAO;
    if (tipo === 'imprevisto') return OPCOES_IMPREVISTO_PADRAO;
    if (tipo === 'combustivel') return OPCOES_COMBUSTIVEL_PADRAO;
    if (tipo === 'material_solic') return OPCOES_MATERIAL_SOLICITACAO;
    return OPCOES_PENDENCIA_PADRAO;
}

async function adicionarNovaOpcaoSistema(tipo) {
    if (nivelUsuarioLogado === 'Visualizador') return;
    const nome = prompt("Digite o nome da nova opção:")?.trim().toUpperCase();
    if (!nome) return;
    const lista = obterArrayPorTipoOpcao(tipo);
    if (!lista.includes(nome)) lista.push(nome);
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
}

async function editarOpcaoSistema(tipo, index) {
    if (nivelUsuarioLogado === 'Visualizador') return;
    let lista = obterArrayPorTipoOpcao(tipo);
    const atual = lista[index];
    const novo = prompt(`Renomear "${atual}" para:`, atual)?.trim().toUpperCase();
    if (!novo || novo === atual) return;
    lista[index] = novo;
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
}

async function excluirOpcaoSistema(tipo, index) {
    if (nivelUsuarioLogado === 'Visualizador') return;
    let lista = obterArrayPorTipoOpcao(tipo);
    if (!confirm(`Excluir a opção "${lista[index]}"?`)) return;
    lista.splice(index, 1);
    await sincronizarOpcoesNaNuvem();
    renderizarPainelOpcoesSistema();
}

function obterClasseCorDesfecho(desfecho) {
    const d = (desfecho || '').toUpperCase().trim();
    if (d === 'EM ANDAMENTO') return 'bg-blue-600 text-white border border-blue-700 animate-pulse shadow-sm';
    if (d === 'PARALISADA') return 'bg-orange-500 text-white border border-orange-600 animate-pulse shadow-sm font-black';
    if (d === 'PROGRAMADA') return 'bg-cyan-100 text-cyan-900 border border-cyan-300 font-black';
    if (d === 'REABERTA') return 'bg-purple-600 text-white border border-purple-700 animate-pulse shadow-sm';
    if (d === 'CONCLUIDA' || d === 'CONCLUÍDA' || d === 'IMPREVISTO RESOLVIDO' || d === 'TRATADA') return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
    if (d === 'PENDENTE' || d === 'IMPREVISTO' || d === 'AGUARDANDO TRATATIVA') return 'bg-amber-100 text-amber-800 border border-amber-300';
    if (d === 'MALOGRADA') return 'bg-red-100 text-red-800 border border-red-300';
    if (d === 'MÚLTIPLO') return 'bg-indigo-100 text-indigo-900 border border-indigo-300 font-black';
    return 'bg-slate-100 text-slate-700 border border-slate-300';
}

function obterDataLocalISO(dateObj = new Date()) {
    return new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}

// ================= CONVERSOR DE LINHA DO BANCO (PRESERVA 100% DOS INDICADORES E PAUSAS) =================
function converterLinhaBancoParaObjetoGpd(r) {
    let obsBruta = r.observacoes || '';
    let endExtraido = '';
    let liberouAcessoExtraido = '';
    let fotosExtraidas = [];
    let qtdBlocosExtraida = 1;
    let tempoPausadoExtraido = 0;
    let tratadoPorExtraido = '';
    let tratadoDataHoraExtraida = '';
    let tratadoTimestampExtraido = 0;
    let temMarcadorFotos = false;

    const posFotos = obsBruta.indexOf('[FOTOS:');
    if (posFotos !== -1) {
        temMarcadorFotos = true;
        const fimFotos = obsBruta.lastIndexOf(']');
        if (fimFotos > posFotos) {
            const jsonStr = obsBruta.substring(posFotos + 7, fimFotos);
            try {
                fotosExtraidas = JSON.parse(jsonStr);
            } catch (e) {}
            obsBruta = (obsBruta.substring(0, posFotos) + obsBruta.substring(fimFotos + 1)).trim();
        }
    }

    if (Array.isArray(fotosExtraidas) && fotosExtraidas.length > 0) {
        cacheFotosSobDemanda.set(r.id, fotosExtraidas);
    } else if (!cacheFotosSobDemanda.has(r.id)) {
        cacheFotosSobDemanda.set(r.id, []);
    }

    const fotosNoCofre = cacheFotosSobDemanda.get(r.id) || [];

    const matchTratadoPor = obsBruta.match(/\[TRATADO_POR:\s*([^\]]+)\]/i);
    if (matchTratadoPor) {
        tratadoPorExtraido = matchTratadoPor[1].trim();
        obsBruta = obsBruta.replace(matchTratadoPor[0], '').trim();
    }

    const matchTratadoEm = obsBruta.match(/\[TRATADO_EM:\s*([^\]]+)\]/i);
    if (matchTratadoEm) {
        tratadoDataHoraExtraida = matchTratadoEm[1].trim();
        obsBruta = obsBruta.replace(matchTratadoEm[0], '').trim();
    }

    const matchTratadoTs = obsBruta.match(/\[TRATADO_TS:\s*(\d+)\]/i);
    if (matchTratadoTs) {
        tratadoTimestampExtraido = parseInt(matchTratadoTs[1], 10) || 0;
        obsBruta = obsBruta.replace(matchTratadoTs[0], '').trim();
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
        const tsIni = parseInt(matchPausaInicio[1], 10) || 0;
        if (r.desfecho === 'PARALISADA' && tsIni > 0) {
            const minDecorridos = Math.max(1, Math.round((Date.now() - tsIni) / 60000));
            tempoPausadoExtraido += minDecorridos;
        }
        obsBruta = obsBruta.replace(matchPausaInicio[0], '').trim();
    }

    if (tempoPausadoExtraido === 0 && r.motivo_desfecho) {
        const mMotPausa = String(r.motivo_desfecho).match(/Pausa acumulada:\s*(\d+)\s*min/i);
        if (mMotPausa) tempoPausadoExtraido = parseInt(mMotPausa[1], 10) || 0;
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
    const projNorm = (projBruto === 'IMPREVISTO / ATRASO' || projBruto === PROJETO_SOLIC_COMBUSTIVEL || projBruto === PROJETO_SOLIC_MATERIAL)
        ? projBruto
        : normalizarNomeProjeto(projBruto);

    const objLeve = {
        id: r.id,
        dataRegistro: r.data_registro || '',
        equipe: (r.equipe || '').toUpperCase().trim(),
        membros: r.membros || '',
        projeto: projNorm,
        imovel: r.imovel || '',
        endereco: endExtraido,
        liberouAcesso: liberouAcessoExtraido,
        tempoPausadoMinutos: tempoPausadoExtraido,
        qtdBlocosProgramados: qtdBlocosExtraida,
        qtdFotos: fotosNoCofre.length > 0 ? fotosNoCofre.length : (temMarcadorFotos ? 1 : 0),
        tratadoPor: tratadoPorExtraido,
        tratadoDataHora: tratadoDataHoraExtraida,
        tratadoTimestamp: tratadoTimestampExtraido,
        hEntrada: r.h_entrada || '',
        hSaida: r.h_saida || '',
        gpsEntrada: r.gps_entrada || '',
        gpsSaida: r.gps_saida || '',
        desfecho: r.desfecho || '',
        motivoDesfecho: r.motivo_desfecho || '',
        malogros: Array.isArray(r.malogros) ? r.malogros : [],
        responsavel: r.responsavel || '',
        contato: r.contato || '',
        email: r.email || '',
        agendamento: r.agendamento || '',
        andares: Number(r.andares) || 0,
        hps: Number(r.hps) || 0,
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

    Object.defineProperty(objLeve, 'fotos', {
        get: function() {
            return cacheFotosSobDemanda.get(this.id) || [];
        },
        set: function(novoArr) {
            const arrValido = Array.isArray(novoArr) ? novoArr : [];
            cacheFotosSobDemanda.set(this.id, arrValido);
            this.qtdFotos = arrValido.length;
            reciclarContagemBytesFotos();
        },
        enumerable: false,
        configurable: true
    });

    return objLeve;
}

async function verificarEExpurgarSolicitacoesVencidas48h() {
    try {
        if (!Array.isArray(registrosSalvos) || registrosSalvos.length === 0) return;
        const agora = Date.now();
        const vencidos = registrosSalvos.filter(r =>
            (r.projeto === PROJETO_SOLIC_COMBUSTIVEL || r.projeto === PROJETO_SOLIC_MATERIAL) &&
            r.desfecho === 'TRATADA' &&
            r.tratadoTimestamp > 0 &&
            (agora - r.tratadoTimestamp) >= PRAZO_EXPURGO_48H_MS
        );
        if (vencidos.length === 0) return;
        const idsVencidos = vencidos.map(v => v.id);
        const setVencidos = new Set(idsVencidos);
        await supabaseClient.from('registros_producao').delete().in('id', idsVencidos);
        idsVencidos.forEach(id => cacheFotosSobDemanda.delete(id));
        reciclarContagemBytesFotos();
        registrosSalvos = registrosSalvos.filter(r => !setVencidos.has(r.id));
    } catch (e) {}
}

window.onload = async function() { 
    const isMobile = ehDispositivoMovel();

    try { reconstruirMapasDeProjetosDinamicos(false); } catch (e) {}
    try { popularSelectImprevistos(); } catch (e) {}
    try { popularSelectEquipes(); } catch (e) {}
    try { popularSelectProjetosGlobal(); } catch (e) {}
    try { verificarPermissoesSessao(); } catch (e) {}
    try { if (typeof restaurarRascunhoCampo === "function") restaurarRascunhoCampo(); } catch (e) {}

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

    iniciarEscutaRealtimeSupabase();

    if (isMobile || !usuarioLogado) {
        await carregarRegistrosModoCampoLeve();
    } else {
        await carregarRegistrosDaNuvem(true);
    }

    try { popularSelectEquipes(); } catch (e) {}
    try { popularSelectProjetosGlobal(); } catch (e) {}
    try { if (typeof verificarImprevistoAtivoEquipeCampo === "function") verificarImprevistoAtivoEquipeCampo(); } catch (e) {}
    try { if (typeof verificarPendenciasReabertasEProgramadasCampo === "function") verificarPendenciasReabertasEProgramadasCampo(false); } catch (e) {}
    try { if (typeof atualizarBarraExpedienteCampo === "function") atualizarBarraExpedienteCampo(); } catch (e) {}
    try { if (typeof atualizarAbaMinhasAtividadesCampo === "function") atualizarAbaMinhasAtividadesCampo(false); } catch (e) {}
    try { if (typeof renderizarResumoSolicitacoesCampo === "function") renderizarResumoSolicitacoesCampo(); } catch (e) {}

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
            await sincronizarDeltaRapidoGestor();
            atualizarDashboardGestor();
            atualizarIndicadorVisualRealtime(statusConexaoRealtime);
        }
    }, 180000);

    setInterval(async () => {
        if (typeof modoConsultaBackupAtivo !== "undefined" && modoConsultaBackupAtivo) return;
        const viewGestorAtiva = !document.getElementById('view-gestor').classList.contains('hidden');
        const subDispAtiva = !document.getElementById('subview-disponibilidade')?.classList.contains('hidden');
        const subMapaAtiva = !document.getElementById('subview-mapa')?.classList.contains('hidden');
        if (usuarioLogado && viewGestorAtiva && (subDispAtiva || subMapaAtiva)) {
            await sincronizarDeltaRapidoGestor();
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
            if (typeof atualizarBarraExpedienteCampo === "function") atualizarBarraExpedienteCampo();
            if (typeof verificarImprevistoAtivoEquipeCampo === "function") verificarImprevistoAtivoEquipeCampo();
            if (typeof verificarPendenciasReabertasEProgramadasCampo === "function") verificarPendenciasReabertasEProgramadasCampo(true);
            if (typeof atualizarAbaMinhasAtividadesCampo === "function") atualizarAbaMinhasAtividadesCampo(false);
            if (typeof renderizarResumoSolicitacoesCampo === "function") renderizarResumoSolicitacoesCampo();
        }
    }, 35000);
};

// PERFIL VISUALIZADOR (CLIENTE) PADRONIZADO E BLINDADO
function aplicarRestricoesInterface() {
    const btnNovaEquipe = document.getElementById('btn-nova-equipe');
    const btnNovoUsuario = document.getElementById('btn-novo-usuario');
    const btnLimparLogs = document.getElementById('btn-limpar-logs');
    const btnImpPlan = document.getElementById('btn-importar-planilha');
    const btnBoletimWhats = document.getElementById('btn-boletim-whats-gestor');
    const alertaImprevistos = document.getElementById('alerta-imprevistos-supervisao');

    const abasRestritasVisualizador = [
        'combustivel', 'solicitacao_material',
        'imprevistos', 'financeiro', 'equipes', 'opcoes', 'usuarios', 'bonificacao', 'auditoria'
    ];
    const abasPermitidasVisualizador = ['atividades', 'disponibilidade', 'mapa', 'graficos', 'materiais'];

    const nivNorm = String(nivelUsuarioLogado || 'Visualizador').toLowerCase().trim();

    if (nivNorm === 'visualizador') {
        if (btnNovaEquipe) btnNovaEquipe.classList.add('hidden');
        if (btnNovoUsuario) btnNovoUsuario.classList.add('hidden');
        if (btnLimparLogs) btnLimparLogs.classList.add('hidden');
        if (btnImpPlan) btnImpPlan.classList.add('hidden');
        if (btnBoletimWhats) btnBoletimWhats.classList.add('hidden');
        if (alertaImprevistos) alertaImprevistos.classList.add('hidden');

        abasRestritasVisualizador.forEach(aba => {
            document.getElementById(`subtab-btn-${aba}`)?.classList.add('hidden');
            document.getElementById(`subview-${aba}`)?.classList.add('hidden');
        });
        abasPermitidasVisualizador.forEach(aba => {
            document.getElementById(`subtab-btn-${aba}`)?.classList.remove('hidden');
        });
    } else if (nivNorm === 'operador') {
        if (btnNovoUsuario) btnNovoUsuario.classList.add('hidden');
        if (btnLimparLogs) btnLimparLogs.classList.add('hidden');
        if (btnNovaEquipe) btnNovaEquipe.classList.remove('hidden');
        if (btnImpPlan) btnImpPlan.classList.remove('hidden');
        if (btnBoletimWhats) btnBoletimWhats.classList.remove('hidden');
        [...abasRestritasVisualizador, ...abasPermitidasVisualizador].forEach(aba => document.getElementById(`subtab-btn-${aba}`)?.classList.remove('hidden'));
    } else {
        if (btnNovaEquipe) btnNovaEquipe.classList.remove('hidden');
        if (btnNovoUsuario) btnNovoUsuario.classList.remove('hidden');
        if (btnLimparLogs) btnLimparLogs.classList.remove('hidden');
        if (btnImpPlan) btnImpPlan.classList.remove('hidden');
        if (btnBoletimWhats) btnBoletimWhats.classList.remove('hidden');
        [...abasRestritasVisualizador, ...abasPermitidasVisualizador].forEach(aba => document.getElementById(`subtab-btn-${aba}`)?.classList.remove('hidden'));
    }
}

async function processarPacoteDadosNuvem(data, permitirUploadInicialConfig = false, substituirTudo = true) {
    if (!data) return;

    const rowUsuarios = data.find(r => r.id === ID_NUVEM_USUARIOS || r.projeto === '__CONFIG_USUARIOS__');
    if (rowUsuarios && rowUsuarios.observacoes) {
        try {
            const nuvemUsers = JSON.parse(rowUsuarios.observacoes);
            if (Array.isArray(nuvemUsers) && nuvemUsers.length > 0) {
                usuariosSistema = nuvemUsers;
                localStorage.setItem('gpd_usuarios_cadastrados', JSON.stringify(usuariosSistema));
            }
        } catch (e) {}
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
        } catch (e) {}
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
            if (Array.isArray(nuvemOpc.combustivel) && nuvemOpc.combustivel.length > 0) OPCOES_COMBUSTIVEL_PADRAO = nuvemOpc.combustivel;
            if (Array.isArray(nuvemOpc.materialSolicitacao) && nuvemOpc.materialSolicitacao.length > 0) OPCOES_MATERIAL_SOLICITACAO = nuvemOpc.materialSolicitacao;
            if (Array.isArray(nuvemOpc.gruposProjeto) && nuvemOpc.gruposProjeto.length > 0) GRUPOS_PROJETO_SISTEMA = nuvemOpc.gruposProjeto;
            if (Array.isArray(nuvemOpc.catalogoProjetos) && nuvemOpc.catalogoProjetos.length > 0) CATALOGO_PROJETOS_SISTEMA = nuvemOpc.catalogoProjetos;
            reconstruirMapasDeProjetosDinamicos(true);
            popularSelectImprevistos();
        } catch (e) {}
    } else if (permitirUploadInicialConfig) {
        await sincronizarOpcoesNaNuvem();
    }

    const rowRastreio = data.find(r => r.id === ID_NUVEM_RASTREIO || r.projeto === '__CONFIG_RASTREIO__');
    if (rowRastreio && rowRastreio.observacoes) {
        try {
            const nuvemRast = JSON.parse(rowRastreio.observacoes);
            if (nuvemRast && typeof nuvemRast === 'object') {
                telemetriaEquipes = mesclarTelemetriaSemSobrescreverMaisRecente(nuvemRast, telemetriaEquipes);
                localStorage.setItem('gpd_telemetria_equipes', JSON.stringify(telemetriaEquipes));
            }
        } catch (e) {}
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

    if (substituirTudo) {
        cacheFotosSobDemanda.clear();
    }

    const convertidos = registrosReais.map(converterLinhaBancoParaObjetoGpd);
    reciclarContagemBytesFotos();

    if (substituirTudo) {
        registrosSalvos = convertidos;
    } else {
        const mapa = new Map();
        (registrosSalvos || []).forEach(item => mapa.set(item.id, item));
        convertidos.forEach(item => {
            const existente = mapa.get(item.id);
            if (existente) {
                if (!item.endereco && existente.endereco) item.endereco = existente.endereco;
                if (!item.liberouAcesso && existente.liberouAcesso) item.liberouAcesso = existente.liberouAcesso;
                if (!item.tempoPausadoMinutos && existente.tempoPausadoMinutos) item.tempoPausadoMinutos = existente.tempoPausadoMinutos;
                if (!item.observacoes && existente.observacoes) item.observacoes = existente.observacoes;
                if (!item.qtdFotos && existente.qtdFotos) item.qtdFotos = existente.qtdFotos;
            }
            mapa.set(item.id, item);
        });
        registrosSalvos = Array.from(mapa.values()).sort((a, b) => {
            if (a.dataRegistro !== b.dataRegistro) return (b.dataRegistro || '').localeCompare(a.dataRegistro || '');
            return (b.id || 0) - (a.id || 0);
        });
    }

    await verificarEExpurgarSolicitacoesVencidas48h();
    renderizarPainelCapacidadeNuvem();
}

// SINCRONIZADOR DELTA ULTRA-RÁPIDO (SEM PUXAR FOTOS BASE64 PESADAS NO LOOP DE 30s)
async function sincronizarDeltaRapidoGestor() {
    if (!cargaInicialGestorConcluida || !registrosSalvos || registrosSalvos.length === 0) {
        return await carregarRegistrosDaNuvem(true);
    }
    try {
        const hojeISO = obterDataLocalISO();
        const COLUNAS_LEVES_DELTA = 'id, data_registro, equipe, membros, projeto, imovel, h_entrada, h_saida, gps_entrada, gps_saida, desfecho, motivo_desfecho, malogros, responsavel, contato, email, agendamento, andares, hps, servico_obra, fusoes, conectores, cabo_rl, cabo_drop, nap, dio, cx_sobrepor, cx_embutida, cx_fosc';

        const promConfig = supabaseClient
            .from('registros_producao')
            .select('*')
            .in('id', [ID_NUVEM_USUARIOS, ID_NUVEM_EQUIPES, ID_NUVEM_OPCOES, ID_NUVEM_RASTREIO]);

        const promRecentes = supabaseClient
            .from('registros_producao')
            .select(COLUNAS_LEVES_DELTA)
            .neq('equipe', '__CONFIG_SISTEMA__')
            .neq('projeto', '__CONFIG_AUDITORIA__')
            .or(`data_registro.eq.${hojeISO},desfecho.in.(PROGRAMADA,REABERTA,EM ANDAMENTO,PARALISADA,IMPREVISTO,AGUARDANDO TRATATIVA,TRATADA)`)
            .order('id', { ascending: false })
            .limit(300);

        const [resConfig, resRecentes] = await Promise.all([promConfig, promRecentes]);
        const combinados = [...(resConfig.data || []), ...(resRecentes.data || [])];
        await processarPacoteDadosNuvem(combinados, false, false);
    } catch (e) {
        console.warn("Aviso no sincronismo delta rápido:", e);
    }
}

async function carregarRegistrosModoCampoLeve() {
    try {
        const hojeISO = obterDataLocalISO();
        const eqAtiva = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || "";

        const promConfig = supabaseClient
            .from('registros_producao')
            .select('*')
            .in('id', [ID_NUVEM_USUARIOS, ID_NUVEM_EQUIPES, ID_NUVEM_OPCOES, ID_NUVEM_RASTREIO]);

        const COLUNAS_LEVES_CAMPO = 'id, data_registro, equipe, membros, projeto, imovel, h_entrada, h_saida, gps_entrada, gps_saida, desfecho, motivo_desfecho, malogros, responsavel, contato, email, agendamento, andares, hps, servico_obra, fusoes, conectores, cabo_rl, cabo_drop, nap, dio, cx_sobrepor, cx_embutida, cx_fosc';

        let queryAtiv = supabaseClient
            .from('registros_producao')
            .select(COLUNAS_LEVES_CAMPO)
            .order('id', { ascending: false });

        if (eqAtiva) {
            queryAtiv = queryAtiv.or(`equipe.eq."${eqAtiva}",data_registro.eq.${hojeISO},desfecho.in.(PROGRAMADA,REABERTA,EM ANDAMENTO,PARALISADA,IMPREVISTO)`).limit(200);
        } else {
            queryAtiv = queryAtiv.or(`data_registro.eq.${hojeISO},desfecho.in.(PROGRAMADA,REABERTA,EM ANDAMENTO,PARALISADA,IMPREVISTO,AGUARDANDO TRATATIVA,TRATADA)`).limit(200);
        }

        const [resConfig, resAtiv] = await Promise.all([promConfig, queryAtiv]);
        const combinados = [...(resConfig.data || []), ...(resAtiv.data || [])];

        const mapaUnico = new Map();
        combinados.forEach(item => mapaUnico.set(item.id, item));

        await processarPacoteDadosNuvem(Array.from(mapaUnico.values()), false, false);
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
        const { data: rowsConfig } = await supabaseClient
            .from('registros_producao')
            .select('*')
            .in('id', [ID_NUVEM_USUARIOS, ID_NUVEM_EQUIPES, ID_NUVEM_OPCOES, ID_NUVEM_RASTREIO]);

        if (rowsConfig) {
            await processarPacoteDadosNuvem(rowsConfig, true, false);
        }

        const COLUNAS_COMPLETAS_SEM_FOTOS = 'id, data_registro, equipe, membros, projeto, imovel, h_entrada, h_saida, gps_entrada, gps_saida, desfecho, motivo_desfecho, malogros, responsavel, contato, email, agendamento, andares, hps, servico_obra, fusoes, conectores, cabo_rl, cabo_drop, nap, dio, cx_sobrepor, cx_embutida, cx_fosc';
        const TAMANHO_PAGINA = 1000;
        let todasLinhas = [];
        let pagina = 0;
        let continuar = true;

        while (continuar && pagina < 30) {
            const ini = pagina * TAMANHO_PAGINA;
            const fim = ini + TAMANHO_PAGINA - 1;
            const { data: lote, error } = await supabaseClient
                .from('registros_producao')
                .select(COLUNAS_COMPLETAS_SEM_FOTOS)
                .neq('equipe', '__CONFIG_SISTEMA__')
                .neq('projeto', '__CONFIG_AUDITORIA__')
                .order('data_registro', { ascending: false })
                .order('id', { ascending: false })
                .range(ini, fim);

            if (error || !lote || lote.length === 0) {
                continuar = false;
            } else {
                todasLinhas.push(...lote);
                if (lote.length < TAMANHO_PAGINA) continuar = false;
                else pagina++;
            }
        }

        if (todasLinhas.length > 0) {
            await processarPacoteDadosNuvem(todasLinhas, false, false);
            cargaInicialGestorConcluida = true;
            if (typeof historicoCompletoGestorJaBaixado !== 'undefined') {
                historicoCompletoGestorJaBaixado = true;
            }
        }
    } catch (err) {
        console.error("Erro ao carregar dados completos do Supabase:", err);
    }
}

async function recarregarDadosGestor(forcarDownloadCompleto = true) {
    const btnAtu = document.getElementById('btn-atualizar-registros-gestor');
    if (btnAtu) {
        btnAtu.disabled = true;
        btnAtu.innerText = "⏳ Sincronizando...";
    }

    if (forcarDownloadCompleto) {
        await carregarRegistrosDaNuvem(true);
    } else {
        await sincronizarDeltaRapidoGestor();
    }

    popularSelectEquipes();
    popularSelectProjetosGlobal();
    if (typeof atualizarDashboardGestor === "function") await atualizarDashboardGestor();
    atualizarIndicadorVisualRealtime(statusConexaoRealtime);

    if (btnAtu) {
        btnAtu.disabled = false;
        btnAtu.innerText = "🔄 Atualizar Registros";
    }
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
        if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
    } else {
        vGestor.classList.add('hidden');
        vCampo.classList.remove('hidden');
        if (barraAcoesHeader) barraAcoesHeader.classList.add('hidden');
        if (subBarraFixa) subBarraFixa.classList.add('hidden');

        btnCampo.className = "px-3 py-1.5 text-xs font-medium rounded-lg transition bg-white text-blue-950 shadow-sm font-bold";
        btnGestor.className = "px-3 py-1.5 text-xs font-medium rounded-lg transition text-cyan-200 hover:text-white";
        subtitle.innerText = "Setor Construção MDU • PROCISA RJ";
        popularSelectEquipes();
        atualizarBarraSegurancaPinCampo();
        if (typeof atualizarBarraExpedienteCampo === "function") atualizarBarraExpedienteCampo();
        if (typeof verificarImprevistoAtivoEquipeCampo === "function") verificarImprevistoAtivoEquipeCampo();
        if (typeof verificarPendenciasReabertasEProgramadasCampo === "function") verificarPendenciasReabertasEProgramadasCampo(false);
        if (typeof atualizarAbaMinhasAtividadesCampo === "function") atualizarAbaMinhasAtividadesCampo(false);
        if (typeof renderizarResumoSolicitacoesCampo === "function") renderizarResumoSolicitacoesCampo();
    }
}

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
    if (!usuarioLogado) return;
    let novoLog = {
        id: Date.now() + Math.floor(Math.random() * 100),
        dataHora: new Date().toLocaleString('pt-BR'),
        usuario: usuarioLogado,
        acao: acao,
        detalhes: detalhes
    };
    trilhaAuditoria.unshift(novoLog);
    localStorage.setItem('gpd_trilha_auditoria', JSON.stringify(trilhaAuditoria));
}

function popularSelectEquipes() {
    if (!Array.isArray(equipesSistema)) return;
    equipesSistema.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
    
    const selCampo = document.getElementById('sel-equipe');
    const selFiltro = document.getElementById('gestor-filtro-equipe');
    const valorAtualCampo = selCampo ? selCampo.value : "";
    
    if (selCampo) selCampo.innerHTML = '<option value="">Selecione a Equipe...</option>';
    if (selFiltro) selFiltro.innerHTML = '<option value="">👥 Todas as Equipes</option>';

    equipesSistema.forEach(eq => {
        if (!eq || !eq.nome) return;
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
        if (equipesSistema.some(e => e.nome === eqRestaurar)) {
            selCampo.value = eqRestaurar;
            if (typeof atualizarProjetosPermitidosCampo === "function") {
                atualizarProjetosPermitidosCampo(eqRestaurar);
            }
        }
        atualizarBarraSegurancaPinCampo();
    }
}
