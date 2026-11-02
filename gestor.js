// ================= VARIÁVEIS GLOBAIS DO MAPA, GRÁFICOS, EDIÇÃO, FILTROS MÚLTIPLOS E BACKUP =================
let mapaRastreioInstancia = null;
let camadaMarcadoresRastreio = null;
let coordenadasPinosAtuais = [];
let fotosEdicaoTemporarias = [];
let opcoesMarcadasEdicaoTemporarias = [];
let snapshotStatusEdicaoOriginal = null;
let modoConsultaBackupAtivo = false;
let cacheRegistrosNuvemOriginal = null;
let graficoProgramadoRetornoBairroInstancia = null;

let filtrosMultiplosAtivos = { equipes: [], setores: [], macrogrupos: [], projetos: [], desfechos: [] };

// ================= FUNÇÕES AUXILIARES DA PLANILHA ANALÍTICA (SEMANA, BAIRRO, SERVIÇO E STATUS MACRO) =================
function obterSemanaDoMes(dataISO) {
    if (!dataISO || typeof dataISO !== 'string' || dataISO.length < 10) return 'Sem 1';
    const dia = parseInt(dataISO.substring(8, 10), 10);
    if (isNaN(dia) || dia <= 7) return 'Sem 1';
    if (dia <= 14) return 'Sem 2';
    if (dia <= 21) return 'Sem 3';
    if (dia <= 28) return 'Sem 4';
    return 'Sem 5';
}

function extrairBairroDoEndereco(endereco) {
    if (!endereco || typeof endereco !== 'string') return 'NÃO INFORMADO';
    let limpo = endereco.toUpperCase().trim();
    limpo = limpo.replace(/\([^)]*\)/g, '').trim();
    if (limpo.includes(' - ')) {
        const partes = limpo.split(' - ').map(p => p.trim()).filter(Boolean);
        const candidato = partes[partes.length - 1];
        if (candidato && candidato.length >= 2 && !/^\d+$/.test(candidato) && !candidato.startsWith('BL ') && !candidato.startsWith('APT')) {
            return candidato;
        }
    }
    const bairrosConhecidosRJ = [
        'COPACABANA', 'TIJUCA', 'RECREIO DOS BANDEIRANTES', 'RECREIO DO BANDEIRANTES', 'BOTAFOGO',
        'TAQUARA', 'FREGUESIA', 'PECHINCHA', 'CAMPO GRANDE', 'TODOS OS SANTOS', 'VARGEM GRANDE',
        'LEME', 'IPANEMA', 'LEBLON', 'FLAMENGO', 'LARANJEIRAS', 'CATETE', 'GLORIA', 'CENTRO',
        'BARRA DA TIJUCA', 'GRAJAU', 'VILA ISABEL', 'MARACANA', 'MEIER', 'ENGENHO NOVO',
        'LINS DE VASCONCELOS', 'CACHAMBI', 'DEL CASTILHO', 'INHAUMA', 'MADUREIRA', 'BANGU',
        'REALENGO', 'JACAREPAGUA', 'ANIL', 'CURICICA', 'TANQUE', 'PRACA SECA', 'VILA VALQUEIRE',
        'QUINTINO BOCAIUVA', 'SAMPAIO', 'PRACA DA BANDEIRA', 'SAO CRISTOVAO', 'HUMAITA', 'GAVEA',
        'JARDIM BOTANICO', 'URCA', 'SANTA TERESA', 'RIO COMPRIDO', 'ESTACIO', 'ROCHA', 'RIACHUELO'
    ];
    for (const b of bairrosConhecidosRJ) {
        if (limpo.includes(b)) {
            return b === 'RECREIO DO BANDEIRANTES' ? 'RECREIO DOS BANDEIRANTES' : b;
        }
    }
    return 'OUTROS / VER ENDEREÇO';
}

function obterMacroServicoPlanilha(projeto) {
    const p = (projeto || '').toUpperCase();
    if (p.includes('VISTORIA')) return 'VISTORIA';
    if (p.includes('ATIVAÇÃO') || p.includes('ATIVACAO')) return 'ATIVAÇÃO';
    return 'CONSTRUÇÃO';
}

function obterCodigoBaseImovel(imovelStr) {
    let cod = (imovelStr || '').toUpperCase().trim();
    const idx = cod.lastIndexOf(' - BLOCO');
    if (idx !== -1) cod = cod.substring(0, idx).trim();
    return cod;
}

function enriquecerStatusMacroEBairro(listaRegistros) {
    const mapaPrimeiraDataImovel = {};
    const ordenadosCronologico = [...(registrosSalvos || [])].filter(r =>
        r.projeto !== 'IMPREVISTO / ATRASO' &&
        r.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
        r.projeto !== PROJETO_SOLIC_MATERIAL
    ).sort((a, b) => {
        if (a.dataRegistro !== b.dataRegistro) return (a.dataRegistro || '').localeCompare(b.dataRegistro || '');
        return (a.id || 0) - (b.id || 0);
    });

    ordenadosCronologico.forEach(r => {
        const codBase = obterCodigoBaseImovel(r.imovel);
        if (!codBase) return;
        if (!mapaPrimeiraDataImovel[codBase]) {
            mapaPrimeiraDataImovel[codBase] = { data: r.dataRegistro, id: r.id };
        }
    });

    return listaRegistros.map(r => {
        const codBase = obterCodigoBaseImovel(r.imovel);
        const obsSuperior = ((r.observacoes || '') + ' ' + (r.motivoDesfecho || '')).toUpperCase();
        let statusMacro = 'PROGRAMADO';
        if (obsSuperior.includes('RETORNO') || obsSuperior.includes('REINCID')) {
            statusMacro = 'RETORNO';
        } else if (codBase && mapaPrimeiraDataImovel[codBase]) {
            const prim = mapaPrimeiraDataImovel[codBase];
            if (r.dataRegistro > prim.data) {
                statusMacro = 'RETORNO';
            }
        }
        const bairroExtraido = extrairBairroDoEndereco(r.endereco);
        const semanaMes = obterSemanaDoMes(r.dataRegistro);
        const statusBinarioPlanilha = r.desfecho === 'CONCLUIDA' ? 'EXECUTADO' : 'N EXECUTADO';
        return {
            ...r,
            codigoImovelBase: codBase,
            statusMacroPlanilha: statusMacro,
            bairroPlanilha: bairroExtraido,
            semanaPlanilha: semanaMes,
            servicoPlanilha: obterMacroServicoPlanilha(r.projeto),
            statusBinarioPlanilha: statusBinarioPlanilha
        };
    });
}

// ================= SINCRONIZAÇÃO DE AUDITORIA NA NUVEM (EXCLUSIVA DO MODO GESTÃO) =================
async function sincronizarAuditoriaNaNuvem() {
    try {
        if (trilhaAuditoria.length > 250) trilhaAuditoria = trilhaAuditoria.slice(0, 250);
        localStorage.setItem('gpd_trilha_auditoria', JSON.stringify(trilhaAuditoria));
        const payloadAudit = {
            id: ID_NUVEM_AUDITORIA, data_registro: "2000-01-01", equipe: "__CONFIG_SISTEMA__",
            membros: "__CONFIG_SISTEMA__", projeto: "__CONFIG_AUDITORIA__", imovel: "__CONFIG_AUDITORIA__",
            h_entrada: "00:00", h_saida: "00:00", gps_entrada: "", gps_saida: "", desfecho: "CONFIG",
            motivo_desfecho: "", malogros: [], agendamento: null, observacoes: JSON.stringify(trilhaAuditoria)
        };
        await supabaseClient.from('registros_producao').upsert([payloadAudit], { onConflict: 'id' });
    } catch (e) { console.warn("Aviso ao sincronizar auditoria na nuvem:", e); }
}

async function carregarAuditoriaDaNuvem() {
    try {
        const { data } = await supabaseClient.from('registros_producao').select('observacoes').eq('id', ID_NUVEM_AUDITORIA).maybeSingle();
        if (data && data.observacoes) {
            const listaNuvem = JSON.parse(data.observacoes);
            if (Array.isArray(listaNuvem)) {
                const mapaLogs = new Map();
                [...trilhaAuditoria, ...listaNuvem].forEach(item => { if (item && item.id) mapaLogs.set(item.id, item); });
                trilhaAuditoria = Array.from(mapaLogs.values()).sort((a, b) => b.id - a.id).slice(0, 250);
                localStorage.setItem('gpd_trilha_auditoria', JSON.stringify(trilhaAuditoria));
            }
        }
    } catch (e) { console.warn("Aviso ao ler auditoria da nuvem:", e); }
}

registrarLogAuditoria = function(acao, detalhes) {
    if (!usuarioLogado) return;
    let novoLog = {
        id: Date.now() + Math.floor(Math.random() * 100),
        dataHora: new Date().toLocaleString('pt-BR'),
        usuario: usuarioLogado,
        acao: acao,
        detalhes: detalhes
    };
    trilhaAuditoria.unshift(novoLog);
    setTimeout(() => { sincronizarAuditoriaNaNuvem(); }, 10);
};

function aplicarTooltipsExplicativosGlobais() {
    const mapaTooltips = {
        'btn-modo-campo': 'Alternar para a interface móvel de lançamento de atividades dos técnicos em campo',
        'btn-modo-gestor': 'Acessar o Painel Gerencial completo com indicadores, mapas e controle operacional',
        'btn-sair-gestor': 'Encerrar a sessão atual do gestor e bloquear o acesso administrativo',
        'btn-importar-planilha': 'Importar uma planilha CSV ou colar linhas do Excel para distribuir atividades programadas aos técnicos',
        'btn-boletim-whats-gestor': 'Copiar um resumo executivo formatado com os números do período filtrado para colar no WhatsApp',
        'btn-baixar-excel-gestor': 'Baixar planilha Excel (.xls) com todos os detalhes, materiais, tempos e endereços filtrados na tela',
        'btn-atualizar-registros-gestor': 'Buscar imediatamente na nuvem todas as novas atividades, fotos e posições de GPS das equipes',
        'subtab-btn-atividades': 'Visualizar e gerir todas as atividades em andamento, programadas, paralisadas e finalizadas',
        'subtab-btn-disponibilidade': 'Acompanhar quem iniciou o expediente, quem está livre em rota, em atendimento ou com imprevisto',
        'subtab-btn-mapa': 'Abrir o mapa interativo em tempo real com a localização GPS de todas as equipes ativas hoje',
        'subtab-btn-combustivel': 'Gerir e tratar solicitações de recarga de combustível extra (Exclusão automática 48h após tratada)',
        'subtab-btn-solicitacao_material': 'Gerir e tratar solicitações de reposição de material de campo (Exclusão automática 48h após tratada)',
        'subtab-btn-graficos': 'Analisar os gráficos da planilha ON GOING MDU, Matriz Diária, Programado vs. Retorno e Bairros',
        'subtab-btn-imprevistos': 'Consultar e resolver ocorrências de atraso ou problemas operacionais reportados em campo',
        'subtab-btn-materiais': 'Ver o somatório consolidado e o consumo individual de cabos, conectores, fusões e caixas',
        'subtab-btn-financeiro': 'Calcular automaticamente a medição financeira com base nos materiais e vistorias realizadas',
        'subtab-btn-equipes': 'Cadastrar técnicos, definir grupos de atuação (Vistoriador/Instalador/Ativador) e gerir PINs',
        'subtab-btn-opcoes': 'Personalizar Projetos, Grupos, Combustível, Materiais, Pendências/Malogros e acessar a Central Master de Backup',
        'subtab-btn-usuarios': 'Gerir contas de acesso ao painel (Master, Operador e Visualizador) e alterar senhas',
        'subtab-btn-bonificacao': 'Consultar os indicadores de metas e elegibilidade à bonificação no período',
        'subtab-btn-auditoria': 'Rastrear exclusivamente as ações realizadas no Modo Gestão e monitorar a capacidade da nuvem'
    };
    Object.entries(mapaTooltips).forEach(([id, texto]) => { const el = document.getElementById(id); if (el) el.title = texto; });
}

// ================= INJEÇÃO DE ELEMENTOS AVANÇADOS (FILTRO MÚLTIPLO E CENTRAL DE BACKUP) =================
function inicializarMelhoriasVisuaisGestor() {
    aplicarTooltipsExplicativosGlobais();

    const selDesf = document.getElementById('gestor-filtro-desfecho');
    if (selDesf && !document.getElementById('btn-abrir-filtro-multiplo')) {
        const btnMulti = document.createElement('button');
        btnMulti.type = 'button';
        btnMulti.id = 'btn-abrir-filtro-multiplo';
        btnMulti.onclick = abrirModalFiltroMultiplo;
        btnMulti.title = 'Abrir seletor avançado para marcar simultaneamente várias Equipes, Grupos, Projetos e Status';
        btnMulti.className = 'bg-amber-400 hover:bg-amber-300 text-blue-950 font-black text-[11px] px-2.5 py-1 rounded-lg shadow-sm transition whitespace-nowrap flex items-center gap-1 shrink-0';
        btnMulti.innerHTML = `☑️ Filtro Múltiplo <span id="badge-qtd-filtros-multi" class="bg-blue-950 text-cyan-300 px-1.5 py-0.2 rounded text-[9px] hidden">0</span>`;
        selDesf.parentNode.appendChild(btnMulti);
    }

    const subBarra = document.getElementById('header-gestor-subbarra');
    if (subBarra) {
        const divBotoesExtras = subBarra.querySelector('.ml-auto');
        if (divBotoesExtras && !divBotoesExtras.id) {
            divBotoesExtras.id = 'botoes-atalho-exclusivos-disponibilidade';
            divBotoesExtras.classList.add('hidden');
        }
    }

    if (!document.getElementById('modal-filtro-multiplo')) {
        const modalMulti = document.createElement('div');
        modalMulti.id = 'modal-filtro-multiplo';
        modalMulti.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 hidden z-[78]';
        modalMulti.innerHTML = `
            <div class="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                <div class="bg-blue-900 text-white px-5 py-3.5 flex justify-between items-center border-b-4 border-amber-400">
                    <div>
                        <span class="bg-amber-400 text-blue-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Filtro Avançado Combinado</span>
                        <h3 class="font-bold text-sm sm:text-base mt-0.5">☑️ Seleção Múltipla de Equipes, Grupos, Projetos e Status</h3>
                    </div>
                    <button onclick="fecharModalFiltroMultiplo()" class="text-white font-bold text-lg hover:text-red-300">✕</button>
                </div>
                <div class="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                            <div class="font-black text-blue-950 uppercase text-[11px] border-b pb-1">1. Funções / Setores</div>
                            <div id="multi-lista-setores" class="space-y-1.5"></div>
                            <div class="font-black text-indigo-950 uppercase text-[11px] border-b pb-1 pt-2">2. Grupos de Projeto</div>
                            <div id="multi-lista-macrogrupos" class="space-y-1.5"></div>
                        </div>
                        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                            <div class="font-black text-blue-950 uppercase text-[11px] border-b pb-1">3. Tipos de Serviço / Projetos</div>
                            <div id="multi-lista-projetos" class="space-y-1.5 max-h-40 overflow-y-auto"></div>
                            <div class="font-black text-emerald-950 uppercase text-[11px] border-b pb-1 pt-2">4. Status / Desfechos</div>
                            <div id="multi-lista-desfechos" class="space-y-1.5"></div>
                        </div>
                        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col">
                            <div class="flex justify-between items-center border-b pb-1 mb-2">
                                <span class="font-black text-blue-950 uppercase text-[11px]">5. Equipes / Técnicos</span>
                                <div class="flex gap-1">
                                    <button type="button" onclick="marcarOuDesmarcarTodasEquipesMulti(true)" class="text-[9px] bg-blue-100 text-blue-900 font-bold px-1.5 py-0.5 rounded">Todos</button>
                                    <button type="button" onclick="marcarOuDesmarcarTodasEquipesMulti(false)" class="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">Limpar</button>
                                </div>
                            </div>
                            <div id="multi-lista-equipes" class="space-y-1 overflow-y-auto max-h-64 pr-1"></div>
                        </div>
                    </div>
                </div>
                <div class="bg-slate-100 px-5 py-3 border-t flex justify-between items-center">
                    <button type="button" onclick="limparFiltrosMultiplos()" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs px-4 py-2 rounded-xl font-bold">🗑️ Limpar Seleção Múltipla</button>
                    <div class="flex gap-2">
                        <button type="button" onclick="fecharModalFiltroMultiplo()" class="bg-slate-300 text-slate-800 text-xs px-4 py-2 rounded-xl font-bold">Cancelar</button>
                        <button type="button" onclick="aplicarFiltrosMultiplosDoModal()" class="bg-blue-900 hover:bg-blue-950 text-white text-xs px-5 py-2 rounded-xl font-black shadow-md">✅ Aplicar Filtros Selecionados</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modalMulti);
    }

    const viewOpcoes = document.getElementById('subview-opcoes');
    if (viewOpcoes && !document.getElementById('central-master-backup-nuvem')) {
        const divBackup = document.createElement('div');
        divBackup.id = 'central-master-backup-nuvem';
        divBackup.className = 'mt-6 pt-5 border-t-2 border-slate-200 space-y-4';
        divBackup.innerHTML = `
            <div class="bg-slate-900 text-white p-4 rounded-2xl shadow-md space-y-3">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-700 pb-3">
                    <div>
                        <span class="bg-cyan-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Exclusivo Master • Proteção de Dados</span>
                        <h4 class="font-bold text-sm sm:text-base mt-1">💾 Central de Backup Integral (.JSON), Consulta Histórica e Alívio de Nuvem</h4>
                        <p class="text-[11px] text-slate-300">Faça o download completo com fotos para o seu computador, consulte arquivos antigos sem ocupar o banco ou limpe fotos antigas.</p>
                    </div>
                    <span id="badge-estimativa-peso-nuvem" class="bg-slate-800 border border-slate-600 text-cyan-300 font-mono text-xs px-3 py-1.5 rounded-xl whitespace-nowrap">Calculando uso...</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    <div class="bg-slate-800/90 border border-slate-700 p-3.5 rounded-xl space-y-2.5 flex flex-col justify-between">
                        <div>
                            <h5 class="font-black text-cyan-300 text-xs uppercase">1. Exportar Backup Completo (.JSON)</h5>
                            <p class="text-[11px] text-slate-300 mt-1">Salva num único ficheiro no seu PC 100% dos registos, fotos, opções, projetos, grupos, equipes e auditoria.</p>
                            <div class="grid grid-cols-2 gap-1.5 mt-2">
                                <div><label class="text-[9px] text-slate-400 uppercase font-bold block">De (Opcional):</label><input type="date" id="bkp-data-inicio" class="w-full text-[11px] bg-slate-900 border border-slate-600 rounded p-1 text-white"></div>
                                <div><label class="text-[9px] text-slate-400 uppercase font-bold block">Até (Opcional):</label><input type="date" id="bkp-data-fim" class="w-full text-[11px] bg-slate-900 border border-slate-600 rounded p-1 text-white"></div>
                            </div>
                        </div>
                        <button type="button" onclick="baixarBackupIntegralJSON()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs transition shadow">📦 Baixar Backup Integral (.JSON)</button>
                    </div>
                    <div class="bg-slate-800/90 border border-slate-700 p-3.5 rounded-xl space-y-2.5 flex flex-col justify-between">
                        <div>
                            <h5 class="font-black text-amber-300 text-xs uppercase">2. Carregar / Restaurar Backup (.JSON)</h5>
                            <p class="text-[11px] text-slate-300 mt-1">Abra um ficheiro de backup antigo no <b>Modo Consulta Temporária</b> ou restaure os dados de volta para o Supabase.</p>
                            <input type="file" id="inp-upload-backup-json" accept=".json" class="w-full text-[10px] bg-slate-900 border border-slate-600 rounded-lg p-1.5 text-slate-200 mt-2">
                        </div>
                        <div class="grid grid-cols-2 gap-1.5">
                            <button type="button" onclick="processarArquivoBackupJSON('consulta')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2 px-2 rounded-xl text-[11px] transition shadow">👁️ Modo Consulta</button>
                            <button type="button" onclick="processarArquivoBackupJSON('nuvem')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2 px-2 rounded-xl text-[11px] transition shadow">☁️ Subir p/ Nuvem</button>
                        </div>
                    </div>
                    <div class="bg-slate-800/90 border border-red-900/60 p-3.5 rounded-xl space-y-2.5 flex flex-col justify-between">
                        <div>
                            <h5 class="font-black text-red-400 text-xs uppercase">3. Limpeza Inteligente da Nuvem</h5>
                            <p class="text-[11px] text-slate-300 mt-1">Após baixar o seu backup, limpe as fotos antigas (mantendo todos os números) ou remova registos antigos.</p>
                            <div class="mt-2"><label class="text-[9px] text-red-300 uppercase font-bold block">Limpar registos anteriores a:*</label><input type="date" id="expurgo-data-limite" class="w-full text-[11px] bg-slate-900 border border-red-700 rounded p-1 text-white"></div>
                        </div>
                        <div class="grid grid-cols-2 gap-1.5">
                            <button type="button" onclick="executarLimpezaInteligenteNuvem('apenas_fotos')" class="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-2 rounded-xl text-[10px] transition shadow">🧹 Limpar Só Fotos</button>
                            <button type="button" onclick="executarLimpezaInteligenteNuvem('registros_completos')" class="bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-2 rounded-xl text-[10px] transition shadow">🗑️ Excluir Antigos</button>
                        </div>
                    </div>
                </div>
            </div>`;
        viewOpcoes.appendChild(divBackup);
    }
}

setTimeout(inicializarMelhoriasVisuaisGestor, 350);

// ================= SOLICITAÇÕES DE COMBUSTÍVEL E MATERIAL (COM AUTO-EXCLUSÃO EM 48H) =================
function calcularTempoRestante48h(timestampTratado) {
    if (!timestampTratado || isNaN(timestampTratado)) return "Exclusão em 48h";
    const decorrido = Date.now() - Number(timestampTratado);
    const restanteMs = Math.max(0, PRAZO_EXPURGO_48H_MS - decorrido);
    const horas = Math.floor(restanteMs / (1000 * 60 * 60));
    const min = Math.floor((restanteMs % (1000 * 60 * 60)) / (1000 * 60));
    return `Auto-exclusão em ${horas}h ${min}m`;
}

async function abrirFotosSolicitacaoCombustivelModal(idReg) {
    const reg = (registrosSalvos || []).find(r => r.id === idReg);
    if (!reg) return;
    await abrirDetalhesAtividade(reg);
}

async function marcarSolicitacaoComoTratada(idReg) {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') {
        alert("⚠️ Apenas usuários Master ou Operador podem marcar solicitações como tratadas.");
        return;
    }
    const reg = (registrosSalvos || []).find(r => r.id === idReg);
    if (!reg) return;

    const ehComb = reg.projeto === PROJETO_SOLIC_COMBUSTIVEL;
    const obsGestor = prompt(
        `✅ MARCAR SOLICITAÇÃO COMO TRATADA (${ehComb ? 'COMBUSTÍVEL' : 'MATERIAL'})\n\nTécnico: ${reg.equipe}\nDetalhe: ${reg.imovel}\n\nDeseja incluir alguma observação da tratativa? (O registro e as fotos serão excluídos automaticamente em 48h):`,
        "Atendido / Liberado pela gestão"
    );
    if (obsGestor === null) return;

    const uObj = (usuariosSistema || []).find(u => u.email.toLowerCase() === (usuarioLogado || '').toLowerCase());
    const nomeTratador = uObj ? `${uObj.nome} (${usuarioLogado})` : (usuarioLogado || 'Gestor');
    const dataHoraAgora = new Date().toLocaleString('pt-BR');
    const tsAgora = Date.now();

    let fotosAtuais = Array.isArray(reg.fotos) ? reg.fotos : [];
    if (fotosAtuais.length === 0 && typeof obterFotosSobDemandaDoRegistro === 'function' && Number(reg.qtdFotos) > 0) {
        fotosAtuais = await obterFotosSobDemandaDoRegistro(reg.id);
    }

    const tagEnd = reg.endereco ? `[END: ${reg.endereco}] ` : '';
    const tagTratado = `[TRATADO_POR: ${nomeTratador}] [TRATADO_EM: ${dataHoraAgora}] [TRATADO_TS: ${tsAgora}] `;
    const sufixoFotos = (fotosAtuais && fotosAtuais.length > 0) ? ` [FOTOS:${JSON.stringify(fotosAtuais)}]` : '';
    const textoObsLimpo = obsGestor.trim() ? `${reg.observacoes ? reg.observacoes + ' | ' : ''}Tratativa: ${obsGestor.trim()}` : (reg.observacoes || '');
    const obsFinalBanco = `${tagEnd}${tagTratado}${textoObsLimpo}${sufixoFotos}`.trim();
    const horaCurta = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    const { error } = await supabaseClient.from('registros_producao').update({
        desfecho: "TRATADA", h_saida: horaCurta, observacoes: obsFinalBanco
    }).eq('id', idReg);

    if (error) { alert("❌ Erro ao registrar tratativa: " + error.message); return; }

    reg.desfecho = "TRATADA";
    reg.hSaida = horaCurta;
    reg.tratadoPor = nomeTratador;
    reg.tratadoDataHora = dataHoraAgora;
    reg.tratadoTimestamp = tsAgora;
    reg.observacoes = textoObsLimpo;

    registrarLogAuditoria(
        ehComb ? "COMBUSTÍVEL TRATADO" : "MATERIAL TRATADO",
        `Solicitação de ${reg.equipe} (${reg.imovel}) marcada como TRATADA por ${nomeTratador} em ${dataHoraAgora}. Auto-exclusão em 48h.`
    );

    atualizarDashboardGestor();
    alert(`✅ Solicitação marcada como TRATADA por ${nomeTratador} em ${dataHoraAgora}!\n\nEste registro (e suas fotos) será excluído automaticamente do sistema após 48 horas.`);
}

function renderizarTabelasSolicitacoesGestor() {
    const corpoComb = document.getElementById('tabela-solic-combustivel-corpo');
    const corpoMat  = document.getElementById('tabela-solic-material-corpo');

    const pendComb = listaSolicitacoesCombustivelAtuais.filter(r => r.desfecho !== 'TRATADA').length;
    const pendMat  = listaSolicitacoesMaterialAtuais.filter(r => r.desfecho !== 'TRATADA').length;

    const badgeComb = document.getElementById('badge-aba-combustivel');
    const badgeMat  = document.getElementById('badge-aba-solic-material');
    const contComb  = document.getElementById('contador-solic-combustivel');
    const contMat   = document.getElementById('contador-solic-material');

    if (badgeComb) badgeComb.innerText = `${pendComb} pend.`;
    if (badgeMat) badgeMat.innerText = `${pendMat} pend.`;
    if (contComb) contComb.innerText = `${listaSolicitacoesCombustivelAtuais.length} solicitação(ões) (${pendComb} pendente(s))`;
    if (contMat) contMat.innerText = `${listaSolicitacoesMaterialAtuais.length} solicitação(ões) (${pendMat} pendente(s))`;

    const podeTratar = (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador');

    if (corpoComb) {
        corpoComb.innerHTML = "";
        if (listaSolicitacoesCombustivelAtuais.length === 0) {
            corpoComb.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">Nenhuma solicitação de recarga de combustível ativa no momento.</td></tr>`;
        } else {
            listaSolicitacoesCombustivelAtuais.forEach(item => {
                const tratada = item.desfecho === 'TRATADA';
                const qtdFotos = Number(item.qtdFotos) || (Array.isArray(item.fotos) ? item.fotos.length : 0);
                const labelsFotos = Array.isArray(item.malogros) && item.malogros.length > 0 ? item.malogros.join(' • ') : 'Painel + Mapa de Bordo';

                const statusHtml = tratada
                    ? `<div class="space-y-0.5"><span class="bg-emerald-100 text-emerald-900 border border-emerald-300 font-black px-2 py-0.5 rounded text-[10px] inline-block">🟢 TRATADA</span><div class="text-[10px] text-slate-700 font-bold">👤 Por: ${item.tratadoPor || 'Gestor'}</div><div class="text-[10px] text-slate-500 font-mono">🕒 Em: ${item.tratadoDataHora || item.hSaida}</div><div class="text-[9px] text-orange-700 font-bold">⏳ ${calcularTempoRestante48h(item.tratadoTimestamp)}</div></div>`
                    : `<span class="bg-amber-100 text-amber-900 border border-amber-300 font-black px-2.5 py-1 rounded text-[10px] inline-block animate-pulse">🟡 AGUARDANDO TRATATIVA</span>`;

                let botoesHtml = `<span class="text-slate-400 text-[10px]">Leitura</span>`;
                if (podeTratar) {
                    botoesHtml = `<div class="flex flex-wrap gap-1">${!tratada ? `<button onclick="marcarSolicitacaoComoTratada(${item.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded shadow-sm">✅ Marcar Tratada</button>` : ''}<button onclick="abrirFotosSolicitacaoCombustivelModal(${item.id})" class="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-[10px] px-2 py-1 rounded">📷 Ver Fotos (${qtdFotos})</button><button onclick="excluirRegistro(${item.id}, '${item.imovel}')" class="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[10px] px-2 py-1 rounded">🗑️</button></div>`;
                }

                const tr = document.createElement('tr');
                tr.className = tratada ? "bg-slate-50/70 border-b hover:bg-slate-100/70 transition cursor-pointer" : "bg-orange-50/30 border-b hover:bg-orange-50/70 transition cursor-pointer";
                tr.onclick = () => abrirDetalhesAtividade(item);
                tr.innerHTML = `<td class="p-3"><div class="font-bold text-slate-800">${item.dataRegistro}</div><div class="text-[10px] font-mono text-slate-500">Solicitado às ${item.hEntrada}</div></td><td class="p-3 font-bold text-blue-950">${item.equipe}</td><td class="p-3"><span class="bg-orange-100 text-orange-950 border border-orange-300 font-black px-2.5 py-1 rounded text-xs inline-block">${item.imovel}</span></td><td class="p-3 text-slate-700 font-medium">${item.motivoDesfecho || '-'}</td><td class="p-3"><span class="bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold px-2 py-0.5 rounded text-[10px] inline-block">📷 ${qtdFotos} foto(s)</span><div class="text-[9px] text-slate-500 mt-0.5">${labelsFotos}</div></td><td class="p-3">${statusHtml}</td><td class="p-3 whitespace-nowrap" onclick="event.stopPropagation()">${botoesHtml}</td>`;
                corpoComb.appendChild(tr);
            });
        }
    }

    if (corpoMat) {
        corpoMat.innerHTML = "";
        if (listaSolicitacoesMaterialAtuais.length === 0) {
            corpoMat.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">Nenhuma solicitação de material ativa no momento.</td></tr>`;
        } else {
            listaSolicitacoesMaterialAtuais.forEach(item => {
                const tratada = item.desfecho === 'TRATADA';
                const tagsItens = Array.isArray(item.malogros) && item.malogros.length > 0
                    ? item.malogros.map(m => `<span class="bg-indigo-100 text-indigo-950 border border-indigo-300 font-black px-2 py-0.5 rounded text-[10px] inline-block">${m}</span>`).join(' ')
                    : `<span class="font-bold text-slate-700">${item.motivoDesfecho || '-'}</span>`;

                const statusHtml = tratada
                    ? `<div class="space-y-0.5"><span class="bg-emerald-100 text-emerald-900 border border-emerald-300 font-black px-2 py-0.5 rounded text-[10px] inline-block">🟢 TRATADA</span><div class="text-[10px] text-slate-700 font-bold">👤 Por: ${item.tratadoPor || 'Gestor'}</div><div class="text-[10px] text-slate-500 font-mono">🕒 Em: ${item.tratadoDataHora || item.hSaida}</div><div class="text-[9px] text-indigo-700 font-bold">⏳ ${calcularTempoRestante48h(item.tratadoTimestamp)}</div></div>`
                    : `<span class="bg-amber-100 text-amber-900 border border-amber-300 font-black px-2.5 py-1 rounded text-[10px] inline-block animate-pulse">🟡 AGUARDANDO TRATATIVA</span>`;

                let botoesHtml = `<span class="text-slate-400 text-[10px]">Leitura</span>`;
                if (podeTratar) {
                    botoesHtml = `<div class="flex flex-wrap gap-1">${!tratada ? `<button onclick="marcarSolicitacaoComoTratada(${item.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded shadow-sm">✅ Marcar Tratada</button>` : ''}<button onclick="excluirRegistro(${item.id}, '${item.imovel}')" class="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[10px] px-2 py-1 rounded">🗑️ Excluir</button></div>`;
                }

                const tr = document.createElement('tr');
                tr.className = tratada ? "bg-slate-50/70 border-b hover:bg-slate-100/70 transition cursor-pointer" : "bg-indigo-50/30 border-b hover:bg-indigo-50/70 transition cursor-pointer";
                tr.onclick = () => abrirDetalhesAtividade(item);
                tr.innerHTML = `<td class="p-3"><div class="font-bold text-slate-800">${item.dataRegistro}</div><div class="text-[10px] font-mono text-slate-500">Solicitado às ${item.hEntrada}</div></td><td class="p-3 font-bold text-blue-950">${item.equipe}</td><td class="p-3"><div class="flex flex-wrap gap-1">${tagsItens}</div></td><td class="p-3 text-slate-600">${item.observacoes || item.responsavel || '-'}</td><td class="p-3">${statusHtml}</td><td class="p-3 whitespace-nowrap" onclick="event.stopPropagation()">${botoesHtml}</td>`;
                corpoMat.appendChild(tr);
            });
        }
    }
}

// ================= FILTROS DE MARCAÇÃO MÚLTIPLA =================
function abrirModalFiltroMultiplo() {
    inicializarMelhoriasVisuaisGestor();
    const modal = document.getElementById('modal-filtro-multiplo');
    if (!modal) return;

    const desenharChecks = (idContainer, opcoes, arraySelecionados, nomeGrupo) => {
        const el = document.getElementById(idContainer);
        if (!el) return;
        el.innerHTML = opcoes.map(op => `<label class="flex items-center gap-2 font-semibold text-slate-700 hover:bg-blue-50 p-1 rounded cursor-pointer"><input type="checkbox" name="${nomeGrupo}" value="${op.valor}" ${arraySelecionados.includes(op.valor) ? 'checked' : ''} class="w-4 h-4 accent-blue-900 rounded"><span class="text-[11px]">${op.label}</span></label>`).join('');
    };

    desenharChecks('multi-lista-setores', [{ valor: 'Vistoriador', label: '🔍 Vistoriador' }, { valor: 'Instalador', label: '🛠️ Instalador' }, { valor: 'Ativador', label: '⚡ Ativador' }], filtrosMultiplosAtivos.setores, 'chk-multi-setor');
    desenharChecks('multi-lista-macrogrupos', GRUPOS_PROJETO_SISTEMA.map(grp => ({ valor: grp, label: `📂 Grupo ${grp}` })), filtrosMultiplosAtivos.macrogrupos, 'chk-multi-macro');
    desenharChecks('multi-lista-projetos', CATALOGO_PROJETOS_SISTEMA.map(p => ({ valor: p.nome, label: `${p.nome} (${p.grupo})` })), filtrosMultiplosAtivos.projetos, 'chk-multi-projeto');
    desenharChecks('multi-lista-desfechos', [{ valor: 'PROGRAMADA', label: '📋 Programadas' }, { valor: 'EM ANDAMENTO', label: '🔵 Em Andamento' }, { valor: 'PARALISADA', label: '⏸️ Paralisadas' }, { valor: 'REABERTA', label: '🔄 Reabertas' }, { valor: 'CONCLUIDA', label: '🟢 Concluídas' }, { valor: 'PENDENTE', label: '🟡 Pendentes' }, { valor: 'MALOGRADA', label: '🔴 Malogradas' }], filtrosMultiplosAtivos.desfechos, 'chk-multi-desfecho');
    desenharChecks('multi-lista-equipes', equipesSistema.map(e => ({ valor: e.nome, label: `${e.nome} (${formatarSetoresString(e.setor)})` })), filtrosMultiplosAtivos.equipes, 'chk-multi-equipe');
    modal.classList.remove('hidden');
}

function fecharModalFiltroMultiplo() { document.getElementById('modal-filtro-multiplo')?.classList.add('hidden'); }
function marcarOuDesmarcarTodasEquipesMulti(marcar) { document.querySelectorAll('input[name="chk-multi-equipe"]').forEach(c => c.checked = marcar); }

function atualizarBadgeFiltroMultiplo() {
    const total = filtrosMultiplosAtivos.equipes.length + filtrosMultiplosAtivos.setores.length + filtrosMultiplosAtivos.macrogrupos.length + filtrosMultiplosAtivos.projetos.length + filtrosMultiplosAtivos.desfechos.length;
    const badge = document.getElementById('badge-qtd-filtros-multi');
    if (!badge) return;
    if (total > 0) { badge.innerText = total; badge.classList.remove('hidden'); }
    else { badge.classList.add('hidden'); }
}

function aplicarFiltrosMultiplosDoModal() {
    const lerGrupo = (nome) => Array.from(document.querySelectorAll(`input[name="${nome}"]:checked`)).map(c => c.value);
    filtrosMultiplosAtivos.setores = lerGrupo('chk-multi-setor');
    filtrosMultiplosAtivos.macrogrupos = lerGrupo('chk-multi-macro');
    filtrosMultiplosAtivos.projetos = lerGrupo('chk-multi-projeto');
    filtrosMultiplosAtivos.desfechos = lerGrupo('chk-multi-desfecho');
    filtrosMultiplosAtivos.equipes = lerGrupo('chk-multi-equipe');

    if (filtrosMultiplosAtivos.equipes.length > 0) document.getElementById('gestor-filtro-equipe').value = "";
    if (filtrosMultiplosAtivos.projetos.length > 0) document.getElementById('gestor-filtro-projeto').value = "";
    if (filtrosMultiplosAtivos.desfechos.length > 0) document.getElementById('gestor-filtro-desfecho').value = "";

    atualizarBadgeFiltroMultiplo();
    fecharModalFiltroMultiplo();
    atualizarDashboardGestor();
}

function limparFiltrosMultiplos() {
    filtrosMultiplosAtivos = { equipes: [], setores: [], macrogrupos: [], projetos: [], desfechos: [] };
    atualizarBadgeFiltroMultiplo();
    fecharModalFiltroMultiplo();
    atualizarDashboardGestor();
}

// ================= CENTRAL MASTER DE BACKUP (.JSON), RESTAURAÇÃO E EXPURGO SEGURO =================
function atualizarEstimativaPesoNuvem() {
    if (typeof renderizarPainelCapacidadeNuvem === "function") renderizarPainelCapacidadeNuvem();
}

function baixarBackupIntegralJSON() {
    if (nivelUsuarioLogado !== 'Master') { alert("⚠️ Apenas o perfil Master pode exportar o Backup Integral do banco de dados."); return; }
    const dIni = document.getElementById('bkp-data-inicio')?.value || "";
    const dFim = document.getElementById('bkp-data-fim')?.value || "";

    let listaExportar = (registrosSalvos || []).map(r => ({
        id: r.id, dataRegistro: r.dataRegistro, equipe: r.equipe, membros: r.membros, projeto: r.projeto,
        imovel: r.imovel, endereco: r.endereco, liberouAcesso: r.liberouAcesso, tempoPausadoMinutos: r.tempoPausadoMinutos,
        qtdBlocosProgramados: r.qtdBlocosProgramados, fotos: (typeof cacheFotosSobDemanda !== 'undefined' && cacheFotosSobDemanda.get(r.id)) || r.fotos || [],
        hEntrada: r.hEntrada, hSaida: r.hSaida, gpsEntrada: r.gpsEntrada, gpsSaida: r.gpsSaida, desfecho: r.desfecho,
        motivoDesfecho: r.motivoDesfecho, malogros: r.malogros, responsavel: r.responsavel, contato: r.contato,
        email: r.email, agendamento: r.agendamento, andares: r.andares, hps: r.hps, servicoObra: r.servicoObra,
        observacoes: r.observacoes, fusoes: r.fusoes, conectores: r.conectores, caboRL: r.caboRL, caboDrop: r.caboDrop,
        nap: r.nap, dio: r.dio, cxSobrepor: r.cxSobrepor, cxEmbutida: r.cxEmbutida, cxFosc: r.cxFosc
    })).filter(r => {
        if (dIni && r.dataRegistro < dIni) return false;
        if (dFim && r.dataRegistro > dFim) return false;
        return true;
    });

    if (listaExportar.length === 0) { alert("⚠️ Nenhum registo encontrado no intervalo de datas selecionado para gerar o backup."); return; }

    const pacoteBackup = {
        sistema: "GPD MDU PROCISA RJ", versaoBackup: "5.0", dataExportacao: new Date().toISOString(), exportadoPor: usuarioLogado,
        periodoFiltro: { inicio: dIni || "INICIO", fim: dFim || "HOJE" },
        configuracoes: {
            equipes: equipesSistema, usuarios: usuariosSistema, gruposProjeto: GRUPOS_PROJETO_SISTEMA,
            catalogoProjetos: CATALOGO_PROJETOS_SISTEMA, opcoesCombustivel: OPCOES_COMBUSTIVEL_PADRAO,
            opcoesMaterialSolicitacao: OPCOES_MATERIAL_SOLICITACAO, opcoesPendencia: OPCOES_PENDENCIA_PADRAO,
            opcoesMalogro: OPCOES_MALOGRO_PADRAO, opcoesImprevisto: OPCOES_IMPREVISTO_PADRAO, auditoria: trilhaAuditoria
        },
        registros: listaExportar
    };

    const blob = new Blob([JSON.stringify(pacoteBackup)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const sufixoData = (dIni || dFim) ? `${dIni || 'inicio'}_a_${dFim || 'hoje'}` : `completo_${obterDataLocalISO()}`;
    a.href = url;
    a.download = `BACKUP_GPD_PROCISA_${sufixoData}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);

    registrarLogAuditoria("BACKUP INTEGRAL (.JSON)", `Baixado ficheiro de backup com ${listaExportar.length} registos (Período: ${sufixoData}).`);
    alert(`✅ Backup Integral (.JSON) gerado com sucesso!\n\nForam exportados ${listaExportar.length} registos.`);
}

async function processarArquivoBackupJSON(modo) {
    if (nivelUsuarioLogado !== 'Master') { alert("⚠️ Apenas o perfil Master pode carregar ou restaurar ficheiros de backup."); return; }
    const inp = document.getElementById('inp-upload-backup-json');
    const file = inp?.files && inp.files[0];
    if (!file) { alert("⚠️ Selecione primeiro um ficheiro .JSON de backup."); return; }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const pacote = JSON.parse(e.target.result);
            if (!pacote || !Array.isArray(pacote.registros)) { alert("❌ Ficheiro inválido!"); return; }

            if (modo === 'consulta') {
                if (!modoConsultaBackupAtivo) cacheRegistrosNuvemOriginal = [...registrosSalvos];
                modoConsultaBackupAtivo = true;
                if (typeof cacheFotosSobDemanda !== 'undefined') cacheFotosSobDemanda.clear();
                registrosSalvos = pacote.registros.map(r => {
                    if (typeof cacheFotosSobDemanda !== 'undefined' && Array.isArray(r.fotos)) cacheFotosSobDemanda.set(r.id, r.fotos);
                    return { ...r, qtdFotos: Array.isArray(r.fotos) ? r.fotos.length : 0 };
                });
                if (typeof reciclarContagemBytesFotos === 'function') reciclarContagemBytesFotos();
                exibirBannerModoConsultaBackup(file.name, registrosSalvos.length);
                atualizarDashboardGestor();
                mudarSubAbaGestor('atividades');
                alert(`👁️ MODO CONSULTA DE BACKUP ATIVADO!\n\nVisualizando ${registrosSalvos.length} registos do ficheiro "${file.name}".`);
            } else if (modo === 'nuvem') {
                if (!confirm(`☁️ RESTAURAR BACKUP PARA A NUVEM\n\nDeseja enviar os ${pacote.registros.length} registos do ficheiro "${file.name}" de volta para o Supabase?`)) return;
                if (pacote.configuracoes) {
                    if (Array.isArray(pacote.configuracoes.gruposProjeto)) GRUPOS_PROJETO_SISTEMA = pacote.configuracoes.gruposProjeto;
                    if (Array.isArray(pacote.configuracoes.catalogoProjetos)) CATALOGO_PROJETOS_SISTEMA = pacote.configuracoes.catalogoProjetos;
                    await sincronizarOpcoesNaNuvem();
                }
                const linhasParaUpsert = pacote.registros.map(r => {
                    let tagEnd = r.endereco ? `[END: ${r.endereco}] ` : '';
                    let tagLiberou = r.liberouAcesso ? `[LIBEROU_ACESSO: ${r.liberouAcesso}] ` : '';
                    let tagPausa = r.tempoPausadoMinutos > 0 ? `[PAUSA_TOTAL: ${r.tempoPausadoMinutos}] ` : '';
                    let sufixoBlocos = r.qtdBlocosProgramados > 1 ? ` [BLOCOS: ${r.qtdBlocosProgramados}]` : '';
                    let fotosArr = (typeof cacheFotosSobDemanda !== 'undefined' && cacheFotosSobDemanda.get(r.id)) || r.fotos || [];
                    let sufixoFotos = (fotosArr && fotosArr.length > 0) ? ` [FOTOS:${JSON.stringify(fotosArr)}]` : '';
                    let obsCompleta = `${tagEnd}${tagLiberou}${tagPausa}${r.observacoes || ''}${sufixoBlocos}${sufixoFotos}`.trim();
                    return {
                        id: r.id, data_registro: r.dataRegistro, equipe: r.equipe, membros: r.membros || r.equipe,
                        projeto: r.projeto, imovel: r.imovel, h_entrada: r.hEntrada, h_saida: r.hSaida,
                        gps_entrada: r.gpsEntrada, gps_saida: r.gpsSaida, desfecho: r.desfecho, motivo_desfecho: r.motivoDesfecho,
                        malogros: r.malogros || [], responsavel: r.responsavel || '', contato: r.contato || '', email: r.email || '',
                        agendamento: null, andares: Number(r.andares) || 0, hps: Number(r.hps) || 0, servico_obra: r.servicoObra || 'SIM',
                        observacoes: obsCompleta, fusoes: Number(r.fusoes) || 0, conectores: Number(r.conectores) || 0,
                        cabo_rl: Number(r.caboRL) || 0, cabo_drop: Number(r.caboDrop) || 0, nap: Number(r.nap) || 0,
                        dio: Number(r.dio) || 0, cx_sobrepor: Number(r.cxSobrepor) || 0, cx_embutida: Number(r.cxEmbutida) || 0, cx_fosc: Number(r.cxFosc) || 0
                    };
                });
                for (let i = 0; i < linhasParaUpsert.length; i += 25) {
                    const { error } = await supabaseClient.from('registros_producao').upsert(linhasParaUpsert.slice(i, i + 25), { onConflict: 'id' });
                    if (error) throw error;
                }
                registrarLogAuditoria("RESTAURAÇÃO DE BACKUP NUVEM", `Restaurados ${linhasParaUpsert.length} registos a partir do ficheiro ${file.name}.`);
                inp.value = "";
                await recarregarDadosGestor(true);
                alert(`✅ ${linhasParaUpsert.length} registos foram restaurados para a nuvem com sucesso!`);
            }
        } catch (err) { alert("❌ Erro ao processar ficheiro de backup: " + err.message); }
    };
    reader.readAsText(file, 'UTF-8');
}

function exibirBannerModoConsultaBackup(nomeArquivo, qtd) {
    let banner = document.getElementById('banner-modo-consulta-backup');
    const mainGestor = document.getElementById('view-gestor');
    if (!mainGestor) return;
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'banner-modo-consulta-backup';
        banner.className = 'bg-indigo-950 text-white p-3.5 rounded-xl border-2 border-amber-400 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-lg';
        mainGestor.insertBefore(banner, mainGestor.firstChild);
    }
    banner.classList.remove('hidden');
    banner.innerHTML = `<div class="flex items-center gap-3"><span class="text-2xl">📂</span><div><h4 class="font-black text-amber-300 text-xs uppercase">Modo Consulta de Backup Histórico Ativo (${nomeArquivo})</h4><p class="text-xs text-indigo-100">Exibindo <b>${qtd} registos</b> carregados localmente do ficheiro.</p></div></div><button type="button" onclick="sairModoConsultaBackup()" class="bg-amber-400 hover:bg-amber-300 text-indigo-950 font-black text-xs px-4 py-2 rounded-xl shadow whitespace-nowrap">🔙 Sair do Modo Consulta e Voltar ao Vivo</button>`;
}

async function sairModoConsultaBackup() {
    modoConsultaBackupAtivo = false;
    if (cacheRegistrosNuvemOriginal) { registrosSalvos = [...cacheRegistrosNuvemOriginal]; cacheRegistrosNuvemOriginal = null; }
    else { await carregarRegistrosDaNuvem(true); }
    document.getElementById('banner-modo-consulta-backup')?.classList.add('hidden');
    atualizarDashboardGestor();
}

async function executarLimpezaInteligenteNuvem(tipoExpurgo) {
    if (nivelUsuarioLogado !== 'Master') { alert("⚠️ Apenas o usuário Master pode executar a limpeza inteligente da nuvem."); return; }
    const dataLimite = document.getElementById('expurgo-data-limite')?.value;
    if (!dataLimite) { alert("⚠️ Selecione primeiro a data limite."); return; }

    const alvos = (registrosSalvos || []).filter(r => r.dataRegistro && r.dataRegistro < dataLimite);
    if (alvos.length === 0) { alert(`ℹ️ Nenhum registo encontrado com data anterior a ${dataLimite}.`); return; }

    if (tipoExpurgo === 'apenas_fotos') {
        const comFotos = alvos.filter(r => (Number(r.qtdFotos) || (Array.isArray(r.fotos) ? r.fotos.length : 0)) > 0);
        if (comFotos.length === 0) { alert(`ℹ️ Nenhum registo anterior a ${dataLimite} possui fotos anexadas.`); return; }
        if (!confirm(`🧹 LIMPAR APENAS FOTOS ANTIGAS (ANTERIORES A ${dataLimite})\n\nForam encontrados ${comFotos.length} registos com fotos. Todos os números continuarão intactos. Confirmar?`)) return;

        for (const r of comFotos) {
            let tagEnd = r.endereco ? `[END: ${r.endereco}] ` : '';
            let tagLiberou = r.liberouAcesso ? `[LIBEROU_ACESSO: ${r.liberouAcesso}] ` : '';
            let tagPausa = r.tempoPausadoMinutos > 0 ? `[PAUSA_TOTAL: ${r.tempoPausadoMinutos}] ` : '';
            let obsSemFotos = `${tagEnd}${tagLiberou}${tagPausa}${r.observacoes || ''}`.trim();
            await supabaseClient.from('registros_producao').update({ observacoes: obsSemFotos }).eq('id', r.id);
            if (typeof cacheFotosSobDemanda !== 'undefined') cacheFotosSobDemanda.set(r.id, []);
            r.qtdFotos = 0;
        }
        if (typeof reciclarContagemBytesFotos === 'function') reciclarContagemBytesFotos();
        registrarLogAuditoria("LIMPEZA DE FOTOS ANTIGAS", `Removidas fotos de ${comFotos.length} registos anteriores a ${dataLimite}.`);
        atualizarDashboardGestor();
        alert(`✅ Limpeza concluída! As fotos de ${comFotos.length} registos antigos foram removidas.`);
    } else if (tipoExpurgo === 'registros_completos') {
        if (!confirm(`🗑️ EXCLUIR REGISTOS ANTIGOS DA NUVEM (ANTERIORES A ${dataLimite})\n\nSerão removidos definitivamente ${alvos.length} registos. Confirmar?`)) return;
        const idsParaExcluir = alvos.map(r => r.id);
        const setExcluir = new Set(idsParaExcluir);
        for (let i = 0; i < idsParaExcluir.length; i += 100) {
            await supabaseClient.from('registros_producao').delete().in('id', idsParaExcluir.slice(i, i + 100));
        }
        if (typeof cacheFotosSobDemanda !== 'undefined') idsParaExcluir.forEach(id => cacheFotosSobDemanda.delete(id));
        if (typeof reciclarContagemBytesFotos === 'function') reciclarContagemBytesFotos();
        registrosSalvos = registrosSalvos.filter(r => !setExcluir.has(r.id));
        registrarLogAuditoria("EXPURGO DE REGISTOS ANTIGOS", `Excluídos da nuvem ${idsParaExcluir.length} registos anteriores a ${dataLimite}.`);
        atualizarDashboardGestor();
        alert(`✅ ${idsParaExcluir.length} registos antigos foram removidos da nuvem com sucesso!`);
    }
}

function gerarRelatorioVisualImpressaoPDF() {
    mudarSubAbaGestor('graficos');
    setTimeout(() => { window.print(); }, 300);
}

// ================= MAPA DE RASTREAMENTO EM TEMPO REAL (LEAFLET) =================
function inicializarOuAtualizarMapaRastreio(listaPinos) {
    const containerMapa = document.getElementById('mapa-rastreio-equipes');
    if (!containerMapa || typeof L === 'undefined') return;

    if (!mapaRastreioInstancia) {
        mapaRastreioInstancia = L.map('mapa-rastreio-equipes').setView([-22.9068, -43.1729], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap • GPD PROCISA RJ' }).addTo(mapaRastreioInstancia);
        camadaMarcadoresRastreio = L.layerGroup().addTo(mapaRastreioInstancia);
    }

    setTimeout(() => { if (mapaRastreioInstancia) mapaRastreioInstancia.invalidateSize(); }, 180);
    camadaMarcadoresRastreio.clearLayers();
    coordenadasPinosAtuais = [];

    const containerAtalhos = document.getElementById('lista-atalhos-tecnicos-mapa');
    if (containerAtalhos) containerAtalhos.innerHTML = "";

    listaPinos.forEach(p => {
        if (p.lat === null || p.lng === null || isNaN(p.lat) || isNaN(p.lng)) return;
        coordenadasPinosAtuais.push([p.lat, p.lng]);
        const primeiroNome = p.nome.split(' ')[0];
        const iconeHtml = L.divIcon({
            className: 'custom-pin-gpd',
            html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);"><div style="background:${p.corHex};color:#fff;font-weight:900;font-size:10px;padding:2px 7px;border-radius:8px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);white-space:nowrap;display:flex;align-items:center;gap:4px;"><span>${p.iconeEmoji}</span><span>${primeiroNome}</span></div><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${p.corHex};margin-top:-1px;"></div></div>`,
            iconSize: [0, 0], iconAnchor: [0, 0]
        });

        const marker = L.marker([p.lat, p.lng], { icon: iconeHtml });
        marker.bindPopup(`<div style="font-family:sans-serif;font-size:11px;line-height:1.4;min-width:190px;"><div style="font-weight:900;color:#0f172a;font-size:12px;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin-bottom:4px;">👷 ${p.nome}</div><div><b>Status:</b> <span style="color:${p.corHex};font-weight:800;">${p.statusTexto}</span></div><div><b>Expediente:</b> ${p.turnoTexto}</div><div><b>Ocupação:</b> ${p.ocupacaoLimpa}</div><div><b>Último Sinal:</b> ${p.sinalTexto}</div><div style="margin-top:5px;padding-top:4px;border-top:1px solid #f1f5f9;"><a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}" target="_blank" style="color:#2563eb;font-weight:bold;text-decoration:underline;">🗺️ Abrir no Google Maps (${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})</a></div></div>`);
        marker.addTo(camadaMarcadoresRastreio);

        if (containerAtalhos) {
            const btnAtalho = document.createElement('button');
            btnAtalho.type = "button";
            btnAtalho.className = "px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow-sm transition hover:opacity-90 flex items-center gap-1";
            btnAtalho.style.backgroundColor = p.corHex;
            btnAtalho.innerHTML = `<span>${p.iconeEmoji}</span> <span>${p.nome}</span>`;
            btnAtalho.onclick = () => focarTecnicoNoMapa(p.lat, p.lng, p.nome);
            containerAtalhos.appendChild(btnAtalho);
        }
    });

    if (containerAtalhos && coordenadasPinosAtuais.length === 0) {
        containerAtalhos.innerHTML = `<span class="text-[11px] text-slate-400 italic">Nenhum técnico transmitiu coordenada GPS hoje até o momento.</span>`;
    }
    const lblCont = document.getElementById('lbl-contador-pinos-mapa');
    if (lblCont) lblCont.innerText = `${coordenadasPinosAtuais.length} técnico(s) no mapa`;
    const badgeAbaMapa = document.getElementById('badge-aba-mapa');
    if (badgeAbaMapa) badgeAbaMapa.innerText = `${coordenadasPinosAtuais.length} no mapa`;
}

function centralizarMapaEquipes() {
    if (!mapaRastreioInstancia) return;
    mapaRastreioInstancia.invalidateSize();
    if (coordenadasPinosAtuais.length === 0) {
        mapaRastreioInstancia.setView([-22.9068, -43.1729], 11);
        alert("ℹ️ Ainda não há coordenadas de GPS ativas hoje para centralizar.");
        return;
    }
    if (coordenadasPinosAtuais.length === 1) mapaRastreioInstancia.setView(coordenadasPinosAtuais[0], 16);
    else mapaRastreioInstancia.fitBounds(L.latLngBounds(coordenadasPinosAtuais), { padding: [45, 45], maxZoom: 16 });
}

function focarTecnicoNoMapa(lat, lng, nome) {
    if (isNaN(lat) || isNaN(lng)) return;
    const subMapa = document.getElementById('subview-mapa');
    if (subMapa && subMapa.classList.contains('hidden')) mudarSubAbaGestor('mapa');
    document.getElementById('mapa-rastreio-equipes')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
        if (!mapaRastreioInstancia) renderizarPainelDisponibilidade();
        if (mapaRastreioInstancia) { mapaRastreioInstancia.invalidateSize(); mapaRastreioInstancia.setView([lat, lng], 16); }
    }, 280);
}

function converterHorarioParaMinutos(strHora) {
    if (!strHora || typeof strHora !== 'string' || !strHora.includes(':')) return null;
    const partes = strHora.trim().split(':');
    const h = parseInt(partes[0], 10), m = parseInt(partes[1], 10);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return (h * 60) + m;
}

function formatarMinutosParaHHMM(totalMinutos) {
    if (totalMinutos === null || isNaN(totalMinutos) || totalMinutos < 0) return "--:--";
    const h = Math.floor(totalMinutos / 60), m = Math.round(totalMinutos % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatarDuracaoTexto(totalMinutos) {
    if (totalMinutos === null || isNaN(totalMinutos) || totalMinutos <= 0) return "--h --m";
    const h = Math.floor(totalMinutos / 60), m = Math.round(totalMinutos % 60);
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`;
}

function stringParaHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return hash;
}

function alternarVisualizacaoBlocosAgrupados(idElemento, btnEl) {
    const el = document.getElementById(idElemento);
    if (!el) return;
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        btnEl.innerText = "📂 Ocultar Blocos";
        btnEl.className = "mt-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1 transition";
    } else {
        el.classList.add('hidden');
        const qtd = el.dataset.qtdBlocos || el.querySelectorAll('.card-bloco-interno').length;
        btnEl.innerText = `📂 Expandir Blocos (${qtd})`;
        btnEl.className = "mt-1.5 bg-blue-900 hover:bg-blue-950 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1 transition";
    }
}

function expandirGraficoModal(idCanvasOrigem, tituloJanela) {
    const modal = document.getElementById('modal-expandir-grafico');
    const titulo = document.getElementById('modal-grafico-expandido-titulo');
    const canvasOrigem = document.getElementById(idCanvasOrigem);
    const canvasAlvo = document.getElementById('canvasGraficoExpandido');
    if (!modal || !canvasOrigem || !canvasAlvo) return;
    if (titulo) titulo.innerText = tituloJanela;
    modal.classList.remove('hidden');

    const chartOriginal = Chart.getChart(canvasOrigem);
    if (!chartOriginal) return;
    if (graficoExpandidoInstancia) graficoExpandidoInstancia.destroy();

    graficoExpandidoInstancia = new Chart(canvasAlvo, {
        type: chartOriginal.config.type,
        data: JSON.parse(JSON.stringify(chartOriginal.data)),
        options: {
            ...chartOriginal.config.options, responsive: true, maintainAspectRatio: false,
            plugins: { ...chartOriginal.config.options.plugins, legend: { display: true, position: 'top' } },
            onClick: (event, elements) => { if (elements.length > 0 && chartOriginal.config.options.onClick) chartOriginal.config.options.onClick(event, elements); }
        }
    });
}

function fecharModalGraficoExpandido() {
    document.getElementById('modal-expandir-grafico')?.classList.add('hidden');
    if (graficoExpandidoInstancia) { graficoExpandidoInstancia.destroy(); graficoExpandidoInstancia = null; }
}

function expandirTabelaModal(idTbodyOrigem, tituloJanela) {
    const modal = document.getElementById('modal-expandir-tabela');
    const titulo = document.getElementById('modal-tabela-expandida-titulo');
    const container = document.getElementById('container-tabela-expandida');
    const tbodyOrigem = document.getElementById(idTbodyOrigem);
    if (!modal || !container || !tbodyOrigem) return;
    const tabelaOriginal = tbodyOrigem.closest('table');
    if (!tabelaOriginal) return;

    if (titulo) titulo.innerText = tituloJanela;
    container.innerHTML = "";
    const tabelaClone = tabelaOriginal.cloneNode(true);
    tabelaClone.className = "w-full text-left border-collapse text-xs sm:text-sm";
    tabelaClone.querySelector('thead')?.classList.add('sticky', 'top-0', 'z-10', 'shadow-sm');

    const linhasOriginais = tbodyOrigem.querySelectorAll('tr');
    const tbodyClone = tabelaClone.querySelector('tbody');
    if (tbodyClone) {
        tbodyClone.removeAttribute('id');
        tbodyClone.querySelectorAll('tr').forEach((trClone, idx) => {
            const trOrig = linhasOriginais[idx];
            if (trOrig && typeof trOrig.onclick === 'function') {
                trClone.onclick = (ev) => { fecharModalTabelaExpandida(); trOrig.onclick(ev); };
            }
        });
    }
    container.appendChild(tabelaClone);
    modal.classList.remove('hidden');
}

function fecharModalTabelaExpandida() { document.getElementById('modal-expandir-tabela')?.classList.add('hidden'); }

async function autorizarReaberturaCampo(id) {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') { alert("⚠️ Apenas Gestores podem autorizar a reabertura."); return; }
    const reg = registrosSalvos.find(r => r.id === id);
    if (!reg) return;
    const motivoReabertura = prompt(`🔓 AUTORIZAR REABERTURA PARA O TÉCNICO:\n\nImóvel: ${reg.imovel}\nTécnico: ${reg.equipe}\nStatus Atual: ${reg.desfecho}\n\nInforme brevemente o motivo:`, "Correção de dados / inclusão de fotos");
    if (motivoReabertura === null) return;

    const { error } = await supabaseClient.from('registros_producao').update({ desfecho: "REABERTA" }).eq('id', id);
    if (error) { alert("❌ Erro ao reabrir atividade: " + error.message); return; }

    const statusAntigo = reg.desfecho;
    reg.desfecho = "REABERTA";
    atualizarDashboardGestor();
    registrarLogAuditoria("REABERTURA AUTORIZADA", `Gestor ${usuarioLogado} autorizou a reabertura do imóvel ${reg.imovel} (ID: ${id}) para ${reg.equipe}. Status anterior: ${statusAntigo}`);
    alert(`✅ Atividade do imóvel "${reg.imovel}" foi REABERTA instantaneamente!`);
}

// ================= MOVIMENTAÇÃO / TRANSFERÊNCIA INSTANTÂNEA DE ATIVIDADE =================
function abrirModalTransferirAtividade(id) {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') { alert("⚠️ Permissão insuficiente."); return; }
    const reg = registrosSalvos.find(r => r.id === id);
    if (!reg) return;
    if (['CONCLUIDA', 'PENDENTE', 'MALOGRADA'].includes(reg.desfecho)) { alert("⚠️ Não é permitido transferir atividades já finalizadas."); return; }

    document.getElementById('transf-reg-id').value = reg.id;
    document.getElementById('transf-lbl-imovel').innerText = reg.imovel;
    document.getElementById('transf-lbl-projeto').innerText = reg.projeto;
    document.getElementById('transf-lbl-status').innerText = reg.desfecho;
    document.getElementById('transf-lbl-atual').innerText = reg.equipe;
    document.getElementById('inp-motivo-transf').value = "";

    const selDestino = document.getElementById('sel-tecnico-destino-transf');
    if (selDestino) {
        const equipesAtivas = equipesSistema.filter(e => e.status === 'Ativo' && e.nome !== reg.equipe);
        selDestino.innerHTML = `<option value="">Selecione o técnico de destino...</option>` + equipesAtivas.map(eq => `<option value="${eq.nome}">${eq.nome} (${formatarSetoresString(eq.setor)})</option>`).join('');
    }
    document.getElementById('modal-transferir-atividade').classList.remove('hidden');
}

function fecharModalTransferirAtividade() { document.getElementById('modal-transferir-atividade')?.classList.add('hidden'); }

async function confirmarTransferenciaAtividade() {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') return;
    const id = Number(document.getElementById('transf-reg-id').value);
    const novoTecnico = document.getElementById('sel-tecnico-destino-transf').value;
    const motivo = document.getElementById('inp-motivo-transf').value.trim();
    if (!novoTecnico) { alert("⚠️ Selecione o técnico de destino."); return; }

    const reg = registrosSalvos.find(r => r.id === id);
    if (!reg) return;
    const tecnicoAnterior = reg.equipe;
    const infoMotivo = motivo ? ` (Motivo: ${motivo})` : '';
    const novoMotivoDesfecho = `${reg.motivoDesfecho ? reg.motivoDesfecho + ' | ' : ''}🔀 Transferida de ${tecnicoAnterior} para ${novoTecnico}${infoMotivo}`;

    const { error } = await supabaseClient.from('registros_producao').update({ equipe: novoTecnico, membros: novoTecnico, motivo_desfecho: novoMotivoDesfecho }).eq('id', id);
    if (error) { alert("❌ Erro ao transferir atividade: " + error.message); return; }

    reg.equipe = novoTecnico;
    reg.membros = novoTecnico;
    reg.motivoDesfecho = novoMotivoDesfecho;
    fecharModalTransferirAtividade();
    atualizarDashboardGestor();
    registrarLogAuditoria("TRANSFERÊNCIA DE ATIVIDADE", `Imóvel ${reg.imovel} movimentado de '${tecnicoAnterior}' para '${novoTecnico}'.${infoMotivo}`);
    alert(`✅ Atividade do imóvel "${reg.imovel}" transferida com sucesso para ${novoTecnico}!`);
}

function abrirModalImportarPlanilha() {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') { alert("⚠️ Permissão insuficiente."); return; }
    document.getElementById('inp-arquivo-planilha').value = "";
    document.getElementById('txt-linhas-planilha').value = "";
    document.getElementById('modal-importar-planilha').classList.remove('hidden');
}

function fecharModalImportarPlanilha() { document.getElementById('modal-importar-planilha').classList.add('hidden'); }

function baixarModeloPlanilhaCSV() {
    const cabecalho = "IMOVEL;ENDERECO;PROJETO;TECNICO;QTD_BLOCOS;ANDARES;HPS;RESPONSAVEL;CONTATO;EMAIL;OBSERVACOES\n";
    const ex1 = "848465405;Rua Conde de Bonfim 450 - TIJUCA;VISTORIA;ANDREO FAGUNDES;2;10;40;Sr. Carlos (Síndico);21 99888-7766;sindico@bonfim450.com.br;Condomínio com 2 blocos\n";
    const ex2 = "848473602;Av Nossa Senhora de Copacabana 800 - COPACABANA;CONSTRUÇÃO F;BRUNO SOARES DA SILVA;1;12;60;Dona Maria;21 98777-6655;portaria@copa800.com.br;Procurar zeladora até as 16h\n";
    const blob = new Blob(['\ufeff' + cabecalho + ex1 + ex2], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `planilha_carga_gpd_procisa_${obterDataLocalISO()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function lerArquivoPlanilhaUpload(inputEl) {
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { document.getElementById('txt-linhas-planilha').value = e.target.result || ""; };
    reader.readAsText(file, 'UTF-8');
}

async function processarImportacaoPlanilha() {
    const textoBruto = document.getElementById('txt-linhas-planilha').value.trim();
    if (!textoBruto) { alert("⚠️ Selecione um arquivo .CSV ou cole as linhas da planilha."); return; }

    const linhas = textoBruto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const hojeISO = obterDataLocalISO();
    const novosRegistros = [];

    linhas.forEach((linha, idx) => {
        if (idx === 0 && (linha.toUpperCase().startsWith("IMOVEL") || linha.toUpperCase().startsWith("IMÓVEL") || linha.toUpperCase().includes("ENDERECO;PROJETO"))) return;
        let delimitador = linha.includes('\t') ? '\t' : (!linha.includes(';') && linha.includes(',') ? ',' : ';');
        const partes = linha.split(delimitador).map(p => p.trim());
        if (partes.length < 4) return;

        const imovel = partes[0], endereco = partes[1] || "Endereço a confirmar";
        const projeto = normalizarNomeProjeto(partes[2] || (TODOS_OS_PROJETOS[0] || "CONSTRUÇÃO ON GOING"));
        const tecnico = (partes[3] || "").toUpperCase().trim();
        const qtdBlocos = Math.max(1, Math.min(20, Number(partes[4]) || 1));
        if (!imovel || !tecnico) return;

        novosRegistros.push({
            id: Date.now() + idx + Math.floor(Math.random() * 1000), data_registro: hojeISO, equipe: tecnico, membros: tecnico,
            projeto: TODOS_OS_PROJETOS.includes(projeto) ? projeto : (TODOS_OS_PROJETOS[0] || "CONSTRUÇÃO ON GOING"),
            imovel: imovel, h_entrada: "Programada", h_saida: "Aguardando", gps_entrada: "Carga Gestor", gps_saida: "-",
            desfecho: "PROGRAMADA", motivo_desfecho: `Carga Programada (${qtdBlocos} Bloco${qtdBlocos > 1 ? 's' : ''}) por ${usuarioLogado || 'Gestor'}`,
            malogros: [], responsavel: partes[7] || "", contato: partes[8] || "", email: partes[9] || "", agendamento: null,
            andares: Number(partes[5]) || 0, hps: Number(partes[6]) || 0, servico_obra: "SIM",
            observacoes: `[END: ${endereco}] [BLOCOS: ${qtdBlocos}] ${partes[10] || "Atividade programada pela gestão."}`.trim()
        });
    });

    if (novosRegistros.length === 0) { alert("⚠️ Nenhuma linha válida encontrada."); return; }
    const btn = document.getElementById('btn-confirmar-importacao');
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Enviando carga..."; }

    const { error } = await supabaseClient.from('registros_producao').insert(novosRegistros);
    if (btn) { btn.disabled = false; btn.innerText = "🚀 Enviar Atividades para os Técnicos"; }
    if (error) { alert("❌ Erro ao importar planilha: " + error.message); return; }

    if (typeof converterLinhaBancoParaObjetoGpd === "function") {
        registrosSalvos = [...novosRegistros.map(converterLinhaBancoParaObjetoGpd), ...registrosSalvos];
    }
    registrarLogAuditoria("IMPORTAÇÃO DE PLANILHA", `Importadas ${novosRegistros.length} atividade(s) programada(s).`);
    fecharModalImportarPlanilha();
    atualizarDashboardGestor();
    alert(`✅ Sucesso! ${novosRegistros.length} atividade(s) foram enviadas instantaneamente!`);
}

// ================= PAINEL DE DISPONIBILIDADE + ABA DO MAPA =================
function renderizarPainelDisponibilidade() {
    try {
        const tbody = document.getElementById('tabela-disponibilidade-corpo');
        if (!tbody) return;
        tbody.innerHTML = "";

        const hojeISO = obterDataLocalISO();
        const equipesAtivas = equipesSistema.filter(e => e.status === 'Ativo');
        let countDisp = 0, countAtend = 0, countIndisp = 0, countOffline = 0;
        const listaPinosParaMapa = [];

        equipesAtivas.forEach(eq => {
            const regsHoje = registrosSalvos.filter(r =>
                r.equipe === eq.nome && r.dataRegistro === hojeISO &&
                r.projeto !== PROJETO_SOLIC_COMBUSTIVEL && r.projeto !== PROJETO_SOLIC_MATERIAL
            );
            const impAberto = regsHoje.find(r => r.desfecho === 'IMPREVISTO');
            const obraParalisada = regsHoje.find(r => r.desfecho === 'PARALISADA');
            const obraAndamento = regsHoje.find(r => r.desfecho === 'EM ANDAMENTO' || r.desfecho === 'REABERTA');
            const programadasHoje = registrosSalvos.filter(r => r.equipe === eq.nome && r.desfecho === 'PROGRAMADA').length;
            const concluidasHoje = regsHoje.filter(r => r.desfecho === 'CONCLUIDA').length;

            const tel = (telemetriaEquipes && telemetriaEquipes[eq.nome] && telemetriaEquipes[eq.nome].data === hojeISO) ? telemetriaEquipes[eq.nome] : null;
            const turnoIniciado = tel && tel.statusTurno === 'DISPONIVEL';
            const turnoEncerrado = tel && tel.statusTurno === 'ENCERRADO';

            let turnoHtml = `<span class="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-semibold">⚪ Não iniciado hoje</span>`;
            let turnoTextoPuro = "Não iniciado hoje";
            if (turnoIniciado) {
                turnoHtml = `<span class="bg-emerald-50 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">🟢 Ativo desde ${tel.horaInicio || '--:--'}</span>`;
                turnoTextoPuro = `Ativo desde ${tel.horaInicio || '--:--'}`;
            } else if (turnoEncerrado) {
                turnoHtml = `<span class="bg-slate-200 text-slate-800 border border-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">🔴 Encerrado (${tel.horaInicio || '--:--'} às ${tel.horaFim || '--:--'})</span>`;
                turnoTextoPuro = `Encerrado (${tel.horaInicio || '--:--'} às ${tel.horaFim || '--:--'})`;
            }

            let latFinal = (tel && tel.lat) ? Number(tel.lat) : null;
            let lngFinal = (tel && tel.lng) ? Number(tel.lng) : null;
            let horaSinal = (tel && tel.horaUltimoSinal) ? tel.horaUltimoSinal : null;
            let tsSinal = (tel && tel.timestampUltimoSinal) ? Number(tel.timestampUltimoSinal) : null;

            const ultimoRegHojeComGps = regsHoje.find(r => r.gpsEntrada && r.gpsEntrada.includes(','));
            if ((latFinal === null || isNaN(latFinal)) && ultimoRegHojeComGps) {
                const partes = ultimoRegHojeComGps.gpsEntrada.split(',').map(s => parseFloat(s.trim()));
                if (partes.length === 2 && !isNaN(partes[0])) { latFinal = partes[0]; lngFinal = partes[1]; horaSinal = ultimoRegHojeComGps.hEntrada; }
            }

            let statusBadge = "", detalheTexto = "", ocupacaoLimpa = "", acaoHtml = "-";
            let corPinoHex = "#64748b", iconeEmojiPino = "⚪", statusTextoPuro = "OFFLINE";

            if (impAberto) {
                countIndisp++; corPinoHex = "#dc2626"; iconeEmojiPino = "🔴"; statusTextoPuro = "INDISPONÍVEL (IMPREVISTO)";
                statusBadge = `<span class="bg-red-100 text-red-800 border border-red-300 font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🔴 INDISPONÍVEL (IMPREVISTO)</span>`;
                const mot = (impAberto.malogros && impAberto.malogros.length > 0) ? impAberto.malogros.join(' + ') : impAberto.motivoDesfecho;
                detalheTexto = `<span class="font-bold text-red-900">${mot}</span> <span class="text-slate-500">(Desde ${impAberto.hEntrada})</span>`;
                ocupacaoLimpa = `Imprevisto: ${mot}`;
                if (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador') {
                    acaoHtml = `<button onclick="resolverImprevistoPorId(${impAberto.id}, true)" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded shadow-sm">✅ Liberar</button>`;
                }
            } else if (obraParalisada) {
                countAtend++; corPinoHex = "#ea580c"; iconeEmojiPino = "⏸️"; statusTextoPuro = "ATIVIDADE PARALISADA";
                statusBadge = `<span class="bg-orange-500 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block animate-pulse">⏸️ ATIVIDADE PARALISADA</span>`;
                detalheTexto = `Imóvel: <b>${obraParalisada.imovel}</b> (${obraParalisada.projeto}) • <span class="text-orange-800 font-semibold">${obraParalisada.motivoDesfecho || 'Em pausa'}</span>`;
                ocupacaoLimpa = `Pausa no imóvel ${obraParalisada.imovel}`;
                acaoHtml = `<button onclick="abrirDetalhesAtividade(registrosSalvos.find(r => r.id === ${obraParalisada.id}))" class="bg-orange-50 text-orange-800 font-bold text-[10px] px-2.5 py-1 rounded border border-orange-200">👁️ Ver Obra</button>`;
            } else if (obraAndamento) {
                countAtend++; corPinoHex = "#2563eb"; iconeEmojiPino = "🔵"; statusTextoPuro = "EM ATENDIMENTO";
                statusBadge = `<span class="bg-blue-600 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block animate-pulse">🔵 EM ATENDIMENTO</span>`;
                detalheTexto = `Imóvel: <b>${obraAndamento.imovel}</b> (${obraAndamento.projeto}) • Início às <b>${obraAndamento.hEntrada}</b>`;
                ocupacaoLimpa = `Atendendo ${obraAndamento.imovel} (${obraAndamento.projeto})`;
                acaoHtml = `<button onclick="abrirDetalhesAtividade(registrosSalvos.find(r => r.id === ${obraAndamento.id}))" class="bg-blue-50 text-blue-800 font-bold text-[10px] px-2.5 py-1 rounded border border-blue-200">👁️ Ver Obra</button>`;
            } else if (turnoEncerrado) {
                countOffline++; corPinoHex = "#475569"; iconeEmojiPino = "🏁"; statusTextoPuro = "EXPEDIENTE ENCERRADO";
                statusBadge = `<span class="bg-slate-200 text-slate-700 border border-slate-300 font-bold px-2.5 py-1 rounded-md text-[10px] inline-block">🏁 EXPEDIENTE ENCERRADO</span>`;
                detalheTexto = `<span class="text-slate-500">Turno finalizado às ${tel.horaFim || '--:--'} (${concluidasHoje} concluída(s) hoje)</span>`;
                ocupacaoLimpa = `Turno encerrado (${concluidasHoje} concluída(s) hoje)`;
            } else if (turnoIniciado || regsHoje.length > 0) {
                countDisp++; corPinoHex = "#059669"; iconeEmojiPino = "🟢"; statusTextoPuro = "EM ROTA / DISPONÍVEL";
                statusBadge = `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🟢 EM ROTA / DISPONÍVEL</span>`;
                const txtProg = programadasHoje > 0 ? ` • <b class="text-cyan-800">${programadasHoje} programada(s) na fila</b>` : '';
                detalheTexto = `<span class="text-emerald-900 font-medium">Em deslocamento / Livre (${concluidasHoje} concluída(s) hoje${txtProg})</span>`;
                ocupacaoLimpa = `Disponível em rota (${concluidasHoje} concluída(s) hoje)`;
            } else {
                countOffline++; corPinoHex = "#94a3b8"; iconeEmojiPino = "⚪"; statusTextoPuro = "AGUARDANDO INÍCIO";
                statusBadge = `<span class="bg-slate-100 text-slate-500 border border-slate-200 font-bold px-2.5 py-1 rounded-md text-[10px] inline-block">⚪ AGUARDANDO INÍCIO</span>`;
                const txtProg = programadasHoje > 0 ? `<b class="text-cyan-800">${programadasHoje} programada(s) na fila</b>` : 'Sem check-in hoje';
                detalheTexto = `<span class="text-slate-400">Ainda não clicou em Iniciar Expediente (${txtProg})</span>`;
                ocupacaoLimpa = "Aguardando início do expediente";
            }

            let gpsStr = `<span class="text-slate-400 text-[10px]">Sem sinal hoje</span>`;
            let sinalTextoPuro = "Sem sinal hoje";

            if (latFinal !== null && lngFinal !== null && !isNaN(latFinal) && !isNaN(lngFinal)) {
                let badgeIdadeSinal = "";
                if (tsSinal) {
                    const diffMin = Math.max(0, Math.round((Date.now() - tsSinal) / 60000));
                    if (diffMin <= 3) {
                        badgeIdadeSinal = `<span class="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[9px]">📡 Há ${diffMin <= 1 ? '1 min' : diffMin + ' min'} (Ao vivo)</span>`;
                        sinalTextoPuro = `${horaSinal || ''} (Há ${diffMin} min - Ao vivo)`;
                    } else {
                        badgeIdadeSinal = `<span class="bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded text-[9px]">⏸️ Há ${diffMin} min (2º plano)</span>`;
                        sinalTextoPuro = `${horaSinal || ''} (Há ${diffMin} min)`;
                    }
                } else if (horaSinal) {
                    badgeIdadeSinal = `<span class="bg-blue-50 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[9px]">🕒 Às ${horaSinal}</span>`;
                    sinalTextoPuro = `Às ${horaSinal}`;
                }
                const coordFormatada = `${latFinal.toFixed(5)}, ${lngFinal.toFixed(5)}`;
                gpsStr = `<div class="flex flex-col gap-1"><div>${badgeIdadeSinal}</div><a href="https://www.google.com/maps/search/?api=1&query=${latFinal},${lngFinal}" target="_blank" class="text-blue-600 underline font-mono text-[10px]">🗺️ ${coordFormatada}</a></div>`;
                const btnFocarMapa = `<button type="button" onclick="focarTecnicoNoMapa(${latFinal}, ${lngFinal}, '${eq.nome}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-[10px] px-2 py-1 rounded mr-1">🎯 Ver no Mapa</button>`;
                acaoHtml = acaoHtml === "-" ? btnFocarMapa : `${btnFocarMapa} ${acaoHtml}`;

                listaPinosParaMapa.push({ nome: eq.nome, lat: latFinal, lng: lngFinal, corHex: corPinoHex, iconeEmoji: iconeEmojiPino, statusTexto: statusTextoPuro, turnoTexto: turnoTextoPuro, ocupacaoLimpa: ocupacaoLimpa, sinalTexto: sinalTextoPuro });
            }

            tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="p-3 font-bold text-slate-800">${eq.nome}</td><td class="p-3">${obterBadgeSetorHtml(eq.setor)}</td><td class="p-3">${turnoHtml}</td><td class="p-3">${statusBadge}</td><td class="p-3">${detalheTexto}</td><td class="p-3">${gpsStr}</td><td class="p-3 whitespace-nowrap">${acaoHtml}</td></tr>`;
        });

        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
        setTxt('disp-card-disponiveis', countDisp);
        setTxt('disp-card-atendimento', countAtend);
        setTxt('disp-card-indisponiveis', countIndisp);
        setTxt('disp-card-offline', countOffline);
        setTxt('badge-aba-indisp', `${countIndisp} indisp.`);

        inicializarOuAtualizarMapaRastreio(listaPinosParaMapa);
    } catch (e) { console.warn("Aviso ao renderizar disponibilidade:", e); }
}

async function atualizarDashboardGestor() {
    inicializarMelhoriasVisuaisGestor();
    if (!cargaInicialGestorConcluida && (!registrosSalvos || registrosSalvos.length === 0) && !modoConsultaBackupAtivo) {
        await carregarRegistrosDaNuvem(true);
    }
    await verificarEExpurgarSolicitacoesVencidas48h();
    atualizarEstimativaPesoNuvem();

    const dataInicio = document.getElementById('gestor-filtro-data-inicio')?.value || "";
    const dataFim = document.getElementById('gestor-filtro-data-fim')?.value || "";
    const fEquipe = document.getElementById('gestor-filtro-equipe')?.value || "";
    const fProjeto = document.getElementById('gestor-filtro-projeto')?.value || "";
    const fDesfecho = document.getElementById('gestor-filtro-desfecho')?.value || "";
    const termoBusca = document.getElementById('inp-busca-global')?.value.toLowerCase().trim() || "";

    const corpoAtiv = document.getElementById('tabela-gestor-corpo');
    const corpoMat = document.getElementById('tabela-materiais-corpo');
    const corpoImp = document.getElementById('tabela-imprevistos-corpo');
    if (corpoAtiv) corpoAtiv.innerHTML = "";
    if (corpoMat) corpoMat.innerHTML = "";
    if (corpoImp) corpoImp.innerHTML = "";

    let filtradosBase = registrosSalvos.filter(item => {
        let mData = true;
        if (dataInicio && dataFim) mData = item.dataRegistro >= dataInicio && item.dataRegistro <= dataFim;
        else if (dataInicio) mData = item.dataRegistro >= dataInicio;
        else if (dataFim) mData = item.dataRegistro <= dataFim;

        let mEquipe = true;
        if (filtrosMultiplosAtivos.equipes.length > 0) mEquipe = filtrosMultiplosAtivos.equipes.includes(item.equipe);
        else if (fEquipe) mEquipe = item.equipe === fEquipe;

        let mSetor = true;
        if (filtrosMultiplosAtivos.setores.length > 0) {
            const eqObj = equipesSistema.find(e => e.nome === item.equipe);
            const setoresTec = obterArraySetores(eqObj ? eqObj.setor : obterSetorDoProjeto(item.projeto));
            mSetor = filtrosMultiplosAtivos.setores.some(s => setoresTec.includes(s));
        }

        let mBusca = true;
        if (termoBusca) {
            mBusca = (item.imovel && item.imovel.toLowerCase().includes(termoBusca)) ||
                     (item.endereco && item.endereco.toLowerCase().includes(termoBusca)) ||
                     (item.liberouAcesso && item.liberouAcesso.toLowerCase().includes(termoBusca)) ||
                     (item.equipe && item.equipe.toLowerCase().includes(termoBusca)) ||
                     (item.projeto && item.projeto.toLowerCase().includes(termoBusca)) ||
                     (item.motivoDesfecho && item.motivoDesfecho.toLowerCase().includes(termoBusca)) ||
                     (item.desfecho && item.desfecho.toLowerCase().includes(termoBusca));
        }
        return mData && mEquipe && mSetor && mBusca;
    });

    listaSolicitacoesCombustivelAtuais = filtradosBase.filter(i => i.projeto === PROJETO_SOLIC_COMBUSTIVEL);
    listaSolicitacoesMaterialAtuais    = filtradosBase.filter(i => i.projeto === PROJETO_SOLIC_MATERIAL);
    renderizarTabelasSolicitacoesGestor();

    let listaImprevistos = filtradosBase.filter(i => i.projeto === 'IMPREVISTO / ATRASO' || i.desfecho === 'IMPREVISTO' || i.desfecho === 'IMPREVISTO RESOLVIDO');

    let filtrados = filtradosBase.filter(i => {
        if (i.projeto === 'IMPREVISTO / ATRASO' || i.projeto === PROJETO_SOLIC_COMBUSTIVEL || i.projeto === PROJETO_SOLIC_MATERIAL || i.desfecho === 'IMPREVISTO' || i.desfecho === 'IMPREVISTO RESOLVIDO') return false;
        let mMacro = filtrosMultiplosAtivos.macrogrupos.length > 0 ? filtrosMultiplosAtivos.macrogrupos.includes(obterMacroGrupoProjeto(i.projeto)) : true;
        let mProj = filtrosMultiplosAtivos.projetos.length > 0 ? filtrosMultiplosAtivos.projetos.includes(i.projeto) : (fProjeto ? i.projeto === fProjeto : true);
        let mDesf = filtrosMultiplosAtivos.desfechos.length > 0 ? filtrosMultiplosAtivos.desfechos.includes(i.desfecho) : (fDesfecho ? i.desfecho === fDesfecho : true);
        return mMacro && mProj && mDesf;
    });

    filtrados = enriquecerStatusMacroEBairro(filtrados);
    dadosFiltradosAtuais = filtrados;
    listaImprevistosAtuais = listaImprevistos;
    renderizarPainelDisponibilidade();

    const qtdEmAndamento = filtrados.filter(i => ['EM ANDAMENTO', 'PARALISADA', 'REABERTA'].includes(i.desfecho)).length;
    const qtdProgramadas = filtrados.filter(i => i.desfecho === 'PROGRAMADA').length;
    const imprevistosAbertos = listaImprevistos.filter(i => i.desfecho === 'IMPREVISTO').length;

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setTxt('kpi-proj-andamento', qtdEmAndamento);
    setTxt('badge-aba-andamento', `${qtdEmAndamento} ativas`);
    setTxt('kpi-proj-imprevistos', listaImprevistos.length);
    setTxt('badge-aba-imprevistos', listaImprevistos.length);
    setTxt('contador-imprevistos', `${listaImprevistos.length} imprevisto(s) (${imprevistosAbertos} ativo(s))`);

    const alertaImp = document.getElementById('alerta-imprevistos-supervisao');
    if (alertaImp) {
        if (nivelUsuarioLogado === 'Visualizador') alertaImp.classList.add('hidden');
        else if (imprevistosAbertos > 0 && alertaImp.dataset.fechadoPeloGestor !== "true") {
            alertaImp.classList.remove('hidden');
            setTxt('txt-alerta-imprevistos', `Existem ${imprevistosAbertos} técnico(s) com imprevisto ATIVO (indisponíveis) neste momento.`);
        } else if (imprevistosAbertos === 0) alertaImp.classList.add('hidden');
    }

    if (corpoImp) {
        if (listaImprevistos.length === 0) {
            corpoImp.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">Nenhum imprevisto ou atraso reportado no período.</td></tr>`;
        } else {
            listaImprevistos.forEach(imp => {
                const motivoPrincipal = (imp.malogros && imp.malogros.length > 0) ? imp.malogros.join(' + ') : "IMPREVISTO";
                const obsTexto = imp.observacoes || imp.motivoDesfecho || "-";
                const linkGps = (imp.gpsEntrada && imp.gpsEntrada.includes(','))
                    ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(imp.gpsEntrada)}" target="_blank" onclick="event.stopPropagation()" class="text-blue-600 underline font-bold">🗺️ ${imp.gpsEntrada}</a>`
                    : (imp.gpsEntrada || "-");
                const estaAberto = imp.desfecho === 'IMPREVISTO';
                const badgeSituacao = estaAberto
                    ? `<span class="bg-red-100 text-red-800 border border-red-300 font-black px-2 py-0.5 rounded text-[10px]">🔴 EM ABERTO</span>`
                    : `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]">🟢 RESOLVIDO</span>`;

                let acoesImp = `<span class="text-slate-400 text-[10px]">Somente Leitura</span>`;
                if (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador') {
                    acoesImp = `${estaAberto ? `<button onclick="resolverImprevistoPorId(${imp.id}, true)" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded mr-1 shadow-sm">✅ Resolver</button>` : ''}<button onclick="abrirModalEdicao(${imp.id})" class="text-blue-600 font-bold text-[10px] bg-blue-50 border border-blue-200 px-2 py-1 rounded mr-1">✏️ Editar</button><button onclick="excluirRegistro(${imp.id}, 'IMPREVISTO')" class="text-red-500 font-bold text-[10px] bg-red-50 px-2 py-1 rounded">Excluir</button>`;
                }

                const trImp = document.createElement('tr');
                trImp.className = "hover:bg-amber-50/50 border-b cursor-pointer transition";
                trImp.onclick = () => abrirDetalhesAtividade(imp);
                trImp.innerHTML = `<td class="p-3"><div class="font-bold text-slate-800">${imp.dataRegistro}</div><div class="text-[10px] font-mono text-slate-500">Início: ${imp.hEntrada} | Fim: ${imp.hSaida}</div></td><td class="p-3 font-bold text-blue-900">${imp.equipe}</td><td class="p-3"><span class="bg-amber-100 text-amber-900 font-bold px-2.5 py-1 rounded text-[10px]">${motivoPrincipal}</span></td><td class="p-3">${badgeSituacao}</td><td class="p-3 text-slate-600">${obsTexto}</td><td class="p-3 font-mono text-[10px]">${linkGps}</td><td class="p-3 whitespace-nowrap" onclick="event.stopPropagation()">${acoesImp}</td>`;
                corpoImp.appendChild(trImp);
            });
        }
    }

    const finalizadas = filtrados.filter(i => !['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(i.desfecho));
    setTxt('kpi-proj-vistoria', finalizadas.filter(i => i.projeto === 'VISTORIA').length);
    setTxt('kpi-proj-const-f', finalizadas.filter(i => i.projeto === 'CONSTRUÇÃO F').length);
    setTxt('kpi-proj-const-ongoing', finalizadas.filter(i => i.projeto === 'CONSTRUÇÃO ON GOING').length);
    setTxt('kpi-proj-const-nap', finalizadas.filter(i => i.projeto === 'CONSTRUÇÃO NAP LOTADA').length);
    setTxt('kpi-proj-ativ-f', finalizadas.filter(i => i.projeto === 'ATIVAÇÃO F').length);
    setTxt('kpi-proj-ativ-ongoing', finalizadas.filter(i => i.projeto === 'ATIVAÇÃO ON GOING').length);
    setTxt('kpi-proj-ativ-nap', finalizadas.filter(i => i.projeto === 'ATIVAÇÃO NAP LOTADA').length);

    setTxt('contador-resultados', `${filtrados.length} registros (${qtdEmAndamento} ativas/pausa | ${qtdProgramadas} programadas)`);
    setTxt('contador-materiais', finalizadas.length + " registros finalizados");

    let concluidasCount = finalizadas.filter(i => i.desfecho === 'CONCLUIDA').length;
    let malogradasCount = finalizadas.filter(i => i.desfecho === 'MALOGRADA').length;
    let pendentesCount = finalizadas.filter(i => i.desfecho === 'PENDENTE').length;

    setTxt('bonif-elegiveis', concluidasCount);
    setTxt('bonif-parciais', pendentesCount);
    setTxt('bonif-media-geral', finalizadas.length > 0 ? (concluidasCount / (new Set(finalizadas.map(i => i.dataRegistro)).size || 1)).toFixed(1) : "0.0");
    setTxt('bonif-malogros', malogradasCount);

    let sumCaboRL = 0, sumConectores = 0, sumCaboDrop = 0, sumNap = 0, sumDio = 0, sumFusoes = 0;
    let sumSobrepor = 0, sumEmbutida = 0, sumFosc = 0, sumVistorias = 0;

    finalizadas.forEach(i => {
        if (i.projeto === 'VISTORIA' && i.desfecho === 'CONCLUIDA') sumVistorias++;
        sumCaboRL += Number(i.caboRL) || 0;
        sumConectores += Number(i.conectores) || 0;
        sumCaboDrop += Number(i.caboDrop) || 0;
        sumNap += Number(i.nap) || 0;
        sumDio += Number(i.dio) || 0;
        sumFusoes += Number(i.fusoes) || 0;
        sumSobrepor += Number(i.cxSobrepor) || 0;
        sumEmbutida += Number(i.cxEmbutida) || 0;
        sumFosc += Number(i.cxFosc) || 0;
    });

    setTxt('total-cabo-rl', sumCaboRL + " m");
    setTxt('total-conectores', sumConectores);
    setTxt('total-cabo-drop', sumCaboDrop + " m");
    setTxt('total-nap', sumNap);
    setTxt('total-dio', sumDio);
    setTxt('total-fusoes', sumFusoes);
    setTxt('total-cx-sobrepor', sumSobrepor);
    setTxt('total-cx-embutida', sumEmbutida);
    setTxt('total-cx-fosc', sumFosc);

    totaisFinanceirosAtuais = { vistorias: sumVistorias, caboRL: sumCaboRL, conectores: sumConectores, fusoes: sumFusoes, caboDrop: sumCaboDrop, nap: sumNap, dio: sumDio, cxSobrepor: sumSobrepor, cxEmbutida: sumEmbutida, cxFosc: sumFosc };
    renderizarTabelaFinanceiro(totaisFinanceirosAtuais);

    if (filtrados.length === 0) {
        if (corpoAtiv) corpoAtiv.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">Nenhum registro encontrado para este filtro/período.</td></tr>`;
        if (corpoMat) corpoMat.innerHTML = `<tr><td colspan="11" class="p-6 text-center text-slate-400">Nenhum material registrado.</td></tr>`;
    } else {
        const prioridadeStatus = { 'EM ANDAMENTO': 1, 'PARALISADA': 2, 'REABERTA': 3, 'PROGRAMADA': 4 };
        const filtradosOrdenados = [...filtrados].sort((a, b) => {
            const pA = prioridadeStatus[a.desfecho] || 5, pB = prioridadeStatus[b.desfecho] || 5;
            if (pA !== pB) return pA - pB;
            return b.id - a.id;
        });

        const mapaAgrupado = {};
        filtradosOrdenados.forEach(item => {
            let codigoBase = (item.imovel || "").trim();
            const idxTraco = codigoBase.toUpperCase().lastIndexOf(" - BLOCO");
            if (idxTraco !== -1) codigoBase = codigoBase.substring(0, idxTraco).trim();
            const chaveAgrupamento = `${item.dataRegistro}_${item.equipe}_${codigoBase.toUpperCase()}_${item.projeto}`;
            if (!mapaAgrupado[chaveAgrupamento]) {
                mapaAgrupado[chaveAgrupamento] = {
                    codigoBase, projeto: item.projeto, equipe: item.equipe, dataRegistro: item.dataRegistro,
                    endereco: item.endereco, liberouAcesso: item.liberouAcesso, hEntrada: item.hEntrada,
                    hSaida: item.hSaida, gpsEntrada: item.gpsEntrada, gpsSaida: item.gpsSaida, itens: []
                };
            }
            mapaAgrupado[chaveAgrupamento].itens.push(item);
        });

        Object.values(mapaAgrupado).forEach(grupo => {
            if (corpoAtiv) {
                const qtdBlocosNoGrupo = grupo.itens.length;
                const itemMaster = grupo.itens[0];
                const idGrupoUnico = `grupo_bloco_${Math.abs(stringParaHash(grupo.codigoBase + grupo.dataRegistro + grupo.equipe + grupo.projeto))}`;

                let desfechoExibicao = itemMaster.desfecho;
                if (qtdBlocosNoGrupo > 1) {
                    const desfechosUnicos = [...new Set(grupo.itens.map(i => i.desfecho))];
                    desfechoExibicao = desfechosUnicos.length === 1 ? desfechosUnicos[0] : "MÚLTIPLO";
                }

                const somaAndares = grupo.itens.reduce((acc, i) => acc + (Number(i.andares) || 0), 0);
                const somaHps = grupo.itens.reduce((acc, i) => acc + (Number(i.hps) || 0), 0);
                const somaTempoPausado = grupo.itens.reduce((acc, i) => acc + (Number(i.tempoPausadoMinutos) || 0), 0);
                const totalFotosGrupo = grupo.itens.reduce((acc, i) => acc + (Number(i.qtdFotos) || (Array.isArray(i.fotos) ? i.fotos.length : 0)), 0);
                const todasOpcoesGrupo = [...new Set(grupo.itens.flatMap(i => Array.isArray(i.malogros) ? i.malogros : []))];

                const trPrincipal = document.createElement('tr');
                trPrincipal.className = (itemMaster.desfecho === 'EM ANDAMENTO' || itemMaster.desfecho === 'REABERTA')
                    ? "bg-blue-50/70 hover:bg-blue-100/60 border-b cursor-pointer transition"
                    : (itemMaster.desfecho === 'PARALISADA' ? "bg-orange-50/70 hover:bg-orange-100/60 border-b cursor-pointer transition" : (itemMaster.desfecho === 'PROGRAMADA' ? "bg-cyan-50/40 hover:bg-cyan-100/50 border-b cursor-pointer transition" : "hover:bg-blue-50/50 border-b cursor-pointer transition"));
                trPrincipal.onclick = () => abrirDetalhesAtividade(itemMaster);

                let botoesAcao = `<span class="text-slate-400 text-[10px] font-semibold">👁️ Visualização</span>`;
                if (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador') {
                    const podeFinalizadasReabrir = ['CONCLUIDA', 'PENDENTE', 'MALOGRADA'].includes(itemMaster.desfecho);
                    const btnReabrir = podeFinalizadasReabrir ? `<button onclick="autorizarReaberturaCampo(${itemMaster.id})" class="text-purple-800 hover:bg-purple-200 font-bold text-[10px] bg-purple-100 border border-purple-300 px-2 py-1 rounded">🔓 Reabrir</button>` : '';
                    const btnMover = !podeFinalizadasReabrir ? `<button onclick="abrirModalTransferirAtividade(${itemMaster.id})" class="text-indigo-900 hover:bg-indigo-200 font-bold text-[10px] bg-indigo-100 border border-indigo-300 px-2 py-1 rounded">🔀 Mover</button>` : '';
                    botoesAcao = `<div class="flex flex-wrap gap-1">${btnMover}${btnReabrir}<button onclick="abrirModalEdicao(${itemMaster.id})" class="text-blue-600 font-bold text-[10px] bg-blue-50 border border-blue-200 px-2 py-1 rounded">✏️ Editar</button><button onclick="excluirRegistro(${itemMaster.id}, '${itemMaster.imovel}')" class="text-red-500 font-bold text-[10px] bg-red-50 border border-red-200 px-2 py-1 rounded">Excluir</button></div>`;
                }

                const minIn = converterHorarioParaMinutos(grupo.hEntrada);
                const minOut = converterHorarioParaMinutos(grupo.hSaida);
                let duracaoStr = "-";
                if (minIn !== null && minOut !== null && minOut >= minIn) duracaoStr = formatarDuracaoTexto(Math.max(0, (minOut - minIn) - somaTempoPausado));
                else if (itemMaster.desfecho === 'EM ANDAMENTO') duracaoStr = '⏳ Em execução';
                else if (itemMaster.desfecho === 'PARALISADA') duracaoStr = '⏸️ Em pausa';
                else if (itemMaster.desfecho === 'REABERTA') duracaoStr = '🔄 Aguardando edição';
                else if (itemMaster.desfecho === 'PROGRAMADA') duracaoStr = `📋 Na fila (${itemMaster.qtdBlocosProgramados || 1} Bloco${(itemMaster.qtdBlocosProgramados || 1) > 1 ? 's' : ''})`;

                const badgePausaLinha = somaTempoPausado > 0 ? `<div class="text-[10px] text-orange-700 font-bold">⏸️ Pausa: ${somaTempoPausado} min</div>` : '';
                const infoLiberouLinha = grupo.liberouAcesso ? `<div class="text-[10px] text-amber-900 font-semibold truncate max-w-[200px]">🔑 Liberou: ${grupo.liberouAcesso}</div>` : '';
                const classeCorDesfecho = obterClasseCorDesfecho(desfechoExibicao);
                const eqObj = equipesSistema.find(e => e.nome === grupo.equipe);
                const setorStr = eqObj ? eqObj.setor : "Instalador";
                const macroGrupo = obterMacroGrupoProjeto(grupo.projeto);
                const badgeGrupoCor = macroGrupo === 'PROJETO F' ? 'bg-indigo-100 text-indigo-900 border border-indigo-300' : 'bg-cyan-50 text-cyan-900 border border-cyan-200';
                const badgeMacroPlanilha = itemMaster.statusMacroPlanilha === 'RETORNO'
                    ? `<span class="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded text-[9px]">🔄 RETORNO</span>`
                    : `<span class="bg-blue-50 text-blue-800 border border-blue-200 font-bold px-1.5 py-0.5 rounded text-[9px]">📋 PROGRAMADO</span>`;

                const tagsOpcoesHtml = todasOpcoesGrupo.length > 0 ? `<div class="mt-1 flex flex-wrap gap-1">${todasOpcoesGrupo.map(op => `<span class="text-[9px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">${op}</span>`).join('')}</div>` : '';
                const badgeFotosHtml = totalFotosGrupo > 0 ? `<span class="ml-1 bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold px-2 py-0.5 rounded-md text-[10px] inline-block">📷 ${totalFotosGrupo} foto(s)</span>` : '';
                const botaoExpandirBlocos = qtdBlocosNoGrupo > 1 ? `<button type="button" onclick="event.stopPropagation(); alternarVisualizacaoBlocosAgrupados('${idGrupoUnico}', this)" class="mt-1.5 bg-blue-900 hover:bg-blue-950 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1 transition">📂 Expandir Blocos (${qtdBlocosNoGrupo})</button>` : '';

                trPrincipal.innerHTML = `
                    <td class="p-3">
                        <div class="font-black text-slate-800 flex items-center gap-1 flex-wrap">${qtdBlocosNoGrupo > 1 ? `${grupo.codigoBase} <span class="text-blue-700 font-bold text-[11px]">(${qtdBlocosNoGrupo} Blocos)</span>` : itemMaster.imovel} ${badgeMacroPlanilha}</div>
                        <div class="text-[10px] text-blue-900 font-medium truncate max-w-[220px]">📍 ${grupo.endereco || 'Endereço não informado'} <span class="font-bold text-indigo-800">(${itemMaster.bairroPlanilha})</span></div>
                        ${infoLiberouLinha}
                        <div class="text-[10px] text-slate-400">${grupo.dataRegistro} • ${itemMaster.semanaPlanilha}</div>
                        ${botaoExpandirBlocos}
                    </td>
                    <td class="p-3"><div class="font-semibold text-slate-800 mb-0.5">${grupo.equipe}</div>${obterBadgeSetorHtml(setorStr)}</td>
                    <td class="p-3"><div class="flex flex-wrap items-center gap-1"><span class="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded text-[10px] inline-block">${grupo.projeto}</span><span class="font-bold px-1.5 py-0.5 rounded text-[9px] ${badgeGrupoCor}">${macroGrupo}</span></div><div class="text-[10px] text-slate-500 mt-1 font-semibold">🏢 Andares: <b>${somaAndares}</b> | HPs: <b>${somaHps}</b></div></td>
                    <td class="p-3"><div class="flex flex-wrap items-center gap-1"><span class="font-bold px-2.5 py-1 rounded-md text-[10px] inline-block ${classeCorDesfecho}">${desfechoExibicao}</span>${badgeFotosHtml}</div>${tagsOpcoesHtml}</td>
                    <td class="p-3"><div class="text-[11px]">🟢 Início: <b>${grupo.hEntrada}</b></div><div class="text-[11px]">🔴 Fim: <b>${grupo.hSaida}</b></div>${badgePausaLinha}<div class="text-[10px] text-emerald-700 font-bold mt-0.5">⏱️ ${duracaoStr}</div></td>
                    <td class="p-3 text-[10px] font-mono text-slate-600"><div>In: ${grupo.gpsEntrada}</div><div>Out: ${grupo.gpsSaida}</div></td>
                    <td class="p-3" onclick="event.stopPropagation()">${botoesAcao}</td>`;
                corpoAtiv.appendChild(trPrincipal);

                if (qtdBlocosNoGrupo > 1) {
                    const trDetalheBlocos = document.createElement('tr');
                    trDetalheBlocos.id = idGrupoUnico;
                    trDetalheBlocos.dataset.qtdBlocos = qtdBlocosNoGrupo;
                    trDetalheBlocos.className = "hidden bg-slate-100/90 border-b";

                    let cardsBlocosHtml = grupo.itens.map(blocoItem => {
                        const corDesfB = obterClasseCorDesfecho(blocoItem.desfecho);
                        const qtdFotosB = Number(blocoItem.qtdFotos) || (Array.isArray(blocoItem.fotos) ? blocoItem.fotos.length : 0);
                        const acoesIndividuais = (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador') ? `<div class="flex flex-wrap gap-1 pt-2 border-t border-slate-200 mt-1.5" onclick="event.stopPropagation()">${['CONCLUIDA', 'PENDENTE', 'MALOGRADA'].includes(blocoItem.desfecho) ? `<button onclick="autorizarReaberturaCampo(${blocoItem.id})" class="bg-purple-100 text-purple-900 border border-purple-300 font-bold text-[9px] px-2 py-0.5 rounded">🔓 Reabrir</button>` : `<button onclick="abrirModalTransferirAtividade(${blocoItem.id})" class="bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-[9px] px-2 py-0.5 rounded">🔀 Mover</button>`}<button onclick="abrirModalEdicao(${blocoItem.id})" class="bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[9px] px-2 py-0.5 rounded">✏️ Editar</button><button onclick="excluirRegistro(${blocoItem.id}, '${blocoItem.imovel}')" class="bg-red-50 text-red-600 border border-red-200 font-bold text-[9px] px-2 py-0.5 rounded">🗑️ Excluir</button></div>` : '';
                        return `<div class="card-bloco-interno bg-white p-3 rounded-xl border border-blue-200 shadow-sm space-y-1 cursor-pointer hover:border-blue-500 transition" onclick="abrirDetalhesAtividade(registrosSalvos.find(r => r.id === ${blocoItem.id}))"><div class="flex justify-between items-center gap-1"><span class="font-black text-blue-950 text-xs">🏢 ${blocoItem.imovel}</span><span class="px-2 py-0.5 rounded text-[9px] font-bold ${corDesfB}">${blocoItem.desfecho}</span></div><div class="text-[10px] text-slate-600 font-semibold">Andares: <b>${blocoItem.andares || 0}</b> | HPs: <b>${blocoItem.hps || 0}</b> ${qtdFotosB > 0 ? `| 📷 <b>${qtdFotosB} foto(s)</b>` : ''}</div><div class="text-[10px] text-slate-500">📦 RL: <b>${blocoItem.caboRL}m</b> | Drop: <b>${blocoItem.caboDrop}m</b> | Conect: <b>${blocoItem.conectores}</b> | Fusões: <b>${blocoItem.fusoes}</b> | NAP: <b>${blocoItem.nap}</b> | DIO: <b>${blocoItem.dio}</b></div>${blocoItem.motivoDesfecho ? `<div class="text-[10px] text-amber-900 bg-amber-50 px-2 py-1 rounded">💬 ${blocoItem.motivoDesfecho}</div>` : ''}${acoesIndividuais}</div>`;
                    }).join('');

                    trDetalheBlocos.innerHTML = `<td colspan="7" class="p-3 pl-6"><div class="bg-blue-50/60 p-3 rounded-xl border border-blue-200 space-y-2"><div class="flex justify-between items-center border-b border-blue-200 pb-1.5"><span class="font-black text-blue-950 text-xs uppercase">📂 Detalhamento Individual dos ${qtdBlocosNoGrupo} Blocos do Imóvel ${grupo.codigoBase}</span><span class="text-[10px] text-blue-800">Clique em qualquer bloco para abrir detalhes e fotos</span></div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">${cardsBlocosHtml}</div></div></td>`;
                    corpoAtiv.appendChild(trDetalheBlocos);
                }
            }

            grupo.itens.forEach(item => {
                if (!['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(item.desfecho) && corpoMat) {
                    const trMat = document.createElement('tr');
                    trMat.className = "hover:bg-slate-50 border-b transition";
                    trMat.innerHTML = `<td class="p-2.5 font-bold text-slate-800">${item.imovel}<div class="text-[9px] text-slate-400 font-normal">${item.dataRegistro}</div></td><td class="p-2.5">${item.equipe}<div class="text-[9px] text-blue-900">${item.projeto}</div></td><td class="p-2.5 font-semibold">${item.caboRL} m</td><td class="p-2.5 font-semibold">${item.conectores}</td><td class="p-2.5 font-semibold">${item.caboDrop} m</td><td class="p-2.5 font-bold text-blue-900">${item.nap}</td><td class="p-2.5 font-bold text-indigo-700">${item.dio}</td><td class="p-2.5 font-bold text-amber-700">${item.cxSobrepor}</td><td class="p-2.5 font-bold text-orange-700">${item.cxEmbutida}</td><td class="p-2.5 font-bold text-purple-700">${item.cxFosc}</td><td class="p-2.5 font-semibold">${item.fusoes}</td>`;
                    corpoMat.appendChild(trMat);
                }
            });
        });
    }

    try { renderizarPainelPrincipalExecutores(finalizadas); } catch (e) { console.warn("Erro painel executores:", e); }
    try { renderizarPainelMallingEProjetoF(finalizadas); } catch (e) { console.warn("Erro visões planilha:", e); }
    try { renderizarPainelProgramadoRetornoEBairro(filtrados); } catch (e) { console.warn("Erro Programado/Retorno:", e); }
    try { renderizarGraficos(finalizadas, filtrados); } catch (e) { console.warn("Erro graficos:", e); }
    try { renderizarOfensoresMalogro(finalizadas); } catch (e) { console.warn("Erro ofensores:", e); }
    try { renderizarTabelaConsolidada(finalizadas); } catch (e) { console.warn("Erro consolidada:", e); }
    try { renderizarTabelaUsuariosPermissao(); } catch (e) {}
}

// ================= MATRIZ E GRÁFICO PRINCIPAL DA PLANILHA (ABA PAINEL & DIN2) =================
function renderizarPainelPrincipalExecutores(dados) {
    const tbody = document.getElementById('tabela-principal-executores-corpo');
    if (!tbody) return;
    tbody.innerHTML = "";

    const hojeISO = obterDataLocalISO();
    const datasPresentes = [...new Set(dados.map(d => d.dataRegistro).filter(Boolean))].sort();
    const dataRefDiaria = datasPresentes.includes(hojeISO) ? hojeISO : (datasPresentes.length > 0 ? datasPresentes[datasPresentes.length - 1] : hojeISO);
    const lblDataRef = document.getElementById('lbl-data-ref-diaria');
    if (lblDataRef) lblDataRef.innerText = dataRefDiaria === hojeISO ? `Hoje (${hojeISO})` : dataRefDiaria;

    const mapaExec = {};
    equipesSistema.filter(e => e.status === 'Ativo').forEach(eq => {
        mapaExec[eq.nome] = { nome: eq.nome, setor: eq.setor, prodDiaria: 0, executados: 0, naoExecutados: 0, totalGeral: 0, somaHps: 0, duracoes: [], diasAtivosSet: new Set() };
    });

    dados.forEach(d => {
        const nome = d.equipe || "NÃO IDENTIFICADO";
        if (!mapaExec[nome]) {
            const eqCadastrada = equipesSistema.find(e => e.nome === nome);
            mapaExec[nome] = { nome, setor: eqCadastrada ? eqCadastrada.setor : "Instalador", prodDiaria: 0, executados: 0, naoExecutados: 0, totalGeral: 0, somaHps: 0, duracoes: [], diasAtivosSet: new Set() };
        }
        const ex = mapaExec[nome];
        ex.totalGeral++;
        if (d.dataRegistro) ex.diasAtivosSet.add(d.dataRegistro);
        if (d.desfecho === 'CONCLUIDA') {
            ex.executados++;
            ex.somaHps += Number(d.hps) || 0;
            if (d.dataRegistro === dataRefDiaria) ex.prodDiaria++;
        } else {
            ex.naoExecutados++;
        }
        const pausaMin = Number(d.tempoPausadoMinutos) || 0;
        const minIn = converterHorarioParaMinutos(d.hEntrada);
        const minOut = converterHorarioParaMinutos(d.hSaida);
        if (minIn !== null && minOut !== null && minOut >= minIn) {
            const durLiquida = Math.max(0, (minOut - minIn) - pausaMin);
            if (durLiquida > 0 && durLiquida <= 840) ex.duracoes.push(durLiquida);
        }
    });

    const listaTodos = Object.values(mapaExec).map(ex => {
        const dias = ex.diasAtivosSet.size;
        const produtividade = dias > 0 ? (ex.executados / dias) : 0;
        const hpPorDia = dias > 0 ? (ex.somaHps / dias) : 0;
        const conversao = ex.totalGeral > 0 ? ((ex.executados / ex.totalGeral) * 100) : 0;
        const tma = ex.duracoes.length > 0 ? formatarDuracaoTexto(ex.duracoes.reduce((a, b) => a + b, 0) / ex.duracoes.length) : "--h --m";
        return { ...ex, diasTrab: dias, produtividade, hpPorDia, conversao, tma };
    });

    const atualizarCardGrupo = (setorAlvo, prefixoId) => {
        const doSetor = listaTodos.filter(i => tecnicoPertenceAoSetor(i.setor, setorAlvo));
        const comProducao = doSetor.filter(i => i.totalGeral > 0);
        const somaDiaria = doSetor.reduce((acc, i) => acc + i.prodDiaria, 0);
        const somaExec = doSetor.reduce((acc, i) => acc + i.executados, 0);
        const mediaGrupo = comProducao.length > 0 ? (comProducao.reduce((acc, i) => acc + i.produtividade, 0) / comProducao.length) : 0;
        const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
        setEl(`card-${prefixoId}-qtd-tec`, `${doSetor.length} eq. (${comProducao.length} c/ prod.)`);
        setEl(`card-${prefixoId}-diaria`, somaDiaria);
        setEl(`card-${prefixoId}-consolidado`, somaExec);
        setEl(`card-${prefixoId}-media`, mediaGrupo.toFixed(2));
    };

    atualizarCardGrupo('Vistoriador', 'vist');
    atualizarCardGrupo('Instalador', 'inst');
    atualizarCardGrupo('Ativador', 'ativ');

    const filtroSetor = document.getElementById('filtro-setor-grafico-principal')?.value || 'TODOS';
    let listaExibicao = listaTodos.filter(ex => tecnicoPertenceAoSetor(ex.setor, filtroSetor)).sort((a, b) => {
        if (b.executados !== a.executados) return b.executados - a.executados;
        if (b.totalGeral !== a.totalGeral) return b.totalGeral - a.totalGeral;
        return a.nome.localeCompare(b.nome);
    });

    let somaTotalExec = 0, somaTotalNExec = 0, somaTotalGeral = 0, somaTotalHps = 0;

    listaExibicao.forEach((ex, idx) => {
        somaTotalExec += ex.executados;
        somaTotalNExec += ex.naoExecutados;
        somaTotalGeral += ex.totalGeral;
        somaTotalHps += ex.somaHps;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-blue-50/60 border-b cursor-pointer transition";
        tr.onclick = () => dispararExplosaoGrafico('equipe', ex.nome);
        let corConv = "bg-slate-100 text-slate-600";
        if (ex.totalGeral > 0) corConv = ex.conversao >= 70 ? "bg-emerald-100 text-emerald-800" : (ex.conversao >= 30 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800");

        tr.innerHTML = `<td class="p-2.5 text-center font-bold text-slate-500">${idx + 1}º</td><td class="p-2.5 font-bold text-blue-950 underline decoration-dotted">${ex.nome}</td><td class="p-2.5">${obterBadgeSetorHtml(ex.setor)}</td><td class="p-2.5 text-center font-black text-emerald-700 bg-emerald-50/60 text-sm">${ex.executados}</td><td class="p-2.5 text-center font-bold text-amber-800 bg-amber-50/50">${ex.naoExecutados}</td><td class="p-2.5 text-center font-black text-slate-800">${ex.totalGeral}</td><td class="p-2.5 text-center font-mono text-slate-600">${ex.diasTrab}</td><td class="p-2.5 text-center font-black text-indigo-950 bg-indigo-50/80 text-sm">${ex.produtividade.toFixed(2)}</td><td class="p-2.5 text-center font-black text-cyan-900 bg-cyan-50/60">${ex.somaHps}</td><td class="p-2.5 text-center font-semibold text-slate-600">${ex.hpPorDia.toFixed(1)}</td><td class="p-2.5 text-center font-bold text-emerald-800">${ex.tma}</td><td class="p-2.5 text-right"><span class="px-2 py-0.5 rounded font-bold text-[10px] ${corConv}">${ex.conversao.toFixed(1)}%</span></td>`;
        tbody.appendChild(tr);
    });

    if (listaExibicao.length > 0) {
        const convTotal = somaTotalGeral > 0 ? ((somaTotalExec / somaTotalGeral) * 100).toFixed(1) : "0.0";
        const trTotal = document.createElement('tr');
        trTotal.className = "bg-slate-800 text-white font-black text-xs";
        trTotal.innerHTML = `<td colspan="3" class="p-2.5 text-right uppercase">Total Geral Consolidado:</td><td class="p-2.5 text-center text-emerald-300">${somaTotalExec}</td><td class="p-2.5 text-center text-amber-300">${somaTotalNExec}</td><td class="p-2.5 text-center">${somaTotalGeral}</td><td class="p-2.5 text-center">-</td><td class="p-2.5 text-center text-cyan-300">-</td><td class="p-2.5 text-center text-cyan-300">${somaTotalHps}</td><td class="p-2.5 text-center">-</td><td class="p-2.5 text-center">-</td><td class="p-2.5 text-right">${convTotal}%</td>`;
        tbody.appendChild(trTotal);
    }

    let listaGrafico = listaExibicao.filter(e => e.totalGeral > 0);
    if (listaGrafico.length === 0) listaGrafico = listaExibicao.slice(0, 12);

    const ctxExec = document.getElementById('graficoPrincipalExecutores')?.getContext('2d');
    if (ctxExec) {
        if (graficoPrincipalExecutoresInstancia) graficoPrincipalExecutoresInstancia.destroy();
        graficoPrincipalExecutoresInstancia = new Chart(ctxExec, {
            type: 'bar',
            data: {
                labels: listaGrafico.map(e => `${e.nome.split(' ')[0]} ${e.nome.split(' ')[1] ? e.nome.split(' ')[1].charAt(0) + '.' : ''}`),
                datasets: [
                    { label: '🟢 EXECUTADO (Concluídas)', data: listaGrafico.map(e => e.executados), backgroundColor: '#059669', borderRadius: 5 },
                    { label: '🟠 N EXECUTADO (Pend. / Malogradas)', data: listaGrafico.map(e => e.naoExecutados), backgroundColor: '#f59e0b', borderRadius: 5 },
                    { label: '⚡ Produtividade (Média/Dia)', data: listaGrafico.map(e => Number(e.produtividade.toFixed(2))), backgroundColor: '#4f46e5', borderRadius: 5 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } },
                onClick: (event, elements) => { if (elements.length > 0) dispararExplosaoGrafico('equipe', listaGrafico[elements[0].index].nome); }
            }
        });
    }
}

// ================= GRÁFICOS DINÂMICOS DA PLANILHA (SERVIÇO, SEMANAL, DIÁRIO E MATRIZ DIÁRIA) =================
function renderizarPainelMallingEProjetoF(dados) {
    // 1. Gráfico Geral por Serviço (VISTORIA, CONSTRUÇÃO, ATIVAÇÃO) - Espelho chart1.xml da planilha
    const macroServicos = ['VISTORIA', 'CONSTRUÇÃO', 'ATIVAÇÃO'];
    const badgeTotalServ = document.getElementById('badge-total-malling');
    if (badgeTotalServ) badgeTotalServ.innerText = `${dados.length} acionamentos`;

    const ctxServ = document.getElementById('graficoGrupoMalling')?.getContext('2d');
    if (ctxServ) {
        if (graficoGrupoMallingInstancia) graficoGrupoMallingInstancia.destroy();
        graficoGrupoMallingInstancia = new Chart(ctxServ, {
            type: 'bar',
            data: {
                labels: macroServicos,
                datasets: [
                    { label: '🟢 EXECUTADO', data: macroServicos.map(s => dados.filter(d => obterMacroServicoPlanilha(d.projeto) === s && d.desfecho === 'CONCLUIDA').length), backgroundColor: '#059669', borderRadius: 6 },
                    { label: '🟠 N EXECUTADO (Pend./Malo.)', data: macroServicos.map(s => dados.filter(d => obterMacroServicoPlanilha(d.projeto) === s && d.desfecho !== 'CONCLUIDA').length), backgroundColor: '#f59e0b', borderRadius: 6 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { x: { stacked: false }, y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                onClick: (e, el) => { if (el.length > 0) dispararExplosaoGrafico('macro_servico', macroServicos[el[0].index]); }
            }
        });
    }

    // 2. Gráfico Semanal (Sem 1, Sem 2, Sem 3, Sem 4, Sem 5) - Espelho chart3.xml da planilha
    const semanas = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5'];
    const totalExecPeriodo = dados.filter(d => d.desfecho === 'CONCLUIDA').length;
    const badgeSem = document.getElementById('badge-total-projetof');
    if (badgeSem) badgeSem.innerText = `${totalExecPeriodo} executados`;

    const ctxSem = document.getElementById('graficoGrupoProjetoF')?.getContext('2d');
    if (ctxSem) {
        if (graficoGrupoProjetoFInstancia) graficoGrupoProjetoFInstancia.destroy();
        graficoGrupoProjetoFInstancia = new Chart(ctxSem, {
            type: 'bar',
            data: {
                labels: semanas,
                datasets: [
                    { label: '🟢 EXECUTADO na Semana', data: semanas.map(sem => dados.filter(d => obterSemanaDoMes(d.dataRegistro) === sem && d.desfecho === 'CONCLUIDA').length), backgroundColor: '#4f46e5', borderRadius: 6 },
                    { label: '🟠 N EXECUTADO na Semana', data: semanas.map(sem => dados.filter(d => obterSemanaDoMes(d.dataRegistro) === sem && d.desfecho !== 'CONCLUIDA').length), backgroundColor: '#94a3b8', borderRadius: 6 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                onClick: (e, el) => { if (el.length > 0) dispararExplosaoGrafico('semana', semanas[el[0].index]); }
            }
        });
    }

    // 3. Gráfico Diário de Produção - Espelho chart2.xml da planilha
    const datasOrdenadas = [...new Set(dados.map(d => d.dataRegistro).filter(Boolean))].sort();
    const ctxDiario = document.getElementById('graficoEvolucaoGrupos')?.getContext('2d');
    if (ctxDiario) {
        if (graficoEvolucaoGruposInstancia) graficoEvolucaoGruposInstancia.destroy();
        graficoEvolucaoGruposInstancia = new Chart(ctxDiario, {
            type: 'bar',
            data: {
                labels: datasOrdenadas.length > 0 ? datasOrdenadas.map(dt => dt.split('-').reverse().slice(0, 2).join('/')) : ['Sem datas'],
                datasets: [
                    { label: '🟢 EXECUTADO no Dia', data: datasOrdenadas.length > 0 ? datasOrdenadas.map(dt => dados.filter(d => d.dataRegistro === dt && d.desfecho === 'CONCLUIDA').length) : [0], backgroundColor: '#0284c7', borderRadius: 5 },
                    { label: '🟠 N EXECUTADO no Dia', data: datasOrdenadas.length > 0 ? datasOrdenadas.map(dt => dados.filter(d => d.dataRegistro === dt && d.desfecho !== 'CONCLUIDA').length) : [0], backgroundColor: '#cbd5e1', borderRadius: 5 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                onClick: (e, el) => { if (el.length > 0 && datasOrdenadas[el[0].index]) dispararExplosaoGrafico('data', datasOrdenadas[el[0].index]); }
            }
        });
    }

    // 4. Matriz Diária de Execução: Equipes × Datas (Espelho da aba "Diario" da planilha)
    renderizarMatrizDiariaPlanilha(dados, datasOrdenadas);

    // 5. Matriz de Cruzamento: Executores × Projetos
    const theadCruz = document.getElementById('thead-cruzamento-executores');
    const tbodyCruz = document.getElementById('tabela-cruzamento-executores-corpo');
    if (!tbodyCruz) return;
    tbodyCruz.innerHTML = "";

    if (theadCruz) {
        let colsHeader = `<th class="p-2.5">Executor / Técnico</th><th class="p-2.5">Função</th>`;
        GRUPOS_PROJETO_SISTEMA.forEach((grp, gIdx) => {
            const projsDoGrupo = CATALOGO_PROJETOS_SISTEMA.filter(p => p.grupo === grp);
            const bgCol = gIdx % 2 === 0 ? 'bg-blue-50 text-blue-900' : 'bg-indigo-50 text-indigo-900';
            const bgSub = gIdx % 2 === 0 ? 'bg-blue-200 text-blue-950' : 'bg-indigo-200 text-indigo-950';
            projsDoGrupo.forEach(p => { colsHeader += `<th class="p-2 text-center ${bgCol}">${p.nome}</th>`; });
            colsHeader += `<th class="p-2 text-center ${bgSub} font-black">Sub. ${grp}</th>`;
        });
        colsHeader += `<th class="p-2.5 text-center bg-slate-800 text-white font-black">Total Geral</th>`;
        theadCruz.innerHTML = `<tr class="bg-slate-100 text-slate-700 uppercase font-bold text-[9px] border-b">${colsHeader}</tr>`;
    }

    const mapaCruz = {};
    dados.forEach(d => {
        const nome = d.equipe || "NÃO IDENTIFICADO";
        if (!mapaCruz[nome]) {
            const eqObj = equipesSistema.find(e => e.nome === nome);
            mapaCruz[nome] = { nome, setor: eqObj ? eqObj.setor : 'Instalador', contagem: {} };
            TODOS_OS_PROJETOS.forEach(p => mapaCruz[nome].contagem[p] = 0);
        }
        mapaCruz[nome].contagem[d.projeto] = (mapaCruz[nome].contagem[d.projeto] || 0) + 1;
    });

    const listaCruz = Object.values(mapaCruz).sort((a, b) => a.nome.localeCompare(b.nome));
    const totalColunas = 3 + TODOS_OS_PROJETOS.length + GRUPOS_PROJETO_SISTEMA.length;

    if (listaCruz.length === 0) {
        tbodyCruz.innerHTML = `<tr><td colspan="${totalColunas}" class="p-4 text-center text-slate-400">Nenhuma atividade registrada no período.</td></tr>`;
        return;
    }

    listaCruz.forEach(item => {
        const c = item.contagem;
        let totalGeral = 0, celulasMeio = "";
        GRUPOS_PROJETO_SISTEMA.forEach((grp, gIdx) => {
            const projsDoGrupo = CATALOGO_PROJETOS_SISTEMA.filter(p => p.grupo === grp);
            let subGrupo = 0;
            projsDoGrupo.forEach(p => {
                const val = c[p.nome] || 0;
                subGrupo += val;
                celulasMeio += `<td class="p-2 text-center ${val > 0 ? 'font-bold text-slate-800' : 'text-slate-300'}">${val}</td>`;
            });
            totalGeral += subGrupo;
            const bgSub = gIdx % 2 === 0 ? 'bg-blue-100/70 text-blue-950' : 'bg-indigo-100/70 text-indigo-950';
            celulasMeio += `<td class="p-2 text-center font-black ${bgSub}">${subGrupo}</td>`;
        });

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b cursor-pointer";
        tr.onclick = () => dispararExplosaoGrafico('equipe', item.nome);
        tr.innerHTML = `<td class="p-2.5 font-bold text-slate-800">${item.nome}</td><td class="p-2.5">${obterBadgeSetorHtml(item.setor)}</td>${celulasMeio}<td class="p-2.5 text-center font-black bg-slate-100 text-slate-900">${totalGeral}</td>`;
        tbodyCruz.appendChild(tr);
    });
}

function renderizarMatrizDiariaPlanilha(dados, datasOrdenadas) {
    const thead = document.getElementById('thead-matriz-diaria-equipes');
    const tbody = document.getElementById('tabela-matriz-diaria-equipes-corpo');
    if (!thead || !tbody) return;

    tbody.innerHTML = "";
    const datasExibir = datasOrdenadas.length > 0 ? datasOrdenadas : [obterDataLocalISO()];

    let htmlHead = `<tr class="bg-emerald-950 text-white uppercase font-bold text-[9px] tracking-wider"><th class="p-2.5 text-center bg-emerald-900 text-cyan-300">Executados</th><th class="p-2.5">Equipes / Técnico</th>`;
    datasExibir.forEach(dt => {
        const curto = dt.split('-').reverse().slice(0, 2).join('/');
        htmlHead += `<th class="p-2 text-center font-mono">${curto}</th>`;
    });
    htmlHead += `</tr>`;
    thead.innerHTML = htmlHead;

    const mapaDiario = {};
    dados.forEach(d => {
        const eq = d.equipe || "NÃO IDENTIFICADO";
        if (!mapaDiario[eq]) mapaDiario[eq] = { nome: eq, totalExec: 0, porData: {} };
        if (d.desfecho === 'CONCLUIDA') {
            mapaDiario[eq].totalExec++;
            mapaDiario[eq].porData[d.dataRegistro] = (mapaDiario[eq].porData[d.dataRegistro] || 0) + 1;
        } else {
            if (!mapaDiario[eq].porData[d.dataRegistro]) mapaDiario[eq].porData[d.dataRegistro] = 0;
        }
    });

    const listaLinhas = Object.values(mapaDiario).sort((a, b) => b.totalExec - a.totalExec);
    if (listaLinhas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${datasExibir.length + 2}" class="p-4 text-center text-slate-400">Nenhum dado diário para exibir no período.</td></tr>`;
        return;
    }

    const somaColunaData = {};
    datasExibir.forEach(dt => somaColunaData[dt] = 0);
    let somaGeralExec = 0;

    listaLinhas.forEach(item => {
        somaGeralExec += item.totalExec;
        let colsDias = "";
        datasExibir.forEach(dt => {
            const v = item.porData[dt] || 0;
            somaColunaData[dt] += v;
            colsDias += `<td class="p-2 text-center ${v > 0 ? 'font-black text-emerald-800 bg-emerald-50/60' : 'text-slate-300'}">${v > 0 ? v : '-'}</td>`;
        });
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b cursor-pointer";
        tr.onclick = () => dispararExplosaoGrafico('equipe', item.nome);
        tr.innerHTML = `<td class="p-2 text-center font-black bg-emerald-100 text-emerald-950">${item.totalExec}</td><td class="p-2 font-bold text-slate-800 whitespace-nowrap">${item.nome}</td>${colsDias}`;
        tbody.appendChild(tr);
    });

    let colsRodape = "";
    datasExibir.forEach(dt => {
        colsRodape += `<td class="p-2 text-center font-black text-emerald-300">${somaColunaData[dt]}</td>`;
    });
    const trTotal = document.createElement('tr');
    trTotal.className = "bg-slate-800 text-white font-black text-[11px]";
    trTotal.innerHTML = `<td class="p-2 text-center text-cyan-300">${somaGeralExec}</td><td class="p-2 uppercase">Total Executado por Dia</td>${colsRodape}`;
    tbody.appendChild(trTotal);
}

// ================= SEÇÃO E PLANILHA SEPARADA: PROGRAMADO vs. RETORNO (STATUS MACRO) & BAIRRO =================
function renderizarPainelProgramadoRetornoEBairro(dadosEnriquecidos) {
    const tbody = document.getElementById('tabela-programado-retorno-bairro-corpo');
    if (!tbody) return;
    tbody.innerHTML = "";

    const baseValida = dadosEnriquecidos.filter(d => !['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(d.desfecho));
    const totalValidos = baseValida.length;
    const qtdProg = baseValida.filter(d => d.statusMacroPlanilha === 'PROGRAMADO').length;
    const qtdRet  = baseValida.filter(d => d.statusMacroPlanilha === 'RETORNO').length;

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setEl('kpi-macro-programado', qtdProg);
    setEl('kpi-macro-programado-perc', totalValidos > 0 ? `${((qtdProg / totalValidos) * 100).toFixed(1)}% do total` : '0% do total');
    setEl('kpi-macro-retorno', qtdRet);
    setEl('kpi-macro-retorno-perc', totalValidos > 0 ? `${((qtdRet / totalValidos) * 100).toFixed(1)}% do total` : '0% do total');

    const mapaBairros = {};
    baseValida.forEach(d => {
        const b = d.bairroPlanilha || 'OUTROS / VER ENDEREÇO';
        if (!mapaBairros[b]) {
            mapaBairros[b] = { bairro: b, programado: 0, retorno: 0, executado: 0, naoExecutado: 0, total: 0, hps: 0 };
        }
        mapaBairros[b].total++;
        if (d.statusMacroPlanilha === 'RETORNO') mapaBairros[b].retorno++;
        else mapaBairros[b].programado++;

        if (d.desfecho === 'CONCLUIDA') {
            mapaBairros[b].executado++;
            mapaBairros[b].hps += Number(d.hps) || 0;
        } else {
            mapaBairros[b].naoExecutado++;
        }
    });

    const listaBairros = Object.values(mapaBairros).sort((a, b) => b.total - a.total);
    setEl('kpi-macro-qtd-bairros', listaBairros.length);
    if (listaBairros.length > 0) {
        setEl('kpi-macro-top-bairro', listaBairros[0].bairro);
        setEl('kpi-macro-top-bairro-qtd', `${listaBairros[0].total} acionamentos (${listaBairros[0].executado} exec.)`);
    } else {
        setEl('kpi-macro-top-bairro', '-');
        setEl('kpi-macro-top-bairro-qtd', '0 acionamentos');
    }

    if (listaBairros.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Nenhum registro finalizado no período.</td></tr>`;
    } else {
        listaBairros.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-amber-50/50 border-b cursor-pointer transition";
            tr.onclick = () => dispararExplosaoGrafico('bairro', item.bairro);
            tr.innerHTML = `<td class="p-2 font-bold text-slate-800 underline decoration-dotted">${item.bairro}</td><td class="p-2 text-center font-bold text-blue-800 bg-blue-50/50">${item.programado}</td><td class="p-2 text-center font-bold text-amber-800 bg-amber-50/50">${item.retorno}</td><td class="p-2 text-center font-black text-emerald-700 bg-emerald-50/50">${item.executado}</td><td class="p-2 text-center text-slate-500">${item.naoExecutado}</td><td class="p-2 text-center font-black text-slate-900">${item.total}</td><td class="p-2 text-right font-bold text-indigo-900">${item.hps}</td>`;
            tbody.appendChild(tr);
        });
    }

    const topBairrosGraf = listaBairros.slice(0, 12);
    const ctxBairro = document.getElementById('graficoProgramadoRetornoBairro')?.getContext('2d');
    if (ctxBairro) {
        if (graficoProgramadoRetornoBairroInstancia) graficoProgramadoRetornoBairroInstancia.destroy();
        graficoProgramadoRetornoBairroInstancia = new Chart(ctxBairro, {
            type: 'bar',
            data: {
                labels: topBairrosGraf.length > 0 ? topBairrosGraf.map(b => b.bairro) : ['Sem dados'],
                datasets: [
                    { label: '📋 PROGRAMADO (1ª Visita)', data: topBairrosGraf.map(b => b.programado), backgroundColor: '#2563eb', borderRadius: 4 },
                    { label: '🔄 RETORNO (Reincidência)', data: topBairrosGraf.map(b => b.retorno), backgroundColor: '#d97706', borderRadius: 4 },
                    { label: '🟢 EXECUTADO', data: topBairrosGraf.map(b => b.executado), backgroundColor: '#059669', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                onClick: (e, el) => { if (el.length > 0 && topBairrosGraf[el[0].index]) dispararExplosaoGrafico('bairro', topBairrosGraf[el[0].index].bairro); }
            }
        });
    }
}

function exportarPlanilhaProgramadoRetornoBairro() {
    const base = enriquecerStatusMacroEBairro(dadosFiltradosAtuais.length > 0 ? dadosFiltradosAtuais : registrosSalvos).filter(r =>
        r.projeto !== 'IMPREVISTO / ATRASO' &&
        r.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
        r.projeto !== PROJETO_SOLIC_MATERIAL
    );

    if (base.length === 0) {
        alert("⚠️ Nenhum registro encontrado no período para exportar a planilha de Programado vs. Retorno e Bairro.");
        return;
    }

    const mapaBairros = {};
    base.forEach(d => {
        const b = d.bairroPlanilha || 'OUTROS / VER ENDEREÇO';
        if (!mapaBairros[b]) mapaBairros[b] = { bairro: b, prog: 0, ret: 0, exec: 0, nExec: 0, total: 0, hps: 0 };
        mapaBairros[b].total++;
        if (d.statusMacroPlanilha === 'RETORNO') mapaBairros[b].ret++;
        else mapaBairros[b].prog++;
        if (d.desfecho === 'CONCLUIDA') {
            mapaBairros[b].exec++;
            mapaBairros[b].hps += Number(d.hps) || 0;
        } else {
            mapaBairros[b].nExec++;
        }
    });

    const resumoBairros = Object.values(mapaBairros).sort((a, b) => b.total - a.total);

    let html = `<table border="1">
        <thead>
            <tr style="background-color:#0f172a;color:#ffffff;font-weight:bold;">
                <th colspan="7">QUADRO 1: RESUMO EXECUTIVO POR BAIRRO (PROGRAMADO vs. RETORNO)</th>
            </tr>
            <tr style="background-color:#e2e8f0;font-weight:bold;">
                <th>BAIRRO</th><th>PROGRAMADO (1ª VISITA)</th><th>RETORNO (REINCIDÊNCIA)</th><th>EXECUTADO</th><th>N EXECUTADO</th><th>TOTAL GERAL</th><th>SOMA DE HPs</th>
            </tr>
        </thead>
        <tbody>`;

    resumoBairros.forEach(b => {
        html += `<tr><td><b>${b.bairro}</b></td><td>${b.prog}</td><td>${b.ret}</td><td>${b.exec}</td><td>${b.nExec}</td><td><b>${b.total}</b></td><td>${b.hps}</td></tr>`;
    });

    html += `<tr><td colspan="7"></td></tr>
        <tr style="background-color:#1e3a8a;color:#ffffff;font-weight:bold;">
            <th colspan="14">QUADRO 2: BASE ANALÍTICA DETALHADA (PADRÃO PLANILHA ON GOING MDU - STATUS MACRO & BAIRRO)</th>
        </tr>
        <tr style="background-color:#dbeafe;font-weight:bold;">
            <th>SEMANA</th><th>MÊS</th><th>ANO</th><th>DATA</th><th>TÉCNICO</th><th>COD. IMOVEL</th><th>BAIRRO</th><th>SERVIÇO</th><th>PROJETO</th><th>ENDEREÇO</th><th>HP</th><th>STATUS MACRO</th><th>STATUS1 (DETALHE/OFENSOR)</th><th>STATUS</th>
        </tr>`;

    base.forEach(r => {
        const dt = r.dataRegistro || '';
        const ano = dt.substring(0, 4) || '2026';
        const mes = parseInt(dt.substring(5, 7) || '1', 10);
        const status1 = (Array.isArray(r.malogros) && r.malogros.length > 0) ? r.malogros.join(' + ') : (r.motivoDesfecho || r.desfecho);
        html += `<tr>
            <td>${r.semanaPlanilha}</td>
            <td>${mes}</td>
            <td>${ano}</td>
            <td>${dt}</td>
            <td>${r.equipe}</td>
            <td>${r.imovel}</td>
            <td><b>${r.bairroPlanilha}</b></td>
            <td>${r.servicoPlanilha}</td>
            <td>${r.projeto}</td>
            <td>${r.endereco || ''}</td>
            <td>${r.hps || 0}</td>
            <td><b>${r.statusMacroPlanilha}</b></td>
            <td>${status1}</td>
            <td><b>${r.statusBinarioPlanilha}</b></td>
        </tr>`;
    });

    html += `</tbody></table>`;

    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PLANILHA_PROGRAMADO_RETORNO_BAIRRO_${obterDataLocalISO()}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);

    registrarLogAuditoria("EXPORTAÇÃO PROGRAMADO/RETORNO & BAIRRO", `Baixada planilha analítica separada de Programado vs. Retorno e Bairros com ${base.length} registros.`);
}

// ================= OFENSORES DE NÃO EXECUÇÃO (STATUS1 DA PLANILHA) =================
function renderizarOfensoresMalogro(dados) {
    const tbody = document.getElementById('tabela-ofensores-malogro-corpo');
    const badgeTotal = document.getElementById('badge-total-ocorrencias-malogro');
    if (!tbody) return;
    tbody.innerHTML = "";

    const contagemOfensores = {};
    OPCOES_MALOGRO_PADRAO.forEach(o => contagemOfensores[o] = 0);
    let totalOcorrenciasMalogro = 0;

    dados.forEach(d => {
        if ((d.desfecho === 'MALOGRADA' || d.desfecho === 'PENDENTE') && Array.isArray(d.malogros)) {
            d.malogros.forEach(m => {
                const chave = m.trim().toUpperCase();
                contagemOfensores[chave] = (contagemOfensores[chave] || 0) + 1;
                totalOcorrenciasMalogro++;
            });
        }
    });

    if (badgeTotal) badgeTotal.innerText = `${totalOcorrenciasMalogro} ocorrência(s)`;
    const ordenados = Object.entries(contagemOfensores).sort((a, b) => b[1] - a[1]);

    ordenados.forEach(([ofensor, qtd], idx) => {
        const perc = totalOcorrenciasMalogro > 0 ? ((qtd / totalOcorrenciasMalogro) * 100).toFixed(1) : "0.0";
        const tr = document.createElement('tr');
        tr.className = "hover:bg-red-50/60 border-b cursor-pointer transition";
        tr.onclick = () => dispararExplosaoGrafico('ofensor', ofensor);
        tr.innerHTML = `<td class="py-2 font-bold text-slate-400">${idx + 1}º</td><td class="py-2 font-bold text-red-900 underline decoration-dotted">${ofensor}</td><td class="py-2 text-center font-black text-slate-800">${qtd}</td><td class="py-2 text-right"><div class="flex items-center justify-end gap-2"><div class="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden"><div class="bg-red-600 h-1.5" style="width: ${perc}%"></div></div><span class="text-[10px] font-bold text-slate-600 w-9">${perc}%</span></div></td>`;
        tbody.appendChild(tr);
    });

    const ctxOfensores = document.getElementById('graficoOfensoresMalogro')?.getContext('2d');
    if (ctxOfensores) {
        if (graficoOfensoresMalogroInstancia) graficoOfensoresMalogroInstancia.destroy();
        const labelsOfensores = ordenados.map(item => item[0]);
        graficoOfensoresMalogroInstancia = new Chart(ctxOfensores, {
            type: 'bar',
            data: { labels: labelsOfensores, datasets: [{ label: 'Ocorrências de Não Execução', data: ordenados.map(item => item[1]), backgroundColor: '#dc2626', borderRadius: 6 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }, onClick: (event, elements) => { if (elements.length > 0) dispararExplosaoGrafico('ofensor', labelsOfensores[elements[0].index]); } }
        });
    }
}

// ================= SUPER MODAL DE EDIÇÃO COMPLETA E EXCLUSÃO INSTANTÂNEA =================
function lerCheckboxesAtuaisModalEdicao() {
    const checks = document.querySelectorAll('input[name="chk-opcao-modal-edicao"]:checked');
    if (checks.length > 0) opcoesMarcadasEdicaoTemporarias = Array.from(checks).map(c => c.value);
}

function aoMudarDesfechoModalEdicao() {
    lerCheckboxesAtuaisModalEdicao();
    renderizarOpcoesCheckboxesModalEdicao(document.getElementById('edit-reg-desfecho')?.value || 'CONCLUIDA', opcoesMarcadasEdicaoTemporarias);
}

function renderizarOpcoesCheckboxesModalEdicao(desfechoAlvo, selecionadas = []) {
    const container = document.getElementById('container-checkboxes-edicao');
    const lblTitulo = document.getElementById('lbl-titulo-opcoes-modal-edicao');
    if (!container) return;

    let opcoesBase = [];
    if (desfechoAlvo === 'PENDENTE') { opcoesBase = [...OPCOES_PENDENCIA_PADRAO]; if (lblTitulo) lblTitulo.innerText = "🟡 3. Opções de Pendência"; }
    else if (desfechoAlvo === 'MALOGRADA') { opcoesBase = [...OPCOES_MALOGRO_PADRAO]; if (lblTitulo) lblTitulo.innerText = "🔴 3. Ofensores de Malogro"; }
    else if (desfechoAlvo === 'IMPREVISTO' || desfechoAlvo === 'IMPREVISTO RESOLVIDO') { opcoesBase = [...OPCOES_IMPREVISTO_PADRAO]; if (lblTitulo) lblTitulo.innerText = "⚠️ 3. Motivos de Imprevisto / Atraso"; }
    else { opcoesBase = [...OPCOES_CONCLUIDA_PADRAO]; if (lblTitulo) lblTitulo.innerText = "🟢 3. Itens Verificados / Opções Vinculadas"; }

    (selecionadas || []).forEach(op => {
        const limpo = String(op).trim().toUpperCase();
        if (limpo && !opcoesBase.includes(limpo)) opcoesBase.push(limpo);
    });

    const setSelecionadas = new Set((selecionadas || []).map(s => String(s).trim().toUpperCase()));
    container.innerHTML = opcoesBase.map(op => `<label class="flex items-center gap-1.5 font-semibold text-slate-700 hover:bg-amber-50 p-1 rounded cursor-pointer"><input type="checkbox" name="chk-opcao-modal-edicao" value="${op}" ${setSelecionadas.has(op.toUpperCase()) ? 'checked' : ''} class="w-4 h-4 accent-blue-900 rounded"><span class="text-[11px]">${op}</span></label>`).join('');
}

async function incluirOpcaoCustomizadaNoModalEdicao() {
    const inp = document.getElementById('inp-nova-opcao-rapida-edicao');
    if (!inp) return;
    const novaOp = inp.value.trim().toUpperCase();
    if (!novaOp) { alert("⚠️ Digite o nome da opção."); return; }

    const checksAtuais = document.querySelectorAll('input[name="chk-opcao-modal-edicao"]:checked');
    opcoesMarcadasEdicaoTemporarias = Array.from(checksAtuais).map(c => c.value);
    if (!opcoesMarcadasEdicaoTemporarias.includes(novaOp)) opcoesMarcadasEdicaoTemporarias.push(novaOp);

    const desf = document.getElementById('edit-reg-desfecho')?.value || 'CONCLUIDA';
    let adicionouNaListaGlobal = false;
    if (desf === 'PENDENTE' && !OPCOES_PENDENCIA_PADRAO.includes(novaOp)) { OPCOES_PENDENCIA_PADRAO.push(novaOp); adicionouNaListaGlobal = true; }
    else if (desf === 'MALOGRADA' && !OPCOES_MALOGRO_PADRAO.includes(novaOp)) { OPCOES_MALOGRO_PADRAO.push(novaOp); adicionouNaListaGlobal = true; }
    else if ((desf === 'IMPREVISTO' || desf === 'IMPREVISTO RESOLVIDO') && !OPCOES_IMPREVISTO_PADRAO.includes(novaOp)) { OPCOES_IMPREVISTO_PADRAO.push(novaOp); adicionouNaListaGlobal = true; }

    if (adicionouNaListaGlobal) { await sincronizarOpcoesNaNuvem(); renderizarPainelOpcoesSistema(); }
    inp.value = "";
    renderizarOpcoesCheckboxesModalEdicao(desf, opcoesMarcadasEdicaoTemporarias);
}

function renderizarFotosModalEdicao() {
    const container = document.getElementById('container-fotos-modal-edicao');
    const lblQtd = document.getElementById('lbl-qtd-fotos-edicao');
    if (!container) return;
    if (lblQtd) lblQtd.innerText = fotosEdicaoTemporarias.length;
    if (fotosEdicaoTemporarias.length === 0) {
        container.innerHTML = `<span class="text-[11px] text-slate-400 italic">Nenhuma foto anexada neste registro.</span>`;
        return;
    }
    container.innerHTML = fotosEdicaoTemporarias.map((fSrc, idx) => `<div class="relative border border-slate-300 rounded-lg overflow-hidden w-16 h-16 bg-white shadow-sm"><img src="${fSrc}" onclick="abrirZoomFoto('${fSrc}', 'Foto_Edit_${idx + 1}.jpg')" class="w-full h-full object-cover cursor-pointer"><button type="button" onclick="removerFotoModalEdicao(${idx})" class="absolute top-0.5 right-0.5 bg-red-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">✕</button></div>`).join('');
}

async function adicionarFotosNoModalEdicao(inputEl) {
    const arquivos = Array.from(inputEl.files || []);
    if (arquivos.length === 0) return;
    if (fotosEdicaoTemporarias.length + arquivos.length > 10) { alert("⚠️ Máximo de 10 fotos por registro."); inputEl.value = ""; return; }
    for (const arq of arquivos) {
        try { fotosEdicaoTemporarias.push(await comprimirImagemBase64(arq, 780, 0.60)); } catch (e) {}
    }
    inputEl.value = "";
    renderizarFotosModalEdicao();
}

function removerFotoModalEdicao(idx) {
    fotosEdicaoTemporarias.splice(idx, 1);
    renderizarFotosModalEdicao();
}

async function abrirModalEdicao(id) {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') { alert("⚠️ Acesso restrito para edição."); return; }
    let reg = registrosSalvos.find(r => r.id === id);
    if (!reg) return;
    popularSelectProjetosGlobal();

    snapshotStatusEdicaoOriginal = { id: reg.id, desfecho: reg.desfecho, hSaida: reg.hSaida, equipe: reg.equipe };
    document.getElementById('edit-reg-id').value = reg.id;
    document.getElementById('edit-reg-data').value = reg.dataRegistro || obterDataLocalISO();

    const selEqEdit = document.getElementById('edit-reg-equipe');
    if (selEqEdit) {
        const nomesEquipes = equipesSistema.map(e => e.nome);
        if (reg.equipe && !nomesEquipes.includes(reg.equipe)) nomesEquipes.unshift(reg.equipe);
        selEqEdit.innerHTML = nomesEquipes.map(nome => `<option value="${nome}">${nome}</option>`).join('');
        selEqEdit.value = reg.equipe || "";
    }

    const selProjEdit = document.getElementById('edit-reg-projeto');
    if (selProjEdit && reg.projeto && !Array.from(selProjEdit.options).some(o => o.value === reg.projeto)) {
        selProjEdit.innerHTML += `<option value="${reg.projeto}">${reg.projeto}</option>`;
    }

    document.getElementById('edit-reg-imovel').value = reg.imovel || '';
    document.getElementById('edit-reg-endereco').value = reg.endereco || '';
    document.getElementById('edit-reg-liberou-acesso').value = reg.liberouAcesso || '';
    document.getElementById('edit-reg-responsavel').value = reg.responsavel || '';
    document.getElementById('edit-reg-contato').value = reg.contato || '';
    document.getElementById('edit-reg-email').value = reg.email || '';
    document.getElementById('edit-reg-projeto').value = reg.projeto || (TODOS_OS_PROJETOS[0] || 'CONSTRUÇÃO ON GOING');
    document.getElementById('edit-reg-desfecho').value = reg.desfecho || 'CONCLUIDA';
    document.getElementById('edit-reg-h-entrada').value = reg.hEntrada || '';
    document.getElementById('edit-reg-h-saida').value = reg.hSaida || '';
    document.getElementById('edit-reg-pausa').value = Number(reg.tempoPausadoMinutos) || 0;
    document.getElementById('edit-reg-gps-entrada').value = reg.gpsEntrada || '';
    document.getElementById('edit-reg-gps-saida').value = reg.gpsSaida || '';
    document.getElementById('edit-reg-servico-obra').value = reg.servicoObra || 'SIM';
    document.getElementById('edit-reg-andares').value = reg.andares || 0;
    document.getElementById('edit-reg-hps').value = reg.hps || 0;
    document.getElementById('edit-reg-cabo-rl').value = reg.caboRL || 0;
    document.getElementById('edit-reg-conectores').value = reg.conectores || 0;
    document.getElementById('edit-reg-cabo-drop').value = reg.caboDrop || 0;
    document.getElementById('edit-reg-nap').value = reg.nap || 0;
    document.getElementById('edit-reg-dio').value = reg.dio || 0;
    document.getElementById('edit-reg-fusoes').value = reg.fusoes || 0;
    document.getElementById('edit-reg-cx-sobrepor').value = reg.cxSobrepor || 0;
    document.getElementById('edit-reg-cx-embutida').value = reg.cxEmbutida || 0;
    document.getElementById('edit-reg-cx-fosc').value = reg.cxFosc || 0;
    document.getElementById('edit-reg-motivo-desfecho').value = reg.motivoDesfecho || '';
    document.getElementById('edit-reg-observacoes').value = reg.observacoes || '';

    opcoesMarcadasEdicaoTemporarias = Array.isArray(reg.malogros) ? [...reg.malogros] : [];
    renderizarOpcoesCheckboxesModalEdicao(reg.desfecho, opcoesMarcadasEdicaoTemporarias);
    document.getElementById('modal-edicao').classList.remove('hidden');

    let fotosAtuais = Array.isArray(reg.fotos) ? [...reg.fotos] : [];
    if (fotosAtuais.length === 0 && typeof obterFotosSobDemandaDoRegistro === 'function') {
        fotosAtuais = await obterFotosSobDemandaDoRegistro(reg.id);
    }
    fotosEdicaoTemporarias = [...fotosAtuais];
    renderizarFotosModalEdicao();
}

function fecharModalEdicao() { document.getElementById('modal-edicao').classList.add('hidden'); }

async function salvarEdicaoRegistro() {
    let id = Number(document.getElementById('edit-reg-id').value);
    let regOriginal = registrosSalvos.find(r => r.id === id);

    const btnSalvar = document.getElementById('btn-salvar-modal-edicao');
    if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.innerText = "🛡️ Verificando conflitos e salvando..."; }

    try {
        const { data: versaoNuvem } = await supabaseClient.from('registros_producao').select('desfecho, h_saida, equipe').eq('id', id).maybeSingle();
        if (versaoNuvem && snapshotStatusEdicaoOriginal && snapshotStatusEdicaoOriginal.id === id && (versaoNuvem.desfecho !== snapshotStatusEdicaoOriginal.desfecho || versaoNuvem.h_saida !== snapshotStatusEdicaoOriginal.hSaida)) {
            if (!confirm(`🛡️ TRAVA ANTI-CONFLITO!\n\nEste registro foi atualizado na nuvem enquanto a janela estava aberta (${versaoNuvem.desfecho}). Deseja sobrescrever mesmo assim?`)) {
                if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.innerText = "💾 Salvar Todas as Alterações"; }
                fecharModalEdicao();
                await recarregarDadosGestor(false);
                return;
            }
        }
    } catch (e) {}

    let data_registro = document.getElementById('edit-reg-data').value || (regOriginal ? regOriginal.dataRegistro : obterDataLocalISO());
    let equipe = document.getElementById('edit-reg-equipe').value || (regOriginal ? regOriginal.equipe : '');
    let imovel = document.getElementById('edit-reg-imovel').value.trim();
    let endereco = document.getElementById('edit-reg-endereco').value.trim();
    let liberouAcesso = document.getElementById('edit-reg-liberou-acesso').value.trim();
    let responsavel = document.getElementById('edit-reg-responsavel').value.trim();
    let contato = document.getElementById('edit-reg-contato').value.trim();
    let email = document.getElementById('edit-reg-email').value.trim();
    let projeto = document.getElementById('edit-reg-projeto').value;
    let desfecho = document.getElementById('edit-reg-desfecho').value;
    let h_entrada = document.getElementById('edit-reg-h-entrada').value.trim();
    let h_saida = document.getElementById('edit-reg-h-saida').value.trim();
    let pausaMin = Number(document.getElementById('edit-reg-pausa').value) || 0;
    let gps_entrada = document.getElementById('edit-reg-gps-entrada').value.trim();
    let gps_saida = document.getElementById('edit-reg-gps-saida').value.trim();
    let servico_obra = document.getElementById('edit-reg-servico-obra').value || 'SIM';
    let andares = Number(document.getElementById('edit-reg-andares').value) || 0;
    let hps = Number(document.getElementById('edit-reg-hps').value) || 0;
    let cabo_rl = Number(document.getElementById('edit-reg-cabo-rl').value) || 0;
    let conectores = Number(document.getElementById('edit-reg-conectores').value) || 0;
    let cabo_drop = Number(document.getElementById('edit-reg-cabo-drop').value) || 0;
    let nap = Number(document.getElementById('edit-reg-nap').value) || 0;
    let dio = Number(document.getElementById('edit-reg-dio').value) || 0;
    let fusoes = Number(document.getElementById('edit-reg-fusoes').value) || 0;
    let cx_sobrepor = Number(document.getElementById('edit-reg-cx-sobrepor').value) || 0;
    let cx_embutida = Number(document.getElementById('edit-reg-cx-embutida').value) || 0;
    let cx_fosc = Number(document.getElementById('edit-reg-cx-fosc').value) || 0;
    let motivo_desfecho = document.getElementById('edit-reg-motivo-desfecho').value.trim();
    let obsLimpa = document.getElementById('edit-reg-observacoes').value.trim();

    const listaMalogrosOpcoes = Array.from(document.querySelectorAll('input[name="chk-opcao-modal-edicao"]:checked')).map(c => c.value);
    let tagEnd = endereco ? `[END: ${endereco}] ` : '';
    let tagLiberou = liberouAcesso ? `[LIBEROU_ACESSO: ${liberouAcesso}] ` : '';
    let tagPausa = pausaMin > 0 ? `[PAUSA_TOTAL: ${pausaMin}] ` : '';
    let sufixoBlocos = (regOriginal && regOriginal.qtdBlocosProgramados > 1) ? ` [BLOCOS: ${regOriginal.qtdBlocosProgramados}]` : '';
    let sufixoFotos = (fotosEdicaoTemporarias && fotosEdicaoTemporarias.length > 0) ? ` [FOTOS:${JSON.stringify(fotosEdicaoTemporarias)}]` : '';
    let obsComTagsEFotos = `${tagEnd}${tagLiberou}${tagPausa}${obsLimpa}${sufixoBlocos}${sufixoFotos}`.trim();

    let dadosAtualizados = {
        data_registro, equipe, membros: equipe, imovel, projeto, desfecho, h_entrada, h_saida,
        gps_entrada, gps_saida, responsavel, contato, email, servico_obra, motivo_desfecho,
        malogros: listaMalogrosOpcoes, andares, hps, observacoes: obsComTagsEFotos,
        cabo_rl, conectores, cabo_drop, nap, dio, fusoes, cx_sobrepor, cx_embutida, cx_fosc
    };

    const { error } = await supabaseClient.from('registros_producao').update(dadosAtualizados).eq('id', id);
    if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.innerText = "💾 Salvar Todas as Alterações"; }
    if (error) { alert("Erro ao atualizar registro: " + error.message); return; }

    if (regOriginal) {
        Object.assign(regOriginal, {
            dataRegistro: data_registro, equipe, membros: equipe, imovel, endereco, liberouAcesso, responsavel,
            contato, email, projeto, desfecho, hEntrada: h_entrada, hSaida: h_saida, tempoPausadoMinutos: pausaMin,
            gpsEntrada: gps_entrada, gpsSaida: gps_saida, servicoObra: servico_obra, motivoDesfecho: motivo_desfecho,
            malogros: listaMalogrosOpcoes, andares, hps, observacoes: obsLimpa, fotos: [...fotosEdicaoTemporarias],
            qtdFotos: fotosEdicaoTemporarias.length, caboRL: cabo_rl, conectores, caboDrop: cabo_drop, nap, dio,
            fusoes, cxSobrepor: cx_sobrepor, cxEmbutida: cx_embutida, cxFosc: cx_fosc
        });
    }

    fecharModalEdicao();
    atualizarDashboardGestor();
    registrarLogAuditoria("EDIÇÃO COMPLETA DE REGISTRO", `Registro ID ${id} (Imóvel: ${imovel} | Equipe: ${equipe}) atualizado para status ${desfecho}.`);
    alert("✅ Registro atualizado instantaneamente!");
}

async function excluirRegistro(id, imovelCod) {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') { alert("⚠️ Acesso restrito para exclusão."); return; }
    if (confirm(`Deseja excluir o registro "${imovelCod}"?`)) {
        const { error } = await supabaseClient.from('registros_producao').delete().eq('id', id);
        if (error) { alert("Erro ao excluir: " + error.message); }
        else {
            if (typeof cacheFotosSobDemanda !== 'undefined') cacheFotosSobDemanda.delete(id);
            if (typeof reciclarContagemBytesFotos === 'function') reciclarContagemBytesFotos();
            registrosSalvos = registrosSalvos.filter(r => r.id !== id);
            atualizarDashboardGestor();
            registrarLogAuditoria("EXCLUSÃO DE REGISTRO", `Registro ${imovelCod} (ID: ${id}) foi apagado.`);
        }
    }
}

function renderizarTabelaFinanceiro(totais) {
    const corpo = document.getElementById('tabela-financeiro-corpo');
    const spanTotalGeral = document.getElementById('fin-total-geral');
    if (!corpo) return;
    corpo.innerHTML = "";

    let itensMedicao = [
        { chave: "VISTORIA", qtd: totais.vistorias }, { chave: "CABO RL", qtd: totais.caboRL },
        { chave: "CONECTORES", qtd: totais.conectores }, { chave: "FUSÕES", qtd: totais.fusoes },
        { chave: "CABO DROP", qtd: totais.caboDrop }, { chave: "NAP", qtd: totais.nap },
        { chave: "DIO", qtd: totais.dio }, { chave: "CX SOBREPOR", qtd: totais.cxSobrepor },
        { chave: "CX EMBUTIDA", qtd: totais.cxEmbutida }
    ];

    let valorGeralAcumulado = 0;
    itensMedicao.forEach(item => {
        let cfg = TABELA_PRECOS[item.chave];
        let totalItem = item.qtd * cfg.valor;
        valorGeralAcumulado += totalItem;
        corpo.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="p-3 font-mono font-bold text-slate-700">${cfg.codigo}</td><td class="p-3 font-semibold text-slate-800">${cfg.desc}</td><td class="p-3 text-slate-600">${cfg.unidade}</td><td class="p-3 text-center font-bold text-blue-900">${item.qtd.toLocaleString('pt-BR')}</td><td class="p-3 text-right text-slate-600">R$ ${cfg.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td><td class="p-3 text-right font-black text-emerald-700">R$ ${totalItem.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td></tr>`;
    });
    if (spanTotalGeral) spanTotalGeral.innerText = `R$ ${valorGeralAcumulado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
}

function renderizarTabelaUsuariosPermissao() {
    const corpo = document.getElementById('tabela-usuarios-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";
    let listaVisivel = (nivelUsuarioLogado === 'Visualizador' || nivelUsuarioLogado === 'Operador')
        ? usuariosSistema.filter(u => u.email.toLowerCase() === usuarioLogado.toLowerCase())
        : usuariosSistema;

    listaVisivel.forEach(u => {
        let acoesHtml = `<button onclick="abrirModalUsuario(${u.id})" class="bg-blue-50 text-blue-700 font-bold text-[10px] px-2.5 py-1 rounded">✏️ Alterar Senha</button>`;
        if (nivelUsuarioLogado === 'Master') acoesHtml += ` <button onclick="excluirUsuario(${u.id}, '${u.email}')" class="bg-red-50 text-red-600 font-bold text-[10px] px-2.5 py-1 rounded">🗑️ Excluir</button>`;
        corpo.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="p-3"><div class="font-bold">${u.nome}</div><div class="text-[10px] text-slate-400">${u.email}</div></td><td class="p-3"><span class="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-[10px]">${u.nivel}</span></td><td class="p-3"><span class="text-emerald-600 font-semibold">${u.status}</span></td><td class="p-3">${acoesHtml}</td></tr>`;
    });
}

function renderizarTabelaConsolidada(dados) {
    const corpo = document.getElementById('tabela-consolidada-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";
    let total = dados.length, categorias = {};
    dados.forEach(d => {
        const statusPlanilha = d.desfecho === 'CONCLUIDA' ? 'EXECUTADO' : `N EXECUTADO (${d.desfecho})`;
        let chave = `[${obterMacroServicoPlanilha(d.projeto)}] ${d.projeto} — ${statusPlanilha}`;
        if (!categorias[chave]) categorias[chave] = { qtd: 0, hps: 0 };
        categorias[chave].qtd++;
        categorias[chave].hps += Number(d.hps) || 0;
    });
    if (Object.keys(categorias).length === 0) {
        corpo.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Nenhum dado consolidado no período.</td></tr>`;
        return;
    }
    for (let [cat, info] of Object.entries(categorias)) {
        let perc = total > 0 ? ((info.qtd / total) * 100).toFixed(1) : 0;
        corpo.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="p-3 font-semibold text-slate-800">${cat}</td><td class="p-3 text-center font-bold text-blue-900">${info.qtd}</td><td class="p-3 text-center font-bold text-indigo-800">${info.hps}</td><td class="p-3 text-center text-slate-600">${perc}%</td></tr>`;
    }
}

async function abrirDetalhesAtividade(item) {
    if (!item) return;
    itemDetalheAtualModal = item;
    const modal = document.getElementById('modal-detalhes');
    const conteudo = document.getElementById('modal-detalhes-conteudo');
    document.getElementById('modal-detalhes-titulo').innerText = `Detalhes do Registro: ${item.imovel}`;

    let linkGpsEntrada = item.gpsEntrada && item.gpsEntrada.includes(',') ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.gpsEntrada)}" target="_blank" class="text-blue-600 underline font-bold">🗺️ ${item.gpsEntrada} (Maps)</a>` : item.gpsEntrada;
    let linkGpsSaida = item.gpsSaida && item.gpsSaida.includes(',') ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.gpsSaida)}" target="_blank" class="text-blue-600 underline font-bold">🗺️ ${item.gpsSaida} (Maps)</a>` : item.gpsSaida;
    let malogrosStr = item.malogros && item.malogros.length > 0 ? item.malogros.join(' + ') : 'Nenhum';

    const minIn = converterHorarioParaMinutos(item.hEntrada);
    const minOut = converterHorarioParaMinutos(item.hSaida);
    const pausaMin = Number(item.tempoPausadoMinutos) || 0;
    const duracaoStr = (minIn !== null && minOut !== null && minOut >= minIn) ? formatarDuracaoTexto(Math.max(0, (minOut - minIn) - pausaMin)) : "-";
    const classeCorDesfecho = obterClasseCorDesfecho(item.desfecho);

    let fotosItem = Array.isArray(item.fotos) ? item.fotos : [];
    if (fotosItem.length === 0 && typeof obterFotosSobDemandaDoRegistro === 'function') {
        fotosItem = await obterFotosSobDemandaDoRegistro(item.id);
    }

    const codigoLimpo = (item.imovel || 'imovel').replace(/[^a-zA-Z0-9_-]/g, '_');
    let galeriaFotosHtml = `<div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-400 text-[11px]">📷 Nenhuma foto anexada neste registro.</div>`;
    if (fotosItem && fotosItem.length > 0) {
        const cardsFotos = fotosItem.map((fSrc, idx) => {
            const nomeArq = `${codigoLimpo}_foto_${idx + 1}.jpg`;
            const legendaSlot = (item.projeto === PROJETO_SOLIC_COMBUSTIVEL && Array.isArray(item.malogros) && item.malogros[idx]) ? `<div class="text-[9px] font-black text-orange-900 uppercase">${item.malogros[idx]}</div>` : '';
            return `<div class="bg-white p-2 rounded-xl border border-indigo-200 shadow-sm flex flex-col items-center gap-1.5">${legendaSlot}<img src="${fSrc}" onclick="abrirZoomFoto('${fSrc}', '${nomeArq}')" class="w-full h-28 object-cover rounded-lg cursor-pointer hover:opacity-90 transition border"><div class="flex gap-1 w-full"><button type="button" onclick="abrirZoomFoto('${fSrc}', '${nomeArq}')" class="flex-1 bg-indigo-50 text-indigo-900 font-bold text-[10px] py-1 rounded">🔍 Ampliar</button><button type="button" onclick="baixarFotoDireto('${fSrc}', '${nomeArq}')" class="flex-1 bg-emerald-600 text-white font-bold text-[10px] py-1 rounded">⬇️ Baixar</button></div></div>`;
        }).join('');
        galeriaFotosHtml = `<div class="bg-indigo-50/70 p-3 rounded-lg border border-indigo-200 space-y-2"><h4 class="font-bold text-indigo-950 text-xs uppercase">📷 Fotos Anexadas (${fotosItem.length})</h4><div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">${cardsFotos}</div></div>`;
    }

    let infoTratativaHtml = '';
    if (item.tratadoPor) {
        infoTratativaHtml = `<div class="bg-emerald-50 border border-emerald-300 p-3 rounded-lg text-xs text-emerald-950 space-y-1"><div><strong>✅ Tratado Por:</strong> ${item.tratadoPor}</div><div><strong>🕒 Data/Hora da Tratativa:</strong> ${item.tratadoDataHora || item.hSaida}</div><div class="text-[10px] text-orange-800 font-bold">⏳ ${calcularTempoRestante48h(item.tratadoTimestamp)}</div></div>`;
    }

    conteudo.innerHTML = `
        ${infoTratativaHtml}
        <div class="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border">
            <div class="col-span-2"><strong>📍 Identificação / Endereço:</strong> <span class="font-bold text-blue-950">${item.endereco || item.imovel || 'Não informado'}</span></div>
            <div class="col-span-2 flex flex-wrap gap-2">
                <span class="bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded text-[10px]">🏘️ Bairro: ${extrairBairroDoEndereco(item.endereco)}</span>
                <span class="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px]">📌 Status Macro: ${item.statusMacroPlanilha || 'PROGRAMADO'}</span>
                <span class="bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded text-[10px]">📅 ${obterSemanaDoMes(item.dataRegistro)}</span>
            </div>
            ${item.liberouAcesso ? `<div class="col-span-2 bg-amber-50 p-2 rounded border border-amber-200"><strong>🔑 Liberou o Acesso:</strong> <span class="font-black text-amber-950">${item.liberouAcesso}</span></div>` : ''}
            <div><strong>Data do Registro:</strong> ${item.dataRegistro}</div>
            <div><strong>Técnico / Equipe:</strong> ${item.equipe}</div>
            <div><strong>Projeto / Tipo:</strong> ${item.projeto}</div>
            <div><strong>Status / Desfecho:</strong> <span class="font-bold px-2 py-0.5 rounded text-[10px] ${classeCorDesfecho}">${item.desfecho}</span></div>
            <div><strong>Andares / Ref:</strong> ${item.andares || 0}</div>
            <div><strong>HPs / Fotos:</strong> ${item.hps || 0}</div>
            <div><strong>Responsável / Placa:</strong> ${item.responsavel || '-'}</div>
            <div><strong>Contato / KM:</strong> ${item.contato || '-'}</div>
        </div>
        ${galeriaFotosHtml}
        <div class="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-1">
            <h4 class="font-bold text-blue-900 text-xs uppercase">🕒 Horários e GPS</h4>
            <div><strong>Horário Entrada / Pedido:</strong> ${item.hEntrada}</div>
            <div><strong>GPS Entrada:</strong> ${linkGpsEntrada}</div>
            <div class="pt-1"><strong>Horário Saída / Tratativa:</strong> ${item.hSaida}</div>
            <div><strong>GPS Saída:</strong> ${linkGpsSaida}</div>
            ${pausaMin > 0 ? `<div class="pt-1 text-orange-700 font-bold"><strong>⏸️ Tempo Paralisado:</strong> ${pausaMin} min</div>` : ''}
            <div class="pt-1 text-emerald-800 font-bold"><strong>⏱️ Tempo Líquido:</strong> ${duracaoStr}</div>
        </div>
        ${(item.malogros && item.malogros.length > 0) ? `<div class="bg-amber-50 p-3 rounded-lg border border-amber-200"><strong>Itens / Opções (` + 'STATUS1' + `):</strong> <span class="font-bold text-amber-950">${malogrosStr}</span></div>` : ''}
        ${item.motivoDesfecho ? `<div class="bg-slate-50 p-3 rounded-lg border border-slate-200"><strong>Detalhamento / Motivo:</strong> ${item.motivoDesfecho}</div>` : ''}
        ${item.observacoes ? `<div class="bg-slate-50 p-3 rounded-lg border border-slate-200"><strong>Observações:</strong> ${item.observacoes}</div>` : ''}
    `;
    modal.classList.remove('hidden');
}

function fecharModalDetalhes() { document.getElementById('modal-detalhes').classList.add('hidden'); }

function dispararExplosaoGrafico(filtroTipo, filtroValor) {
    const modal = document.getElementById('modal-explosao');
    const corpo = document.getElementById('tabela-explosao-corpo');
    document.getElementById('modal-explosao-titulo').innerText = `Modo Explosão Executivo: ${filtroTipo.toUpperCase()} -> ${filtroValor}`;
    corpo.innerHTML = "";

    let subset = dadosFiltradosAtuais.filter(item => {
        if (filtroTipo === 'projeto') return item.projeto === filtroValor;
        if (filtroTipo === 'macro_servico') return obterMacroServicoPlanilha(item.projeto) === filtroValor;
        if (filtroTipo === 'semana') return obterSemanaDoMes(item.dataRegistro) === filtroValor;
        if (filtroTipo === 'data') return item.dataRegistro === filtroValor;
        if (filtroTipo === 'bairro') return (item.bairroPlanilha || extrairBairroDoEndereco(item.endereco)) === filtroValor;
        if (filtroTipo === 'desfecho') return item.desfecho === filtroValor;
        if (filtroTipo === 'equipe') return item.equipe === filtroValor;
        if (filtroTipo === 'ofensor') return (item.desfecho === 'MALOGRADA' || item.desfecho === 'PENDENTE') && Array.isArray(item.malogros) && item.malogros.map(m => m.trim().toUpperCase()).includes(filtroValor.toUpperCase());
        return false;
    });

    if (subset.length === 0) {
        corpo.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">Nenhum registro encontrado para esta seleção.</td></tr>`;
    } else {
        subset.forEach(item => {
            let detalheInfo = item.malogros && item.malogros.length > 0 ? `STATUS1: ${item.malogros.join(' + ')}` : (item.motivoDesfecho || 'Concluído sem pendências');
            const classeCorDesfecho = obterClasseCorDesfecho(item.desfecho);
            const macroBadge = item.statusMacroPlanilha === 'RETORNO' ? '🔄 RETORNO' : '📋 PROGRAMADO';
            corpo.innerHTML += `<tr class="hover:bg-slate-50 border-b text-xs cursor-pointer" onclick="fecharModalExplosao(); fecharModalGraficoExpandido(); fecharModalTabelaExpandida(); abrirDetalhesAtividade(registrosSalvos.find(r => r.id === ${item.id}))"><td class="p-2.5 font-mono text-slate-600 font-bold">${item.dataRegistro}<div class="text-[9px] text-indigo-700">${obterSemanaDoMes(item.dataRegistro)}</div></td><td class="p-2.5"><div class="font-bold text-slate-800">${item.imovel}</div><div class="text-[10px] text-slate-500">📍 ${item.endereco || '-'} (<b>${item.bairroPlanilha || extrairBairroDoEndereco(item.endereco)}</b>)</div></td><td class="p-2.5 font-semibold text-blue-900">${item.equipe}</td><td class="p-2.5"><b>${item.projeto}</b><div class="text-[9px] font-bold text-amber-800">${macroBadge}</div></td><td class="p-2.5"><span class="font-bold px-2 py-0.5 rounded text-[10px] inline-block ${classeCorDesfecho}">${item.desfecho}</span><div class="text-[9px] text-slate-500 mt-0.5">HPs: <b>${item.hps || 0}</b></div></td><td class="p-2.5 text-slate-500">${detalheInfo}</td></tr>`;
        });
    }
    modal.classList.remove('hidden');
}

function fecharModalExplosao() { document.getElementById('modal-explosao').classList.add('hidden'); }

// ================= GRÁFICOS GERAIS E CURVA DE PICOS POR HORÁRIO (MANTIDA INTACTA) =================
function renderizarGraficos(dados, todosFiltrados = []) {
    let projetosCount = {};
    TODOS_OS_PROJETOS.forEach(p => projetosCount[p] = 0);
    let desfechosCount = { 'CONCLUIDA': 0, 'PENDENTE': 0, 'MALOGRADA': 0 };
    let totalMinutosPausaPeriodo = 0, qtdAtividadesComPausa = 0;

    const basePausas = (Array.isArray(todosFiltrados) && todosFiltrados.length > 0) ? todosFiltrados : dados;
    basePausas.forEach(item => {
        const pMin = Number(item.tempoPausadoMinutos) || 0;
        if (pMin > 0 || item.desfecho === 'PARALISADA') { totalMinutosPausaPeriodo += pMin; qtdAtividadesComPausa++; }
    });

    const elTempoParalisado = document.getElementById('ind-tempo-paralisado');
    const elDetalheParalisado = document.getElementById('ind-detalhe-paralisado');
    if (elTempoParalisado) elTempoParalisado.innerText = totalMinutosPausaPeriodo > 0 ? formatarDuracaoTexto(totalMinutosPausaPeriodo) : "0 min";
    if (elDetalheParalisado) elDetalheParalisado.innerText = `${qtdAtividadesComPausa} atividade(s) com pausa`;

    let listaMinutosEntrada = [], listaMinutosSaida = [], listaDuracoes = [];
    let aberturasPorHora = new Array(24).fill(0), fechamentosPorHora = new Array(24).fill(0);
    let duracaoPorProjeto = {};
    TODOS_OS_PROJETOS.forEach(k => duracaoPorProjeto[k] = []);

    dados.forEach(d => {
        projetosCount[d.projeto] = (projetosCount[d.projeto] || 0) + 1;
        if (desfechosCount[d.desfecho] !== undefined) desfechosCount[d.desfecho]++;

        const minIn = converterHorarioParaMinutos(d.hEntrada);
        const minOut = converterHorarioParaMinutos(d.hSaida);
        const pausaItem = Number(d.tempoPausadoMinutos) || 0;

        if (minIn !== null) {
            listaMinutosEntrada.push(minIn);
            const horaIn = Math.floor(minIn / 60);
            if (horaIn >= 0 && horaIn < 24) aberturasPorHora[horaIn]++;
        }
        if (minOut !== null) {
            listaMinutosSaida.push(minOut);
            const horaOut = Math.floor(minOut / 60);
            if (horaOut >= 0 && horaOut < 24) fechamentosPorHora[horaOut]++;
        }
        if (minIn !== null && minOut !== null && minOut >= minIn) {
            const durLiquida = Math.max(0, (minOut - minIn) - pausaItem);
            if (durLiquida > 0 && durLiquida <= 840) {
                listaDuracoes.push(durLiquida);
                if (!duracaoPorProjeto[d.projeto]) duracaoPorProjeto[d.projeto] = [];
                duracaoPorProjeto[d.projeto].push(durLiquida);
            }
        }
    });

    if (listaMinutosEntrada.length > 0) {
        const mediaIn = listaMinutosEntrada.reduce((a, b) => a + b, 0) / listaMinutosEntrada.length;
        document.getElementById('ind-media-abertura').innerText = formatarMinutosParaHHMM(mediaIn);
        document.getElementById('ind-detalhe-abertura').innerText = `Primeiro check-in às ${formatarMinutosParaHHMM(Math.min(...listaMinutosEntrada))}`;
    } else {
        document.getElementById('ind-media-abertura').innerText = "--:--";
        document.getElementById('ind-detalhe-abertura').innerText = "Sem dados no período";
    }

    if (listaMinutosSaida.length > 0) {
        const mediaOut = listaMinutosSaida.reduce((a, b) => a + b, 0) / listaMinutosSaida.length;
        document.getElementById('ind-media-fechamento').innerText = formatarMinutosParaHHMM(mediaOut);
        document.getElementById('ind-detalhe-fechamento').innerText = `Último check-out às ${formatarMinutosParaHHMM(Math.max(...listaMinutosSaida))}`;
    } else {
        document.getElementById('ind-media-fechamento').innerText = "--:--";
        document.getElementById('ind-detalhe-fechamento').innerText = "Sem dados no período";
    }

    if (listaDuracoes.length > 0) {
        const mediaDur = listaDuracoes.reduce((a, b) => a + b, 0) / listaDuracoes.length;
        document.getElementById('ind-tempo-medio').innerText = formatarDuracaoTexto(mediaDur);
        document.getElementById('ind-detalhe-tma').innerText = `Mín: ${formatarDuracaoTexto(Math.min(...listaDuracoes))} | Máx: ${formatarDuracaoTexto(Math.max(...listaDuracoes))}`;
    } else {
        document.getElementById('ind-tempo-medio').innerText = "--h --m";
        document.getElementById('ind-detalhe-tma').innerText = "Aguardando durações válidas";
    }

    let maxAtivHora = 0, horaPico = null;
    for (let h = 0; h < 24; h++) { if (aberturasPorHora[h] > maxAtivHora) { maxAtivHora = aberturasPorHora[h]; horaPico = h; } }
    if (horaPico !== null && maxAtivHora > 0) {
        document.getElementById('ind-horario-pico').innerText = `${String(horaPico).padStart(2, '0')}h às ${String(horaPico + 1).padStart(2, '0')}h`;
        document.getElementById('ind-detalhe-pico').innerText = `${maxAtivHora} atividade(s) iniciada(s) na faixa`;
    } else {
        document.getElementById('ind-horario-pico').innerText = "--:--";
        document.getElementById('ind-detalhe-pico').innerText = "Sem picos registrados";
    }

    const ctxProj = document.getElementById('graficoProjetos')?.getContext('2d');
    if (ctxProj) {
        if (graficoProjetosInstancia) graficoProjetosInstancia.destroy();
        const labelsP = Object.keys(projetosCount);
        graficoProjetosInstancia = new Chart(ctxProj, {
            type: 'bar',
            data: {
                labels: labelsP,
                datasets: [
                    { label: '🟢 Executado', data: labelsP.map(p => dados.filter(d => d.projeto === p && d.desfecho === 'CONCLUIDA').length), backgroundColor: '#059669', borderRadius: 5 },
                    { label: '🟠 Não Executado', data: labelsP.map(p => dados.filter(d => d.projeto === p && d.desfecho !== 'CONCLUIDA').length), backgroundColor: '#f59e0b', borderRadius: 5 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, onClick: (event, elements) => { if (elements.length > 0) dispararExplosaoGrafico('projeto', labelsP[elements[0].index]); } }
        });
    }

    const ctxDesf = document.getElementById('graficoDesfechos')?.getContext('2d');
    if (ctxDesf) {
        if (graficoDesfechosInstancia) graficoDesfechosInstancia.destroy();
        graficoDesfechosInstancia = new Chart(ctxDesf, {
            type: 'doughnut',
            data: {
                labels: ['EXECUTADO (Concluída)', 'N EXECUTADO (Pendente)', 'N EXECUTADO (Malograda)'],
                datasets: [{ data: [desfechosCount['CONCLUIDA'], desfechosCount['PENDENTE'], desfechosCount['MALOGRADA']], backgroundColor: ['#059669', '#d97706', '#dc2626'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, onClick: (event, elements) => { if (elements.length > 0) dispararExplosaoGrafico('desfecho', ['CONCLUIDA', 'PENDENTE', 'MALOGRADA'][elements[0].index]); } }
        });
    }

    // GRÁFICO DE HORÁRIOS DE PICO (MANTIDO 100% INALTERADO CONFORME SOLICITADO)
    const ctxHoras = document.getElementById('graficoHorasPico')?.getContext('2d');
    if (ctxHoras) {
        if (graficoHorasPicoInstancia) graficoHorasPicoInstancia.destroy();
        const labelsHoras = [], dadosAberturaSlice = [], dadosFechamentoSlice = [];
        for (let h = 6; h <= 20; h++) {
            labelsHoras.push(`${String(h).padStart(2, '0')}h`);
            dadosAberturaSlice.push(aberturasPorHora[h]);
            dadosFechamentoSlice.push(fechamentosPorHora[h]);
        }
        graficoHorasPicoInstancia = new Chart(ctxHoras, {
            type: 'line',
            data: {
                labels: labelsHoras,
                datasets: [
                    { label: '🟢 Aberturas (Check-in)', data: dadosAberturaSlice, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.15)', fill: true, tension: 0.35 },
                    { label: '🔴 Fechamentos (Check-out)', data: dadosFechamentoSlice, borderColor: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.12)', fill: true, tension: 0.35 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
    }

    const ctxTempoProj = document.getElementById('graficoTempoProjeto')?.getContext('2d');
    if (ctxTempoProj) {
        if (graficoTempoProjetoInstancia) graficoTempoProjetoInstancia.destroy();
        const labelsProj = Object.keys(projetosCount);
        const mediasMinutosProj = labelsProj.map(proj => {
            const arr = duracaoPorProjeto[proj] || [];
            return arr.length === 0 ? 0 : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
        });
        graficoTempoProjetoInstancia = new Chart(ctxTempoProj, {
            type: 'bar',
            data: { labels: labelsProj, datasets: [{ label: 'Tempo Médio Líquido (Minutos)', data: mediasMinutosProj, backgroundColor: '#0d9488', borderRadius: 6 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
        });
    }
}

function exportarExcel() {
    const listaParaExportar = enriquecerStatusMacroEBairro((dadosFiltradosAtuais.length > 0 || listaImprevistosAtuais.length > 0) ? [...dadosFiltradosAtuais, ...listaImprevistosAtuais] : registrosSalvos);
    if (listaParaExportar.length === 0) { alert("Nenhum registro para exportar no filtro atual."); return; }

    let colunas = ["ID", "Semana", "Data", "Equipe", "Setor", "Serviço", "Projeto", "Macrogrupo", "Imóvel / Bloco", "Bairro", "Endereço do Atendimento", "Status Macro (Programado/Retorno)", "Liberou o Acesso", "Hora Entrada", "Hora Saída", "Tempo Paralisado (min)", "Duração Líquida", "GPS Entrada", "GPS Saída", "Status Planilha", "Desfecho", "Qtd Fotos", "Serviço Obra", "STATUS1 (Opções Marcadas)", "Motivo Desfecho", "Responsável", "Contato", "E-mail", "Andares", "HPs", "Fusões", "Conectores", "Cabo RL (m)", "Cabo Drop (m)", "NAP", "DIO", "Cx Sobrepor", "Cx Embutida", "Cx FOSC", "Observações Gerais"];
    let linhas = listaParaExportar.map(r => {
        const minIn = converterHorarioParaMinutos(r.hEntrada);
        const minOut = converterHorarioParaMinutos(r.hSaida);
        const pausaMin = Number(r.tempoPausadoMinutos) || 0;
        const durStr = (minIn !== null && minOut !== null && minOut >= minIn) ? formatarDuracaoTexto(Math.max(0, (minOut - minIn) - pausaMin)) : "-";
        const eqObj = equipesSistema.find(e => e.nome === r.equipe);
        return [
            r.id || "", r.semanaPlanilha || obterSemanaDoMes(r.dataRegistro), r.dataRegistro || "", r.equipe || "",
            eqObj ? eqObj.setor : "Instalador", r.servicoPlanilha || obterMacroServicoPlanilha(r.projeto), r.projeto || "",
            obterMacroGrupoProjeto(r.projeto), r.imovel || "", r.bairroPlanilha || extrairBairroDoEndereco(r.endereco),
            r.endereco || "", r.statusMacroPlanilha || "PROGRAMADO", r.liberouAcesso || "",
            r.hEntrada || "", r.hSaida || "", pausaMin, durStr, r.gpsEntrada || "", r.gpsSaida || "",
            r.desfecho === 'CONCLUIDA' ? 'EXECUTADO' : 'N EXECUTADO', r.desfecho || "",
            Number(r.qtdFotos) || (r.fotos ? r.fotos.length : 0), r.servicoObra || "SIM",
            r.malogros ? r.malogros.join(' + ') : "", r.motivoDesfecho || "", r.responsavel || "", r.contato || "",
            r.email || "", r.andares !== "" ? r.andares : 0, r.hps !== "" ? r.hps : 0, r.fusoes !== "" ? r.fusoes : 0,
            r.conectores !== "" ? r.conectores : 0, r.caboRL !== "" ? r.caboRL : 0, r.caboDrop !== "" ? r.caboDrop : 0,
            r.nap !== "" ? r.nap : 0, r.dio !== "" ? r.dio : 0, r.cxSobrepor !== "" ? r.cxSobrepor : 0,
            r.cxEmbutida !== "" ? r.cxEmbutida : 0, r.cxFosc !== "" ? r.cxFosc : 0, r.observacoes || ""
        ];
    });

    let tabelaHTML = `<table border="1"><thead><tr>${colunas.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map(cel => `<td>${cel}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    let blob = new Blob(['\ufeff' + tabelaHTML], { type: 'application/vnd.ms-excel' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url; a.download = `relatorio_gpd_procisa_${obterDataLocalISO()}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    registrarLogAuditoria("EXPORTAÇÃO DE RELATÓRIO", `Baixado relatório Excel com ${listaParaExportar.length} registros filtrados.`);
}

function exportarExcelFinanceiro() {
    if (!totaisFinanceirosAtuais) { alert("Atualize os dados antes de exportar a medição."); return; }
    let itensMedicao = [
        { chave: "VISTORIA", qtd: totaisFinanceirosAtuais.vistorias }, { chave: "CABO RL", qtd: totaisFinanceirosAtuais.caboRL },
        { chave: "CONECTORES", qtd: totaisFinanceirosAtuais.conectores }, { chave: "FUSÕES", qtd: totaisFinanceirosAtuais.fusoes },
        { chave: "CABO DROP", qtd: totaisFinanceirosAtuais.caboDrop }, { chave: "NAP", qtd: totaisFinanceirosAtuais.nap },
        { chave: "DIO", qtd: totaisFinanceirosAtuais.dio }, { chave: "CX SOBREPOR", qtd: totaisFinanceirosAtuais.cxSobrepor },
        { chave: "CX EMBUTIDA", qtd: totaisFinanceirosAtuais.cxEmbutida }
    ];
    let valorGeral = 0;
    let tabelaHTML = `<table border="1"><thead><tr><th>Código</th><th>Descrição do Item</th><th>Unidade</th><th>Qtd. Produzida</th><th>Valor Unitário (R$)</th><th>Total (R$)</th></tr></thead><tbody>`;
    itensMedicao.forEach(item => {
        let cfg = TABELA_PRECOS[item.chave];
        let totalItem = item.qtd * cfg.valor;
        valorGeral += totalItem;
        tabelaHTML += `<tr><td>${cfg.codigo}</td><td>${cfg.desc}</td><td>${cfg.unidade}</td><td>${item.qtd}</td><td>R$ ${cfg.valor.toFixed(2).replace('.', ',')}</td><td>R$ ${totalItem.toFixed(2).replace('.', ',')}</td></tr>`;
    });
    tabelaHTML += `<tr><td colspan="5"><b>VALOR TOTAL DA MEDIÇÃO</b></td><td><b>R$ ${valorGeral.toFixed(2).replace('.', ',')}</b></td></tr></tbody></table>`;

    let blob = new Blob(['\ufeff' + tabelaHTML], { type: 'application/vnd.ms-excel' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url; a.download = `medicao_financeira_mdu_${obterDataLocalISO()}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    registrarLogAuditoria("EXPORTAÇÃO FINANCEIRA", `Baixada planilha de Medição Financeira (Total: R$ ${valorGeral.toFixed(2)}).`);
}

function alternarChaveSetorEquipe(setorEscolhido) {
    let inputHidden = document.getElementById('inp-setor-equipe');
    let atuais = obterArraySetores(inputHidden.value);
    if (atuais.includes(setorEscolhido)) {
        if (atuais.length > 1) atuais = atuais.filter(s => s !== setorEscolhido);
        else { alert("⚠️ O técnico precisa pertencer a pelo menos um grupo de atuação."); return; }
    } else atuais.push(setorEscolhido);

    inputHidden.value = formatarSetoresString(atuais);
    const aplicarEstilo = (btn, ativo, corBg) => {
        if (!btn) return;
        btn.className = ativo ? `py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 ${corBg} text-white shadow-sm` : "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 text-slate-600 hover:bg-slate-200 bg-slate-100";
    };
    aplicarEstilo(document.getElementById('btn-chave-vistoriador'), atuais.includes('Vistoriador'), 'bg-purple-800');
    aplicarEstilo(document.getElementById('btn-chave-instalador'), atuais.includes('Instalador'), 'bg-blue-900');
    aplicarEstilo(document.getElementById('btn-chave-ativador'), atuais.includes('Ativador'), 'bg-emerald-700');
}

function abrirModalEquipe(id = null) {
    if (nivelUsuarioLogado === 'Visualizador') { alert("⚠️ Permissão insuficiente."); return; }
    document.getElementById('modal-equipe').classList.remove('hidden');
    if (id) {
        document.getElementById('modal-equipe-titulo').innerText = "Editar Equipe / Setor(es)";
        let eq = equipesSistema.find(e => e.id === id);
        if (eq) {
            document.getElementById('edit-equipe-id').value = eq.id;
            document.getElementById('inp-nome-equipe').value = eq.nome;
            document.getElementById('sel-status-equipe').value = eq.status;
            document.getElementById('inp-setor-equipe').value = formatarSetoresString(eq.setor);
            const setoresAtuais = obterArraySetores(eq.setor);
            const btnVist = document.getElementById('btn-chave-vistoriador');
            const btnInst = document.getElementById('btn-chave-instalador');
            const btnAtiv = document.getElementById('btn-chave-ativador');
            if (btnVist) btnVist.className = setoresAtuais.includes('Vistoriador') ? "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 bg-purple-800 text-white shadow-sm" : "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 text-slate-600 bg-slate-100";
            if (btnInst) btnInst.className = setoresAtuais.includes('Instalador') ? "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 bg-blue-900 text-white shadow-sm" : "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 text-slate-600 bg-slate-100";
            if (btnAtiv) btnAtiv.className = setoresAtuais.includes('Ativador') ? "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 bg-emerald-700 text-white shadow-sm" : "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 text-slate-600 bg-slate-100";
        }
    } else {
        document.getElementById('modal-equipe-titulo').innerText = "Cadastrar Nova Equipe";
        document.getElementById('edit-equipe-id').value = "";
        document.getElementById('inp-nome-equipe').value = "";
        document.getElementById('sel-status-equipe').value = "Ativo";
        document.getElementById('inp-setor-equipe').value = "Instalador";
    }
}

function fecharModalEquipe() { document.getElementById('modal-equipe').classList.add('hidden'); }

async function salvarOuAtualizarEquipe() {
    if (nivelUsuarioLogado === 'Visualizador') return;
    const editId = document.getElementById('edit-equipe-id').value;
    const nome = document.getElementById('inp-nome-equipe').value.trim().toUpperCase();
    const setor = formatarSetoresString(document.getElementById('inp-setor-equipe').value || "Instalador");
    const status = document.getElementById('sel-status-equipe').value;
    if (!nome) { alert("Preencha o nome da equipe ou técnico."); return; }

    if (editId) {
        let eq = equipesSistema.find(e => e.id == editId);
        if (eq) {
            registrarLogAuditoria("EDIÇÃO DE EQUIPE", `Equipe ${eq.nome} atualizada: ${nome} | Setor(es): ${setor} (${status})`);
            eq.nome = nome; eq.setor = setor; eq.status = status; if (!eq.pin) eq.pin = "1234";
        }
    } else {
        registrarLogAuditoria("CADASTRO DE EQUIPE", `Nova equipe cadastrada: ${nome} | Setor(es): ${setor}`);
        equipesSistema.push({ id: Date.now(), nome, setor, status, pin: "1234" });
    }
    await sincronizarEquipesNaNuvem();
    fecharModalEquipe();
    popularSelectEquipes();
    renderizarTabelaEquipes();
    renderizarPainelDisponibilidade();
    alert("☁️ Equipe salva e sincronizada na nuvem!");
}

async function alternarSetorDiretoNaTabela(idEquipe, setorAlvo) {
    if (nivelUsuarioLogado === 'Visualizador') { alert("⚠️ Permissão insuficiente."); return; }
    const eq = equipesSistema.find(e => e.id === idEquipe);
    if (!eq) return;
    let setoresAtuais = obterArraySetores(eq.setor);
    if (setoresAtuais.includes(setorAlvo)) {
        if (setoresAtuais.length > 1) setoresAtuais = setoresAtuais.filter(s => s !== setorAlvo);
        else { alert("⚠️ O técnico precisa pertencer a pelo menos um grupo de atuação."); return; }
    } else setoresAtuais.push(setorAlvo);

    eq.setor = formatarSetoresString(setoresAtuais);
    registrarLogAuditoria("ALTERAÇÃO DE SETOR", `Técnico ${eq.nome} atualizado para: ${eq.setor}`);
    await sincronizarEquipesNaNuvem();
    popularSelectEquipes();
    renderizarTabelaEquipes();
    renderizarPainelDisponibilidade();
}

function renderizarTabelaEquipes() {
    const corpo = document.getElementById('tabela-equipes-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";
    equipesSistema.forEach(eq => {
        const setoresAtuais = obterArraySetores(eq.setor);
        const pinAtual = obterPinDaEquipe(eq);
        const chaveSetorHtml = `<div class="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-300 gap-1"><button onclick="alternarSetorDiretoNaTabela(${eq.id}, 'Vistoriador')" class="px-2 py-1 rounded-md text-[10px] font-bold transition ${setoresAtuais.includes('Vistoriador') ? 'bg-purple-800 text-white shadow-sm' : 'text-slate-500 bg-white'}">🔍 Vistoriador</button><button onclick="alternarSetorDiretoNaTabela(${eq.id}, 'Instalador')" class="px-2 py-1 rounded-md text-[10px] font-bold transition ${setoresAtuais.includes('Instalador') ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-500 bg-white'}">🛠️ Instalador</button><button onclick="alternarSetorDiretoNaTabela(${eq.id}, 'Ativador')" class="px-2 py-1 rounded-md text-[10px] font-bold transition ${setoresAtuais.includes('Ativador') ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-500 bg-white'}">⚡ Ativador</button></div>`;
        const projsHabilitados = obterProjetosPermitidosParaSetores(setoresAtuais).map(p => `<span class="bg-slate-100 border border-slate-300 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded">${p}</span>`).join(' ');
        const badgePin = (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador') ? `<div class="mt-1"><span class="bg-amber-50 text-amber-900 border border-amber-300 font-mono font-bold text-[10px] px-2 py-0.5 rounded">🔑 PIN: ${pinAtual}</span></div>` : '';
        let acoesEq = (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador')
            ? `<button onclick="resetarPinEquipeGestor(${eq.id})" class="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-[10px] px-2.5 py-1 rounded">🔄 Resetar PIN</button> <button onclick="abrirModalEquipe(${eq.id})" class="bg-blue-50 text-blue-700 font-bold text-[10px] px-2.5 py-1 rounded">✏️ Editar</button>`
            : `<span class="text-slate-400 text-[10px]">Somente Leitura</span>`;
        if (nivelUsuarioLogado === 'Master') acoesEq += ` <button onclick="excluirEquipe(${eq.id}, '${eq.nome}')" class="bg-red-50 text-red-600 font-bold text-[10px] px-2.5 py-1 rounded">🗑️ Excluir</button>`;

        corpo.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="p-3"><div class="font-bold text-slate-800">${eq.nome}</div>${badgePin}</td><td class="p-3">${chaveSetorHtml}</td><td class="p-3"><div class="flex flex-wrap gap-1">${projsHabilitados}</div></td><td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${eq.status === 'Ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">${eq.status}</span></td><td class="p-3 space-x-1 whitespace-nowrap">${acoesEq}</td></tr>`;
    });
}

async function excluirEquipe(id, nome) {
    if (nivelUsuarioLogado !== 'Master') { alert("⚠️ Apenas usuários Master podem excluir equipes."); return; }
    if (confirm(`Deseja realmente excluir a equipe ${nome} do sistema?`)) {
        registrarLogAuditoria("EXCLUSÃO DE EQUIPE", `Equipe removida: ${nome}`);
        equipesSistema = equipesSistema.filter(e => e.id !== id);
        await sincronizarEquipesNaNuvem();
        popularSelectEquipes();
        renderizarTabelaEquipes();
    }
}

function abrirModalUsuario(id = null) {
    if (nivelUsuarioLogado === 'Visualizador' && id) {
        let uSelf = usuariosSistema.find(u => u.email.toLowerCase() === usuarioLogado.toLowerCase());
        if (uSelf) id = uSelf.id;
    }
    document.getElementById('modal-usuario').classList.remove('hidden');
    if (id) {
        let u = usuariosSistema.find(user => user.id === id);
        if (u) {
            document.getElementById('edit-user-id').value = u.id;
            document.getElementById('novo-user-nome').value = u.nome;
            document.getElementById('novo-user-email').value = u.email;
            document.getElementById('novo-user-senha').value = u.senha;
            document.getElementById('novo-user-nivel').value = u.nivel;
            const desab = nivelUsuarioLogado !== 'Master';
            document.getElementById('novo-user-nome').disabled = desab;
            document.getElementById('novo-user-email').disabled = desab;
            document.getElementById('novo-user-nivel').disabled = desab;
        }
    } else {
        if (nivelUsuarioLogado !== 'Master') { alert("⚠️ Apenas usuários Master podem cadastrar novos usuários."); fecharModalUsuario(); return; }
        document.getElementById('edit-user-id').value = "";
        document.getElementById('novo-user-nome').value = "";
        document.getElementById('novo-user-email').value = "";
        document.getElementById('novo-user-senha').value = "";
        document.getElementById('novo-user-nivel').value = "Visualizador";
        document.getElementById('novo-user-nome').disabled = false;
        document.getElementById('novo-user-email').disabled = false;
        document.getElementById('novo-user-nivel').disabled = false;
    }
}

function fecharModalUsuario() { document.getElementById('modal-usuario').classList.add('hidden'); }

async function salvarOuAtualizarUsuario() {
    const editId = document.getElementById('edit-user-id').value;
    const nome = document.getElementById('novo-user-nome').value.trim();
    const email = document.getElementById('novo-user-email').value.trim().toLowerCase();
    const senha = document.getElementById('novo-user-senha').value.trim();
    const nivel = document.getElementById('novo-user-nivel').value;
    if (!nome || !email || !senha) { alert("Preencha todos os campos."); return; }

    if (editId) {
        let u = usuariosSistema.find(user => user.id == editId);
        if (u) {
            registrarLogAuditoria("EDIÇÃO DE USUÁRIO", `Dados/senha atualizados para: ${email}`);
            if (nivelUsuarioLogado === 'Master') { u.nome = nome; u.email = email; u.senha = senha; u.nivel = nivel; }
            else u.senha = senha;
        }
    } else {
        if (nivelUsuarioLogado !== 'Master') { alert("Acesso negado."); return; }
        let jaExiste = usuariosSistema.find(u => u.email.toLowerCase() === email);
        if (jaExiste) { jaExiste.nome = nome; jaExiste.senha = senha; jaExiste.nivel = nivel; jaExiste.status = "Ativo"; }
        else usuariosSistema.push({ id: Date.now(), nome, email, senha, nivel, status: "Ativo" });
        registrarLogAuditoria("NOVO USUÁRIO", `Cadastrado novo usuário na nuvem: ${email} (${nivel})`);
    }
    await sincronizarUsuariosNaNuvem();
    fecharModalUsuario();
    renderizarTabelaUsuariosPermissao();
    alert("☁️ Usuário salvo e sincronizado na nuvem!");
}

async function excluirUsuario(id, email) {
    if (nivelUsuarioLogado !== 'Master') { alert("⚠️ Apenas usuários Master podem excluir usuários."); return; }
    if (email.toLowerCase() === "lsimoes@procisa.com.br") { alert("⚠️ O usuário Master principal não pode ser removido."); return; }
    if (confirm(`Deseja realmente remover o acesso de ${email}?`)) {
        registrarLogAuditoria("EXCLUSÃO DE USUÁRIO", `Removido usuário: ${email}`);
        usuariosSistema = usuariosSistema.filter(u => u.id !== id);
        await sincronizarUsuariosNaNuvem();
        renderizarTabelaUsuariosPermissao();
    }
}

async function renderizarTabelaAuditoria() {
    renderizarPainelCapacidadeNuvem();
    await carregarAuditoriaDaNuvem();
    const corpo = document.getElementById('tabela-auditoria-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";
    const emailsGestores = new Set((usuariosSistema || []).map(u => (u.email || '').toLowerCase()));
    const logsSomenteGestao = (trilhaAuditoria || []).filter(log => {
        const usr = (log.usuario || '').toLowerCase();
        return usr.includes('@') || emailsGestores.has(usr);
    });

    if (logsSomenteGestao.length === 0) {
        corpo.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">Nenhum registo de auditoria do Modo Gestão encontrado.</td></tr>`;
        return;
    }
    logsSomenteGestao.forEach(log => {
        const destaque = log.acao.includes("REABERTURA") || log.acao.includes("IMPORTAÇÃO") || log.acao.includes("PIN") || log.acao.includes("TRANSFERÊNCIA") || log.acao.includes("EDIÇÃO") || log.acao.includes("BACKUP") || log.acao.includes("EXPURGO") || log.acao.includes("TRATADO")
            ? "bg-purple-100 text-purple-900 border border-purple-300" : "bg-slate-100 text-slate-800";
        corpo.innerHTML += `<tr class="hover:bg-slate-50 border-b text-xs"><td class="p-3 font-mono text-slate-500">${log.dataHora}</td><td class="p-3 font-bold text-blue-900">${log.usuario}</td><td class="p-3"><span class="${destaque} font-bold px-2 py-0.5 rounded text-[10px]">${log.acao}</span></td><td class="p-3 text-slate-600">${log.detalhes}</td></tr>`;
    });
}

async function limparLogsAuditoria() {
    if (nivelUsuarioLogado !== 'Master') { alert("⚠️ Apenas usuários Master podem limpar os logs."); return; }
    if (confirm("Deseja limpar o histórico de logs de auditoria em todos os dispositivos?")) {
        trilhaAuditoria = [];
        localStorage.removeItem('gpd_trilha_auditoria');
        await sincronizarAuditoriaNaNuvem();
        renderizarTabelaAuditoria();
    }
}

function mudarSubAbaGestor(aba) {
    inicializarMelhoriasVisuaisGestor();
    if (nivelUsuarioLogado === 'Visualizador' && !['atividades', 'graficos', 'materiais'].includes(aba)) {
        alert("⚠️ Seu perfil (Visualizador) possui acesso restrito às abas: Atividades, Gráficos & Produtividade e Materiais.");
        return;
    }

    const subs = ['atividades', 'disponibilidade', 'mapa', 'combustivel', 'solicitacao_material', 'graficos', 'imprevistos', 'materiais', 'financeiro', 'equipes', 'opcoes', 'usuarios', 'bonificacao', 'auditoria'];
    subs.forEach(s => {
        const el = document.getElementById(`subview-${s}`);
        const btn = document.getElementById(`subtab-btn-${s}`);
        if (el) el.classList.add('hidden');
        if (btn) {
            const ocultoVisualizador = (nivelUsuarioLogado === 'Visualizador' && !['atividades', 'graficos', 'materiais'].includes(s));
            btn.className = `px-2.5 py-1 text-[11px] font-bold rounded-lg transition bg-white text-slate-700 hover:bg-slate-200 border border-slate-200 flex items-center gap-1 ${ocultoVisualizador ? 'hidden' : ''}`;
        }
    });

    const targetView = document.getElementById(`subview-${aba}`);
    const targetBtn = document.getElementById(`subtab-btn-${aba}`);
    if (targetView) targetView.classList.remove('hidden');
    if (targetBtn) targetBtn.className = "px-2.5 py-1 text-[11px] font-bold rounded-lg transition bg-blue-900 text-white shadow-sm flex items-center gap-1";

    const divBotoesDisp = document.getElementById('botoes-atalho-exclusivos-disponibilidade');
    if (divBotoesDisp) {
        if (aba === 'disponibilidade') divBotoesDisp.classList.remove('hidden');
        else divBotoesDisp.classList.add('hidden');
    }

    const boxBackupMaster = document.getElementById('central-master-backup-nuvem');
    if (boxBackupMaster) {
        if (nivelUsuarioLogado === 'Master') boxBackupMaster.classList.remove('hidden');
        else boxBackupMaster.classList.add('hidden');
    }

    if (aba === 'usuarios') renderizarTabelaUsuariosPermissao();
    if (aba === 'equipes') renderizarTabelaEquipes();
    if (aba === 'opcoes') { renderizarPainelOpcoesSistema(); atualizarEstimativaPesoNuvem(); }
    if (aba === 'auditoria') renderizarTabelaAuditoria();
    if (aba === 'disponibilidade') renderizarPainelDisponibilidade();
    if (aba === 'combustivel' || aba === 'solicitacao_material') atualizarDashboardGestor();
    if (aba === 'mapa') {
        renderizarPainelDisponibilidade();
        setTimeout(() => {
            if (mapaRastreioInstancia) {
                mapaRastreioInstancia.invalidateSize();
                if (coordenadasPinosAtuais.length > 0) {
                    mapaRastreioInstancia.fitBounds(L.latLngBounds(coordenadasPinosAtuais), { padding: [45, 45], maxZoom: 16 });
                }
            }
        }, 220);
    }
    if (['graficos', 'bonificacao', 'financeiro', 'materiais', 'atividades', 'imprevistos'].includes(aba)) atualizarDashboardGestor();
}

function aplicarAtalhoPeriodo(tipo) {
    const inpInicio = document.getElementById('gestor-filtro-data-inicio');
    const inpFim = document.getElementById('gestor-filtro-data-fim');
    const hoje = new Date();

    if (tipo === 'hoje') {
        const strHoje = obterDataLocalISO(hoje);
        inpInicio.value = strHoje; inpFim.value = strHoje;
    } else if (tipo === 'ontem') {
        const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
        const strOntem = obterDataLocalISO(ontem);
        inpInicio.value = strOntem; inpFim.value = strOntem;
    } else if (tipo === '7dias') {
        const seteDiasAtras = new Date(hoje); seteDiasAtras.setDate(hoje.getDate() - 6);
        inpInicio.value = obterDataLocalISO(seteDiasAtras); inpFim.value = obterDataLocalISO(hoje);
    } else if (tipo === 'mes') {
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        inpInicio.value = obterDataLocalISO(primeiroDiaMes); inpFim.value = obterDataLocalISO(hoje);
    } else if (tipo === 'tudo') {
        inpInicio.value = ''; inpFim.value = '';
    }
    atualizarDashboardGestor();
}
