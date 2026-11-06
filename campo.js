// ================= CAMPO.JS - MODO CAMPO BLINDADO CONTRA QUEDA DE ROTA E PERDA DE ABERTURA =================
let watchIdRastreioGps = null;
let timerEnvioRastreioGps = null;
let wakeLockAtivo = null;
let ultimaCoordRastreioCache = null;
let encerrandoExpedienteEmCurso = false;
let ultimoDisparoGpsCampoTs = 0;
let parceiroApoioPreSelecionadoSuporte = "";

let fotosSolicCombustivelTemp = {
    painel: null,
    mapa: null,
    cartao: null
};

function garantirOpcaoRedeGponNaoConstruida() {
    if (typeof OPCOES_CONCLUIDA_PADRAO !== 'undefined' && Array.isArray(OPCOES_CONCLUIDA_PADRAO)) {
        if (!OPCOES_CONCLUIDA_PADRAO.includes("REDE GPON NÃO CONSTRUÍDA")) {
            OPCOES_CONCLUIDA_PADRAO.push("REDE GPON NÃO CONSTRUÍDA");
        }
    }
}
garantirOpcaoRedeGponNaoConstruida();

function forcarInputsFotoApenasGaleria() {
    try {
        garantirOpcaoRedeGponNaoConstruida();
        const inputsFoto = document.querySelectorAll('input[type="file"]');
        inputsFoto.forEach(inp => {
            const acc = (inp.getAttribute('accept') || '').toLowerCase();
            if (acc.includes('image') || acc.includes('.jpg') || inp.id.includes('foto') || inp.id.includes('comb')) {
                inp.removeAttribute('capture');
                inp.setAttribute('accept', '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp');
            }
        });
    } catch (e) {}
}

setInterval(forcarInputsFotoApenasGaleria, 1500);

async function ativarWakeLockTela() {
    try {
        if ('wakeLock' in navigator && !wakeLockAtivo) {
            wakeLockAtivo = await navigator.wakeLock.request('screen');
            wakeLockAtivo.addEventListener('release', () => {
                wakeLockAtivo = null;
            });
        }
    } catch (e) {}
}

function liberarWakeLockTela() {
    try {
        if (wakeLockAtivo) {
            wakeLockAtivo.release();
            wakeLockAtivo = null;
        }
    } catch (e) {}
}

document.addEventListener('visibilitychange', () => {
    const nomeEq = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao;
    const hojeISO = obterDataLocalISO();
    const dadosTel = (nomeEq && typeof telemetriaEquipes !== 'undefined') ? telemetriaEquipes[nomeEq] : null;
    if (document.visibilityState === 'visible' && dadosTel && dadosTel.data === hojeISO && dadosTel.statusTurno === 'DISPONIVEL') {
        ativarWakeLockTela();
        capturarEEnviarPosicaoRastreio(nomeEq, false);
    }
});

// ================= SOLICITAÇÃO DE COMBUSTÍVEL E MATERIAL =================
function validarTecnicoSelecionadoParaSolicitacao() {
    const selEq = document.getElementById('sel-equipe');
    const nomeEq = selEq?.value || equipeAutenticadaSessao || "";
    if (!nomeEq || equipeAutenticadaSessao !== nomeEq) {
        alert("⚠️ Selecione primeiro o seu nome em 'Equipe / Técnico' e digite seu PIN de 4 dígitos para acessar esta opção.");
        if (selEq) selEq.focus();
        return null;
    }
    return nomeEq;
}

function abrirModalSolicitacaoCombustivelCampo() {
    const nomeEq = validarTecnicoSelecionadoParaSolicitacao();
    if (!nomeEq) return;

    forcarInputsFotoApenasGaleria();

    document.getElementById('lbl-tec-solic-comb').innerText = nomeEq;
    document.getElementById('inp-comb-placa').value = localStorage.getItem(`gpd_ultima_placa_${nomeEq}`) || "";
    document.getElementById('inp-comb-km').value = "";
    document.getElementById('inp-comb-motivo').value = "";

    const selSug = document.getElementById('sel-comb-motivo-sugerido');
    if (selSug) {
        const opcoes = (typeof OPCOES_COMBUSTIVEL_PADRAO !== 'undefined' && Array.isArray(OPCOES_COMBUSTIVEL_PADRAO))
            ? OPCOES_COMBUSTIVEL_PADRAO
            : [];
        selSug.innerHTML = `<option value="">Selecione um motivo rápido (opcional) ou digite abaixo...</option>` +
            opcoes.map(op => `<option value="${op}">⛽ ${op}</option>`).join('');
    }

    fotosSolicCombustivelTemp = { painel: null, mapa: null, cartao: null };
    atualizarPreviewSlotCombustivel('painel', null, 'Nenhuma foto anexada (Anexar da Galeria)');
    atualizarPreviewSlotCombustivel('mapa', null, 'Nenhuma foto anexada (Anexar da Galeria)');
    atualizarPreviewSlotCombustivel('cartao', null, 'Opcional (Anexar da Galeria)');

    document.getElementById('modal-solic-combustivel').classList.remove('hidden');
}

function fecharModalSolicitacaoCombustivelCampo() {
    document.getElementById('modal-solic-combustivel')?.classList.add('hidden');
}

function aoSelecionarMotivoSugeridoCombustivel(valor) {
    if (valor) document.getElementById('inp-comb-motivo').value = valor;
}

function atualizarPreviewSlotCombustivel(slot, base64, textoPadrao) {
    const imgEl = document.getElementById(`prev-foto-comb-${slot}`);
    const statusEl = document.getElementById(`status-foto-comb-${slot}`);
    if (base64) {
        if (imgEl) { imgEl.src = base64; imgEl.classList.remove('hidden'); }
        if (statusEl) { statusEl.innerText = "✅ Foto anexada da galeria com sucesso"; statusEl.className = "text-[10px] text-emerald-700 font-bold"; }
    } else {
        if (imgEl) { imgEl.src = ""; imgEl.classList.add('hidden'); }
        if (statusEl) { statusEl.innerText = textoPadrao; statusEl.className = "text-[10px] text-slate-500"; }
    }
}

async function processarFotoSlotCombustivel(slot, inputEl) {
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;

    const statusEl = document.getElementById(`status-foto-comb-${slot}`);
    if (statusEl) {
        statusEl.innerText = "⏳ Otimizando foto (economia de memória)...";
        statusEl.className = "text-[10px] text-blue-700 font-bold animate-pulse";
    }

    try {
        const comprimida = await comprimirImagemBase64(file, 720, 0.58);
        fotosSolicCombustivelTemp[slot] = comprimida;
        atualizarPreviewSlotCombustivel(slot, comprimida, "");
    } catch (e) {
        atualizarPreviewSlotCombustivel(slot, null, "Erro ao ler imagem. Escolha da Galeria.");
        alert("⚠️ Não foi possível processar a imagem. Tire a foto primeiro pela câmera normal do celular e selecione-a pela Galeria.");
    }
    inputEl.value = "";
}

async function enviarSolicitacaoCombustivelCampo() {
    const nomeEq = validarTecnicoSelecionadoParaSolicitacao();
    if (!nomeEq) return;

    const placa = (document.getElementById('inp-comb-placa')?.value || "").trim().toUpperCase();
    const km = (document.getElementById('inp-comb-km')?.value || "").trim();
    const motivo = (document.getElementById('inp-comb-motivo')?.value || "").trim() || "Solicitação de recarga em campo";

    if (!placa) { alert("⚠️ Informe obrigatoriamente a PLACA do veículo."); return; }
    if (!km || isNaN(Number(km)) || Number(km) <= 0) { alert("⚠️ Informe obrigatoriamente o KM ATUAL do veículo."); return; }
    if (!fotosSolicCombustivelTemp.painel) { alert("⚠️ A foto do PAINEL DO CARRO é obrigatória."); return; }
    if (!fotosSolicCombustivelTemp.mapa) { alert("⚠️ A foto do MAPA DE BORDO é obrigatória."); return; }

    localStorage.setItem(`gpd_ultima_placa_${nomeEq}`, placa);

    const btn = document.getElementById('btn-enviar-solic-comb');
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Enviando solicitação e fotos..."; }

    let gpsAtual = "Sem GPS no momento";
    try { gpsAtual = await capturarGpsReal(5000); } catch (e) {}

    const fotosArray = [fotosSolicCombustivelTemp.painel, fotosSolicCombustivelTemp.mapa];
    if (fotosSolicCombustivelTemp.cartao) fotosArray.push(fotosSolicCombustivelTemp.cartao);

    const tagsLabelsFotos = fotosSolicCombustivelTemp.cartao
        ? ["PAINEL DO CARRO", "MAPA DE BORDO", "CARTÃO DE COMBUSTÍVEL"]
        : ["PAINEL DO CARRO", "MAPA DE BORDO"];

    const hojeISO = obterDataLocalISO();
    const horaAtual = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    const novoRegDB = {
        id: Date.now(),
        data_registro: hojeISO,
        equipe: nomeEq,
        membros: nomeEq,
        projeto: PROJETO_SOLIC_COMBUSTIVEL,
        imovel: `PLACA: ${placa} | KM: ${km}`,
        h_entrada: horaAtual,
        h_saida: "Pendente",
        gps_entrada: gpsAtual,
        gps_saida: "-",
        desfecho: "AGUARDANDO TRATATIVA",
        motivo_desfecho: motivo,
        malogros: tagsLabelsFotos,
        responsavel: placa,
        contato: String(km),
        email: "",
        agendamento: null,
        andares: Number(km) || 0,
        hps: fotosArray.length,
        servico_obra: "NÃO",
        observacoes: `[END: Placa ${placa} • KM ${km}] ${motivo} [FOTOS:${JSON.stringify(fotosArray)}]`
    };

    try {
        const { error } = await supabaseClient.from('registros_producao').insert([novoRegDB]);
        if (error) throw error;

        if (btn) { btn.disabled = false; btn.innerText = "🚀 Enviar Solicitação de Recarga"; }
        fotosSolicCombustivelTemp = { painel: null, mapa: null, cartao: null };
        fecharModalSolicitacaoCombustivelCampo();
        await carregarRegistrosModoCampoLeve();
        renderizarResumoSolicitacoesCampo();
        alert(`✅ Solicitação de Combustível enviada com sucesso!\n\nPlaca: ${placa} | KM: ${km}`);
    } catch (err) {
        if (btn) { btn.disabled = false; btn.innerText = "🚀 Enviar Solicitação de Recarga"; }
        alert("❌ Erro ao enviar solicitação: " + (err.message || "Verifique sua conexão."));
    }
}

function abrirModalSolicitacaoMaterialCampo() {
    const nomeEq = validarTecnicoSelecionadoParaSolicitacao();
    if (!nomeEq) return;

    document.getElementById('lbl-tec-solic-mat').innerText = nomeEq;
    document.getElementById('inp-obs-solic-material').value = "";

    const container = document.getElementById('lista-itens-solic-material-campo');
    if (container) {
        const catalogoMat = (typeof OPCOES_MATERIAL_SOLICITACAO !== 'undefined' && Array.isArray(OPCOES_MATERIAL_SOLICITACAO) && OPCOES_MATERIAL_SOLICITACAO.length > 0)
            ? OPCOES_MATERIAL_SOLICITACAO
            : ["CABO RL (m)", "CONECTORES (un)", "CABO DROP (m)", "NAP (un)", "DIO (un)", "FUSÕES / TUBETES (un)", "CX. SOBREPOR (un)", "CX. EMBUTIDA (un)", "CX. FOSC (un)"];

        container.innerHTML = catalogoMat.map((item, idx) => `
            <div class="py-1.5 flex justify-between items-center gap-2">
                <label class="font-bold text-slate-800 text-[11px] flex-1" for="inp-qtd-mat-solic-${idx}">📦 ${item}</label>
                <input type="number" id="inp-qtd-mat-solic-${idx}" data-nome-material="${item}" min="0" placeholder="0" class="w-20 text-center font-black text-xs border-2 border-indigo-200 rounded-lg p-1.5 bg-white text-indigo-950 outline-none focus:border-indigo-600">
            </div>
        `).join('');
    }
    document.getElementById('modal-solic-material').classList.remove('hidden');
}

function fecharModalSolicitacaoMaterialCampo() {
    document.getElementById('modal-solic-material')?.classList.add('hidden');
}

async function enviarSolicitacaoMaterialCampo() {
    const nomeEq = validarTecnicoSelecionadoParaSolicitacao();
    if (!nomeEq) return;

    const inputs = document.querySelectorAll('#lista-itens-solic-material-campo input[data-nome-material]');
    const itensPedidos = [];

    inputs.forEach(inp => {
        const qtd = Number(inp.value) || 0;
        if (qtd > 0) itensPedidos.push(`${inp.dataset.nomeMaterial}: ${qtd}`);
    });

    if (itensPedidos.length === 0) {
        alert("⚠️ Informe a quantidade (maior que zero) em pelo menos 1 item de material.");
        return;
    }

    const obs = (document.getElementById('inp-obs-solic-material')?.value || "").trim();
    const btn = document.getElementById('btn-enviar-solic-mat');
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Enviando pedido de material..."; }

    let gpsAtual = "Sem GPS no momento";
    try { gpsAtual = await capturarGpsReal(4000); } catch (e) {}

    const hojeISO = obterDataLocalISO();
    const horaAtual = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    const novoRegDB = {
        id: Date.now(),
        data_registro: hojeISO,
        equipe: nomeEq,
        membros: nomeEq,
        projeto: PROJETO_SOLIC_MATERIAL,
        imovel: `PEDIDO (${itensPedidos.length} item/itens)`,
        h_entrada: horaAtual,
        h_saida: "Pendente",
        gps_entrada: gpsAtual,
        gps_saida: "-",
        desfecho: "AGUARDANDO TRATATIVA",
        motivo_desfecho: itensPedidos.join(" | "),
        malogros: itensPedidos,
        responsavel: obs || "Solicitação via Modo Campo",
        contato: "",
        email: "",
        agendamento: null,
        andares: itensPedidos.length,
        hps: 0,
        servico_obra: "NÃO",
        observacoes: obs || "Aguardando separação/entrega"
    };

    try {
        const { error } = await supabaseClient.from('registros_producao').insert([novoRegDB]);
        if (error) throw error;

        if (btn) { btn.disabled = false; btn.innerText = "🚀 Enviar Pedido de Material"; }
        fecharModalSolicitacaoMaterialCampo();
        await carregarRegistrosModoCampoLeve();
        renderizarResumoSolicitacoesCampo();
        alert(`✅ Pedido de Material enviado com sucesso!`);
    } catch (err) {
        if (btn) { btn.disabled = false; btn.innerText = "🚀 Enviar Pedido de Material"; }
        alert("❌ Erro ao enviar pedido de material: " + (err.message || "Verifique sua conexão."));
    }
}

function renderizarResumoSolicitacoesCampo() {
    const box = document.getElementById('box-status-solicitacoes-campo');
    if (!box) return;

    const nomeEq = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || "";
    if (!nomeEq) { box.classList.add('hidden'); return; }

    const minhasSolic = (registrosSalvos || []).filter(r =>
        r.equipe === nomeEq &&
        (r.projeto === PROJETO_SOLIC_COMBUSTIVEL || r.projeto === PROJETO_SOLIC_MATERIAL)
    ).slice(0, 4);

    if (minhasSolic.length === 0) { box.classList.add('hidden'); return; }

    box.classList.remove('hidden');
    box.innerHTML = minhasSolic.map(s => {
        const ehComb = s.projeto === PROJETO_SOLIC_COMBUSTIVEL;
        const icone = ehComb ? "⛽" : "🧰";
        const tipoTitulo = ehComb ? s.imovel : `Material (${(s.malogros || []).length} itens)`;
        const tratada = s.desfecho === 'TRATADA';
        const badge = tratada
            ? `<span class="bg-emerald-100 text-emerald-900 border border-emerald-300 font-black px-1.5 py-0.5 rounded text-[9px]">🟢 TRATADA por ${s.tratadoPor || 'Gestor'} (${s.tratadoDataHora || s.hSaida})</span>`
            : `<span class="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded text-[9px]">🟡 AGUARDANDO TRATATIVA (${s.hEntrada})</span>`;

        return `
            <div class="bg-white p-2 rounded-lg border border-slate-200 flex flex-col gap-0.5 text-[10px]">
                <div class="flex justify-between items-center gap-1">
                    <span class="font-bold text-slate-800">${icone} ${tipoTitulo}</span>
                    <span class="text-[9px] text-slate-400">${s.dataRegistro}</span>
                </div>
                <div>${badge}</div>
            </div>
        `;
    }).join('');
}

// ================= FILA OFFLINE DE SALVAMENTO =================
function obterFilaOfflineCampo() {
    try {
        const bruto = localStorage.getItem('gpd_fila_offline_campo');
        if (!bruto) return [];
        const parsed = JSON.parse(bruto);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function salvarNaFilaOfflineCampo(pacoteRegistros, resumoTexto) {
    const fila = obterFilaOfflineCampo();
    fila.push({
        idFila: Date.now(),
        dataHora: new Date().toLocaleString('pt-BR'),
        idEmAndamentoParaDeletar: dadosAtendimento.idEmAndamento || null,
        registros: pacoteRegistros,
        resumoWhats: resumoTexto
    });
    localStorage.setItem('gpd_fila_offline_campo', JSON.stringify(fila));
    renderizarBannerFilaOfflineCampo();
}

function renderizarBannerFilaOfflineCampo() {
    const fila = obterFilaOfflineCampo();
    let banner = document.getElementById('banner-fila-offline-campo');
    const containerPai = document.getElementById('subview-campo-lancamento');
    if (!containerPai) return;

    if (fila.length === 0) {
        if (banner) banner.classList.add('hidden');
        return;
    }

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'banner-fila-offline-campo';
        banner.className = 'bg-amber-100 border-2 border-amber-500 p-3 rounded-xl space-y-2 shadow-sm';
        containerPai.insertBefore(banner, containerPai.firstChild);
    }

    banner.classList.remove('hidden');
    banner.innerHTML = `
        <div class="flex justify-between items-start gap-2">
            <div>
                <h4 class="text-xs font-black text-amber-950 uppercase flex items-center gap-1">
                    📡 ${fila.length} Atendimento(s) Guardado(s) na Fila Offline
                </h4>
                <p class="text-[10px] text-amber-900 mt-0.5">
                    Salvo(s) no celular durante queda de sinal 4G. Clique abaixo para sincronizar.
                </p>
            </div>
        </div>
        <button type="button" onclick="sincronizarFilaOfflineCampo(true)" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2 rounded-lg text-xs transition shadow-sm">
            🔄 Sincronizar Fila Offline Agora (${fila.length})
        </button>
    `;
}

async function sincronizarFilaOfflineCampo(exibirFeedback = false) {
    const fila = obterFilaOfflineCampo();
    if (fila.length === 0) return;

    let restantes = [];
    let enviados = 0;

    for (const item of fila) {
        try {
            if (item.idEmAndamentoParaDeletar) {
                await supabaseClient.from('registros_producao').delete().eq('id', item.idEmAndamentoParaDeletar);
            }
            const { error } = await supabaseClient.from('registros_producao').upsert(item.registros, { onConflict: 'id' });
            if (error) restantes.push(item);
            else enviados++;
        } catch (err) {
            restantes.push(item);
        }
    }

    localStorage.setItem('gpd_fila_offline_campo', JSON.stringify(restantes));
    renderizarBannerFilaOfflineCampo();

    if (enviados > 0) {
        await carregarRegistrosModoCampoLeve();
        atualizarAbaMinhasAtividadesCampo(false);
        if (exibirFeedback) alert(`✅ ${enviados} atendimento(s) da Fila Offline foram sincronizados com sucesso na nuvem!`);
    } else if (exibirFeedback && restantes.length > 0) {
        alert("⚠️ Ainda sem conexão estável com a nuvem. Os dados continuam seguros no aparelho.");
    }
}

window.addEventListener('online', () => {
    sincronizarFilaOfflineCampo(true);
});

async function encerrarImprevistosAbertosAoIniciarAtividade(nomeEquipe, gpsAtual = null) {
    if (!nomeEquipe) return;
    try {
        const imprevistosAbertos = (registrosSalvos || []).filter(r =>
            r.equipe === nomeEquipe &&
            r.desfecho === 'IMPREVISTO'
        );

        const horaFim = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

        await supabaseClient
            .from('registros_producao')
            .update({
                desfecho: "IMPREVISTO RESOLVIDO",
                h_saida: horaFim,
                gps_saida: gpsAtual || "Encerrado ao iniciar atividade"
            })
            .eq('equipe', nomeEquipe)
            .eq('desfecho', 'IMPREVISTO');

        imprevistosAbertos.forEach(imp => {
            imp.desfecho = "IMPREVISTO RESOLVIDO";
            imp.hSaida = horaFim;
        });

        document.getElementById('box-imprevisto-ativo-campo')?.classList.add('hidden');
    } catch (e) {}
}

function verificarHistoricoReincidenciaImovelCampo(codDigitado) {
    try {
        const codigo = (codDigitado || "").trim().toUpperCase();
        const inpImovel = document.getElementById('inp-imovel');
        if (!inpImovel) return null;

        let boxAlerta = document.getElementById('box-alerta-reincidencia-imovel');
        if (!boxAlerta) {
            boxAlerta = document.createElement('div');
            boxAlerta.id = 'box-alerta-reincidencia-imovel';
            boxAlerta.className = 'mt-1.5 p-2.5 rounded-xl border text-[11px] hidden space-y-1';
            inpImovel.parentNode.appendChild(boxAlerta);
        }

        if (codigo.length < 3 || !Array.isArray(registrosSalvos)) {
            boxAlerta.classList.add('hidden');
            return null;
        }

        const historico = registrosSalvos.filter(r => {
            const codReg = (r.imovel || "").toUpperCase().trim();
            return (codReg === codigo || codReg.startsWith(codigo + " -")) &&
                   ['PENDENTE', 'MALOGRADA', 'CONCLUIDA'].includes(r.desfecho);
        });

        if (historico.length === 0) {
            boxAlerta.classList.add('hidden');
            return null;
        }

        const ultimo = historico[0];
        const opcoesStr = (Array.isArray(ultimo.malogros) && ultimo.malogros.length > 0) ? ultimo.malogros.join(' + ') : 'Sem ofensor marcado';
        const motivoStr = ultimo.motivoDesfecho || ultimo.observacoes || 'Sem observações detalhadas';

        if (ultimo.desfecho === 'PENDENTE' || ultimo.desfecho === 'MALOGRADA') {
            boxAlerta.className = 'mt-1.5 p-2.5 rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-950 text-[11px] space-y-1 shadow-sm';
            boxAlerta.innerHTML = `
                <div class="font-black uppercase flex items-center justify-between">
                    <span>⚠️ Histórico de Reincidência (${ultimo.desfecho})</span>
                    <span class="text-[10px] font-mono bg-amber-200 px-1.5 py-0.5 rounded">${ultimo.dataRegistro}</span>
                </div>
                <div><b>Projeto:</b> ${ultimo.projeto} • <b>Técnico:</b> ${ultimo.equipe}</div>
                <div><b>Ofensor/Opção:</b> <span class="font-bold text-red-800">${opcoesStr}</span></div>
                <div class="italic text-[10px] bg-white p-1.5 rounded border border-amber-200">💬 "${motivoStr}"</div>
            `;
        } else {
            boxAlerta.className = 'mt-1.5 p-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-950 text-[11px] space-y-0.5';
            boxAlerta.innerHTML = `
                <div class="font-bold flex items-center justify-between">
                    <span>ℹ️ Imóvel com registro anterior CONCLUÍDO</span>
                    <span class="text-[10px] font-mono">${ultimo.dataRegistro}</span>
                </div>
                <div class="text-[10px]"><b>Projeto:</b> ${ultimo.projeto} • <b>Técnico:</b> ${ultimo.equipe}</div>
            `;
        }

        boxAlerta.classList.remove('hidden');
        return ultimo;
    } catch (e) {
        return null;
    }
}

// ================= BARRA DE INICIAR E ENCERRAR EXPEDIENTE (PROBLEMA 02 RESOLVIDO) =================
function atualizarBarraExpedienteCampo() {
    const nomeEq = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || "";
    const boxExp = document.getElementById('box-controle-expediente-campo');
    if (!boxExp) return;

    if (!nomeEq || equipeAutenticadaSessao !== nomeEq) {
        boxExp.classList.add('hidden');
        return;
    }

    boxExp.classList.remove('hidden');
    const hojeISO = obterDataLocalISO();
    const info = (typeof telemetriaEquipes !== 'undefined' && telemetriaEquipes) ? telemetriaEquipes[nomeEq] : null;

    // Se o técnico tem atividade EM ANDAMENTO hoje, ele NUNCA pode constar com expediente encerrado
    const temAtividadeAbertaHoje = !document.getElementById('bloco-pos-abertura')?.classList.contains('hidden') ||
        (registrosSalvos || []).some(r => r.dataRegistro === hojeISO && r.equipe === nomeEq && ['EM ANDAMENTO', 'PARALISADA', 'REABERTA'].includes(r.desfecho));

    if (temAtividadeAbertaHoje && info && info.data === hojeISO && info.statusTurno === 'ENCERRADO') {
        info.statusTurno = 'DISPONIVEL';
        info.horaFim = null;
        info.timestampUltimoSinal = Date.now();
    }

    const turnoAtivoHoje = (info && info.data === hojeISO && info.statusTurno === 'DISPONIVEL') || temAtividadeAbertaHoje;
    const turnoEncerradoHoje = !turnoAtivoHoje && info && info.data === hojeISO && info.statusTurno === 'ENCERRADO';

    const dot = document.getElementById('dot-rastreio-campo');
    const lblStatus = document.getElementById('lbl-status-expediente-campo');
    const lblHoraIni = document.getElementById('lbl-hora-inicio-expediente');
    const lblInfoGps = document.getElementById('lbl-info-rastreio-gps');
    const btnIniciar = document.getElementById('btn-iniciar-expediente-campo');
    const btnEncerrar = document.getElementById('btn-encerrar-expediente-campo');

    if (turnoAtivoHoje) {
        boxExp.className = "p-3 rounded-xl border-2 border-emerald-400 bg-emerald-50/70 space-y-2";
        if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping inline-block";
        if (lblStatus) {
            lblStatus.className = "text-emerald-950 font-black";
            lblStatus.innerText = "🟢 Expediente Ativo (Em Rota)";
        }
        if (lblHoraIni) lblHoraIni.innerText = `Início: ${info?.horaInicio || '--:--'}`;
        if (lblInfoGps) {
            lblInfoGps.className = "text-[10px] text-emerald-800 font-semibold leading-tight";
            lblInfoGps.innerText = `📡 Rastreamento GPS Ativo • Último envio: ${info?.horaUltimoSinal || '--:--'} (${info?.lat ? `${info.lat}, ${info.lng}` : 'Sinal ativo'})`;
        }
        if (btnIniciar) btnIniciar.classList.add('hidden');
        if (btnEncerrar) btnEncerrar.classList.remove('hidden');

        if (!watchIdRastreioGps) {
            iniciarMonitoramentoContinuoGps(nomeEq);
        }
    } else if (turnoEncerradoHoje) {
        boxExp.className = "p-3 rounded-xl border-2 border-red-200 bg-red-50/50 space-y-2";
        if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-red-500 inline-block";
        if (lblStatus) {
            lblStatus.className = "text-red-900 font-black";
            lblStatus.innerText = "🔴 Expediente Encerrado Hoje";
        }
        if (lblHoraIni) lblHoraIni.innerText = `${info.horaInicio || '--:--'} às ${info.horaFim || '--:--'}`;
        if (lblInfoGps) {
            lblInfoGps.className = "text-[10px] text-red-700 leading-tight";
            lblInfoGps.innerText = `Turno finalizado às ${info.horaFim || '--:--'}. Caso precise retornar à rota hoje, clique abaixo para reativar.`;
        }
        if (btnIniciar) {
            btnIniciar.innerText = "🟢 Reativar Expediente / Voltar para Rota";
            btnIniciar.classList.remove('hidden');
        }
        if (btnEncerrar) btnEncerrar.classList.add('hidden');
    } else {
        boxExp.className = "p-3 rounded-xl border-2 border-slate-200 bg-slate-50 space-y-2";
        if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-slate-400 inline-block";
        if (lblStatus) {
            lblStatus.className = "text-slate-800 font-black";
            lblStatus.innerText = "⚪ Expediente Não Iniciado";
        }
        if (lblHoraIni) lblHoraIni.innerText = "Início: --:--";
        if (lblInfoGps) {
            lblInfoGps.className = "text-[10px] text-slate-500 leading-tight";
            lblInfoGps.innerText = "Clique abaixo ao sair para campo para ficar Disponível no painel e transmitir sua posição em rota.";
        }
        if (btnIniciar) {
            btnIniciar.innerText = "🟢 Iniciar Expediente / Ficar Disponível em Rota";
            btnIniciar.classList.remove('hidden');
        }
        if (btnEncerrar) btnEncerrar.classList.add('hidden');
    }
}

async function capturarEEnviarPosicaoRastreio(nomeEq, exibirAlertaErro = false) {
    if (!nomeEq) return null;
    try {
        const coordStr = await capturarGpsReal(10000);
        const partes = coordStr.split(',').map(s => parseFloat(s.trim()));
        if (partes.length === 2 && !isNaN(partes[0]) && !isNaN(partes[1])) {
            ultimaCoordRastreioCache = { lat: partes[0], lng: partes[1] };
            await registrarPontoTelemetriaEquipe(nomeEq, partes[0], partes[1], 'DISPONIVEL');
            return coordStr;
        }
    } catch (e) {
        if (exibirAlertaErro) {
            alert("⚠️ Não foi possível obter o sinal de GPS. Verifique se a Localização do celular está ativada.");
        }
    }
    return null;
}

async function registrarPontoTelemetriaEquipe(nomeEq, lat, lng, statusCustom = null) {
    if (!nomeEq) return;
    const hojeISO = obterDataLocalISO();
    const horaAgora = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const anterior = (telemetriaEquipes[nomeEq] && telemetriaEquipes[nomeEq].data === hojeISO) ? telemetriaEquipes[nomeEq] : {};

    const novoObjeto = {
        equipe: nomeEq,
        data: hojeISO,
        statusTurno: statusCustom || anterior.statusTurno || 'DISPONIVEL',
        horaInicio: anterior.horaInicio || horaAgora,
        horaFim: statusCustom === 'ENCERRADO' ? horaAgora : null,
        lat: lat !== null && lat !== undefined ? Number(Number(lat).toFixed(6)) : (anterior.lat || null),
        lng: lng !== null && lng !== undefined ? Number(Number(lng).toFixed(6)) : (anterior.lng || null),
        horaUltimoSinal: horaAgora,
        timestampUltimoSinal: Date.now()
    };

    telemetriaEquipes[nomeEq] = novoObjeto;
    await sincronizarTelemetriaNaNuvem(nomeEq, novoObjeto);
    atualizarBarraExpedienteCampo();
}

function iniciarMonitoramentoContinuoGps(nomeEq) {
    pararMonitoramentoContinuoGps();
    if (!navigator.geolocation || !nomeEq) return;

    ativarWakeLockTela();

    watchIdRastreioGps = navigator.geolocation.watchPosition(
        (pos) => {
            const lat = Number(pos.coords.latitude.toFixed(6));
            const lng = Number(pos.coords.longitude.toFixed(6));
            ultimaCoordRastreioCache = { lat, lng };
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );

    timerEnvioRastreioGps = setInterval(async () => {
        const eqAtual = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao;
        const info = eqAtual ? telemetriaEquipes[eqAtual] : null;
        if (!eqAtual || !info || info.statusTurno !== 'DISPONIVEL') {
            pararMonitoramentoContinuoGps();
            return;
        }
        if (ultimaCoordRastreioCache) {
            await registrarPontoTelemetriaEquipe(eqAtual, ultimaCoordRastreioCache.lat, ultimaCoordRastreioCache.lng, 'DISPONIVEL');
        } else {
            await capturarEEnviarPosicaoRastreio(eqAtual, false);
        }
    }, 60000);
}

function pararMonitoramentoContinuoGps() {
    if (watchIdRastreioGps !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRastreioGps);
        watchIdRastreioGps = null;
    }
    if (timerEnvioRastreioGps !== null) {
        clearInterval(timerEnvioRastreioGps);
        timerEnvioRastreioGps = null;
    }
    liberarWakeLockTela();
}

async function iniciarExpedienteRastreioCampo() {
    const nomeEq = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao;
    if (!nomeEq) {
        alert("⚠️ Selecione a sua Equipe / Técnico primeiro.");
        return;
    }

    const btn = document.getElementById('btn-iniciar-expediente-campo');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "📡 Capturando GPS e iniciando expediente...";
    }

    let latIni = null, lngIni = null;
    try {
        const coord = await capturarGpsReal(12000);
        const partes = coord.split(',').map(s => parseFloat(s.trim()));
        if (partes.length === 2 && !isNaN(partes[0])) {
            latIni = partes[0];
            lngIni = partes[1];
            ultimaCoordRastreioCache = { lat: latIni, lng: lngIni };
        }
    } catch (e) {
        alert("❌ Ative o GPS / Localização do celular para iniciar o expediente e ficar disponível em rota.");
        if (btn) {
            btn.disabled = false;
            btn.innerText = "🟢 Iniciar Expediente / Ficar Disponível em Rota";
        }
        return;
    }

    const hojeISO = obterDataLocalISO();
    const horaAgora = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    const dadosTurno = {
        equipe: nomeEq,
        data: hojeISO,
        statusTurno: 'DISPONIVEL',
        horaInicio: telemetriaEquipes[nomeEq]?.data === hojeISO && telemetriaEquipes[nomeEq]?.horaInicio ? telemetriaEquipes[nomeEq].horaInicio : horaAgora,
        horaFim: null,
        lat: latIni,
        lng: lngIni,
        horaUltimoSinal: horaAgora,
        timestampUltimoSinal: Date.now()
    };

    telemetriaEquipes[nomeEq] = dadosTurno;
    await sincronizarTelemetriaNaNuvem(nomeEq, dadosTurno);

    if (btn) {
        btn.disabled = false;
        btn.innerText = "🟢 Iniciar Expediente / Ficar Disponível em Rota";
    }

    iniciarMonitoramentoContinuoGps(nomeEq);
    atualizarBarraExpedienteCampo();
    alert(`🟢 Expediente iniciado às ${horaAgora}!\nVocê já consta como DISPONÍVEL EM ROTA no mapa da gestão.`);
}

async function encerrarExpedienteRastreioCampo() {
    if (encerrandoExpedienteEmCurso) return;

    const nomeEq = (document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || "").trim().toUpperCase();
    if (!nomeEq) return;

    const posAberturaVisivel = !document.getElementById('bloco-pos-abertura')?.classList.contains('hidden');
    if (posAberturaVisivel) {
        alert("🚫 NÃO É PERMITIDO ENCERRAR O EXPEDIENTE!\n\nVocê possui uma atividade aberta na sua tela neste momento. Finalize e salve o atendimento antes de encerrar o turno.");
        return;
    }

    const checarPendenciasLocais = () => (registrosSalvos || []).filter(r =>
        r.equipe === nomeEq &&
        r.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
        r.projeto !== PROJETO_SOLIC_MATERIAL &&
        ['EM ANDAMENTO', 'PARALISADA', 'REABERTA', 'IMPREVISTO'].includes(r.desfecho)
    );

    let pendentes = checarPendenciasLocais();
    if (pendentes.length > 0) {
        const resumo = pendentes.map(p => `• ${p.imovel} (${p.desfecho})`).join('\n');
        alert(`🚫 ENCERRAMENTO DE EXPEDIENTE BLOQUEADO!\n\nVocê ainda possui ${pendentes.length} atividade(s) ou imprevisto(s) em aberto:\n\n${resumo}\n\nFinalize todas antes de encerrar o seu turno.`);
        return;
    }

    if (!confirm(`🔴 ENCERRAR EXPEDIENTE DO DIA\n\nConfirmar o encerramento do turno de hoje para ${nomeEq}?\nO compartilhamento de GPS em rota será desligado imediatamente.`)) {
        return;
    }

    encerrandoExpedienteEmCurso = true;
    ultimoDisparoGpsCampoTs = Date.now() + 60000;
    pararMonitoramentoContinuoGps();

    const btnEnc = document.getElementById('btn-encerrar-expediente-campo');
    if (btnEnc) {
        btnEnc.disabled = true;
        btnEnc.innerText = "🔴 Encerrando turno...";
    }

    try {
        if (typeof carregarRegistrosModoCampoLeve === 'function') {
            await Promise.race([
                carregarRegistrosModoCampoLeve(),
                new Promise(res => setTimeout(res, 2500))
            ]);
        }

        pendentes = checarPendenciasLocais();
        if (pendentes.length > 0) {
            const resumo = pendentes.map(p => `• ${p.imovel} (${p.desfecho})`).join('\n');
            alert(`🚫 ENCERRAMENTO BLOQUEADO!\n\nConsta(m) ${pendentes.length} atividade(s) em aberto na nuvem:\n\n${resumo}`);
            return;
        }

        let latFim = ultimaCoordRastreioCache?.lat || telemetriaEquipes[nomeEq]?.lat || null;
        let lngFim = ultimaCoordRastreioCache?.lng || telemetriaEquipes[nomeEq]?.lng || null;

        const hojeISO = obterDataLocalISO();
        const horaFim = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const anterior = (telemetriaEquipes[nomeEq] && telemetriaEquipes[nomeEq].data === hojeISO) ? telemetriaEquipes[nomeEq] : {};

        const dadosEncerramento = {
            equipe: nomeEq,
            data: hojeISO,
            statusTurno: 'ENCERRADO',
            horaInicio: anterior.horaInicio || horaFim,
            horaFim: horaFim,
            lat: latFim !== null ? Number(Number(latFim).toFixed(6)) : (anterior.lat || null),
            lng: lngFim !== null ? Number(Number(lngFim).toFixed(6)) : (anterior.lng || null),
            horaUltimoSinal: horaFim,
            timestampUltimoSinal: Date.now()
        };

        telemetriaEquipes[nomeEq] = dadosEncerramento;
        atualizarBarraExpedienteCampo();
        await sincronizarTelemetriaNaNuvem(nomeEq, dadosEncerramento);
        atualizarBarraExpedienteCampo();

        alert(`🔴 Expediente encerrado com sucesso às ${horaFim}! Bom descanso.`);
    } catch (e) {
        atualizarBarraExpedienteCampo();
    } finally {
        encerrandoExpedienteEmCurso = false;
        if (btnEnc) {
            btnEnc.disabled = false;
            btnEnc.innerText = "🔴 Encerrar Expediente do Dia";
        }
    }
}

// ================= COMPRESSÃO DE IMAGENS =================
function comprimirImagemBase64(file, maxWidth = 720, quality = 0.58) {
    return new Promise((resolve, reject) => {
        if (!file) { reject(new Error("Arquivo inválido")); return; }
        const blobUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = function() {
            URL.revokeObjectURL(blobUrl);
            try {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth || height > maxWidth) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxWidth) / height);
                        height = maxWidth;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                ctx.clearRect(0, 0, width, height);
                canvas.width = 1;
                canvas.height = 1;
                img.src = "";
                resolve(dataUrl);
            } catch (err) { reject(err); }
        };
        img.onerror = function(err) { URL.revokeObjectURL(blobUrl); reject(err); };
        img.src = blobUrl;
    });
}

async function aoSelecionarFotosBloco(idx, inputEl) {
    lerDadosBlocosDaTela();
    const arquivos = Array.from(inputEl.files || []);
    if (arquivos.length === 0) return;

    const bloco = dadosAtendimento.blocos[idx];
    if (!bloco.fotos) bloco.fotos = [];

    if (bloco.fotos.length + arquivos.length > 10) {
        alert("⚠️ Você pode anexar no máximo 10 fotos por bloco.");
        inputEl.value = "";
        return;
    }

    for (const arq of arquivos) {
        try {
            const base64Comprimida = await comprimirImagemBase64(arq, 720, 0.58);
            bloco.fotos.push(base64Comprimida);
        } catch (e) {}
    }

    inputEl.value = "";
    renderizarBlocosCampo();
    salvarRascunhoCampo();
}

function removerFotoBloco(idxBloco, idxFoto) {
    lerDadosBlocosDaTela();
    const bloco = dadosAtendimento.blocos[idxBloco];
    if (bloco && Array.isArray(bloco.fotos)) {
        bloco.fotos.splice(idxFoto, 1);
        renderizarBlocosCampo();
        salvarRascunhoCampo();
    }
}

function abrirZoomFoto(srcBase64, nomeArquivo = "foto_gpd.jpg") {
    const modal = document.getElementById('modal-zoom-foto');
    const img = document.getElementById('img-zoom-alvo');
    const btnDown = document.getElementById('btn-download-zoom-foto');
    const lbl = document.getElementById('lbl-titulo-zoom-foto');
    if (!modal || !img) return;
    img.src = srcBase64;
    btnDown.href = srcBase64;
    btnDown.download = nomeArquivo;
    lbl.innerText = `📷 ${nomeArquivo}`;
    modal.classList.remove('hidden');
}

function fecharZoomFoto() {
    document.getElementById('modal-zoom-foto').classList.add('hidden');
}

function baixarFotoDireto(srcBase64, nomeArquivo) {
    const a = document.createElement('a');
    a.href = srcBase64;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ================= SUB-ABAS DO MODO CAMPO =================
function mudarSubAbaCampo(aba) {
    const vLanc = document.getElementById('subview-campo-lancamento');
    const vPainel = document.getElementById('subview-campo-painel');
    const btnLanc = document.getElementById('btn-aba-campo-lancamento');
    const btnPainel = document.getElementById('btn-aba-campo-painel');

    if (!vLanc || !vPainel) return;

    if (aba === 'painel') {
        vLanc.classList.add('hidden');
        vPainel.classList.remove('hidden');
        if (btnPainel) btnPainel.className = "py-2 px-3 rounded-lg font-bold text-xs transition bg-blue-900 text-white shadow-sm flex items-center justify-center gap-1.5";
        if (btnLanc) btnLanc.className = "py-2 px-3 rounded-lg font-bold text-xs transition bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center gap-1.5";
        atualizarAbaMinhasAtividadesCampo(false);
    } else {
        vPainel.classList.add('hidden');
        vLanc.classList.remove('hidden');
        if (btnLanc) btnLanc.className = "py-2 px-3 rounded-lg font-bold text-xs transition bg-blue-900 text-white shadow-sm flex items-center justify-center gap-1.5";
        if (btnPainel) btnPainel.className = "py-2 px-3 rounded-lg font-bold text-xs transition bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center gap-1.5";
        organizarTelaPrincipalEBotaoSuporteRodape();
    }
}

async function atualizarAbaMinhasAtividadesCampo(forcarRecarregamentoNuvem = false) {
    if (forcarRecarregamentoNuvem) {
        await carregarRegistrosModoCampoLeve();
    }
    renderizarResumoSolicitacoesCampo();

    const equipeSelecionada = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || "";
    const container = document.getElementById('lista-minhas-atividades-campo');
    const badgeQtd = document.getElementById('badge-qtd-minhas-ativ');

    if (!container) return;

    if (!equipeSelecionada) {
        if (badgeQtd) badgeQtd.innerText = "0";
        container.innerHTML = `<div class="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center text-xs text-slate-500">🔒 Selecione a sua <b>Equipe / Técnico</b> e autentique seu PIN na aba "Atendimento".</div>`;
        return;
    }

    const hojeISO = obterDataLocalISO();
    const meusRegistros = (registrosSalvos || []).filter(r =>
        (r.equipe === equipeSelecionada || extrairListaApoiosDoMembros(r.membros, r.equipe).includes(equipeSelecionada)) &&
        r.projeto !== 'IMPREVISTO / ATRASO' &&
        r.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
        r.projeto !== PROJETO_SOLIC_MATERIAL
    );

    const ativasPainel = meusRegistros.filter(r => ['EM ANDAMENTO', 'PARALISADA', 'REABERTA', 'PROGRAMADA'].includes(r.desfecho));
    const finalizadasHoje = meusRegistros.filter(r => r.dataRegistro === hojeISO && ['CONCLUIDA', 'PENDENTE', 'MALOGRADA'].includes(r.desfecho));

    if (badgeQtd) badgeQtd.innerText = ativasPainel.length;

    const ordemPrioridade = { 'EM ANDAMENTO': 1, 'PARALISADA': 2, 'REABERTA': 3, 'PROGRAMADA': 4 };
    ativasPainel.sort((a, b) => (ordemPrioridade[a.desfecho] || 9) - (ordemPrioridade[b.desfecho] || 9));

    let html = "";

    if (ativasPainel.length === 0) {
        html += `<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center text-xs text-emerald-900 font-semibold">✅ Você não possui atividades pendentes, programadas ou em aberto na fila do painel neste momento.</div>`;
    } else {
        html += `<div class="text-[11px] font-black text-slate-700 uppercase px-1">🔥 Ativas / Na Fila do Painel (${ativasPainel.length})</div>`;
        ativasPainel.forEach(r => {
            const corBadge = obterClasseCorDesfecho(r.desfecho);
            const qtdB = r.qtdBlocosProgramados || 1;
            const ehApoio = r.equipe !== equipeSelecionada;
            let btnAcao = "";

            if (ehApoio) {
                btnAcao = `<span class="bg-purple-100 text-purple-900 font-bold text-[10px] px-2.5 py-1 rounded">🤝 Em Apoio a ${r.equipe}</span>`;
            } else if (r.desfecho === 'PROGRAMADA') {
                btnAcao = `<button type="button" onclick="mudarSubAbaCampo('lancamento'); iniciarAtividadeProgramadaCampo(${r.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">🚀 Iniciar Agora</button>`;
            } else if (r.desfecho === 'REABERTA') {
                btnAcao = `<button type="button" onclick="mudarSubAbaCampo('lancamento'); retomarAtividadeReabertaCampo(${r.id})" class="bg-purple-700 hover:bg-purple-800 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">✏️ Editar Reaberta</button>`;
            } else if (r.desfecho === 'EM ANDAMENTO' || r.desfecho === 'PARALISADA') {
                btnAcao = `<button type="button" onclick="mudarSubAbaCampo('lancamento'); retomarAtividadeEmAndamentoOuParalisadaNuvem(${r.id})" class="bg-blue-800 hover:bg-blue-900 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">▶️ Abrir / Continuar</button>`;
            }

            html += `
                <div class="bg-white p-3 rounded-xl border-2 border-slate-200 shadow-sm space-y-1.5">
                    <div class="flex justify-between items-start gap-2">
                        <div>
                            <span class="font-black text-blue-950 text-xs">🏢 ${r.imovel}</span>
                            <span class="ml-1 bg-blue-50 text-blue-900 border border-blue-200 px-1.5 py-0.5 rounded text-[9px] font-bold">${r.projeto}</span>
                        </div>
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold ${corBadge}">${r.desfecho}</span>
                    </div>
                    <div class="text-[11px] text-slate-600">📍 ${r.endereco || 'Endereço a confirmar'}</div>
                    <div class="flex justify-between items-center pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                        <span>📅 ${r.dataRegistro} • Blocos: <b>${qtdB}</b> ${r.tempoPausadoMinutos > 0 ? `• ⏸️ Pausa: <b>${r.tempoPausadoMinutos}m</b>` : ''}</span>
                        ${btnAcao}
                    </div>
                </div>
            `;
        });
    }

    if (finalizadasHoje.length > 0) {
        html += `<div class="text-[11px] font-black text-slate-700 uppercase px-1 pt-3 border-t border-slate-200">✔️ Finalizadas por Você Hoje (${finalizadasHoje.length})</div>`;
        finalizadasHoje.forEach(r => {
            const corBadge = obterClasseCorDesfecho(r.desfecho);
            html += `
                <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center gap-2 text-xs">
                    <div>
                        <div class="font-bold text-slate-800">🏢 ${r.imovel} <span class="text-[10px] font-normal text-slate-500">(${r.projeto})</span></div>
                        <div class="text-[10px] text-slate-500">🕒 ${r.hEntrada} às ${r.hSaida} ${r.tempoPausadoMinutos > 0 ? `• ⏸️ ${r.tempoPausadoMinutos}m pausa` : ''}</div>
                    </div>
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold ${corBadge}">${r.desfecho}</span>
                </div>
            `;
        });
    }

    container.innerHTML = html;
}

// ================= RETOMADA E PARALISAÇÃO DE ATIVIDADES =================
function retomarAtividadeEmAndamentoOuParalisadaNuvem(idReg) {
    if (dadosAtendimento.idEmAndamento && dadosAtendimento.idEmAndamento === idReg) {
        mudarSubAbaCampo('lancamento');
        return;
    }

    const r = (registrosSalvos || []).find(item => item.id === idReg);
    if (!r) return;

    encerrarImprevistosAbertosAoIniciarAtividade(r.equipe, r.gpsEntrada);
    atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
    document.getElementById('sel-projeto').value = r.projeto;
    document.getElementById('inp-imovel').value = r.imovel;

    dadosAtendimento.idEmAndamento = r.id;
    dadosAtendimento._projetoTravado = r.projeto;
    dadosAtendimento._imovelTravado = r.imovel;
    dadosAtendimento.eraReaberta = false;
    dadosAtendimento.eraProgramada = (r.motivoDesfecho || '').includes('[ORIGEM:PROGRAMADA]');
    dadosAtendimento.hEntrada = (r.hEntrada && r.hEntrada !== 'Programada') ? r.hEntrada : new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    dadosAtendimento.gpsEntrada = r.gpsEntrada || "Mantido da abertura";
    dadosAtendimento.minutosPausados = Number(r.tempoPausadoMinutos) || 0;
    dadosAtendimento.emPausa = (r.desfecho === 'PARALISADA');
    dadosAtendimento.inicioPausa = dadosAtendimento.emPausa ? Date.now() : null;
    dadosAtendimento.motivoPausaAtual = dadosAtendimento.emPausa ? (r.motivoDesfecho || 'Atividade paralisada') : '';

    const totalBlocos = Math.max(1, Math.min(20, Number(r.qtdBlocosProgramados) || 1));
    dadosAtendimento.blocos = [];
    for (let i = 1; i <= totalBlocos; i++) {
        const b = criarObjetoBlocoPadrao(i);
        if (r.andares) b.andares = r.andares;
        if (r.hps) b.hps = r.hps;
        if (r.observacoes && r.observacoes !== 'Em andamento') b.observacoes = r.observacoes;
        dadosAtendimento.blocos.push(b);
    }

    document.getElementById('lbl-imovel-aberto').innerText = `${r.imovel} (${r.projeto})`;
    document.getElementById('lbl-h-entrada').innerText = dadosAtendimento.hEntrada;
    document.getElementById('lbl-gps-entrada').innerText = dadosAtendimento.gpsEntrada;

    document.getElementById('form-endereco').value = r.endereco || '';
    document.getElementById('form-liberou-acesso').value = r.liberouAcesso || '';
    document.getElementById('form-responsavel').value = r.responsavel || '';
    document.getElementById('form-contato').value = r.contato || '';
    document.getElementById('form-email').value = r.email || '';
    document.getElementById('inp-qtd-blocos').value = totalBlocos;

    document.getElementById('form-campo-container').classList.add('hidden');
    document.getElementById('bloco-pos-abertura').classList.remove('hidden');

    mudarTipoProjeto();
    renderizarBlocosCampo();
    sincronizarVisualPausaCampo();
    salvarRascunhoCampo();
}

function sincronizarVisualPausaCampo() {
    const btnParalisar = document.getElementById('btn-paralisar-atividade');
    const bannerPausa = document.getElementById('banner-atividade-paralisada-ativa');
    const corpoForm = document.getElementById('corpo-formulario-blocos-campo');
    const lblStatus = document.getElementById('lbl-status-execucao-campo');
    const lblAcumulado = document.getElementById('lbl-tempo-pausado-acumulado');
    const dotStatus = document.getElementById('dot-status-execucao');

    if (lblAcumulado) {
        lblAcumulado.innerText = dadosAtendimento.minutosPausados > 0 ? `(⏸️ Pausas: ${dadosAtendimento.minutosPausados} min)` : "";
    }

    if (dadosAtendimento.emPausa) {
        if (btnParalisar) btnParalisar.classList.add('hidden');
        if (bannerPausa) bannerPausa.classList.remove('hidden');
        if (corpoForm) corpoForm.classList.add('opacity-50', 'pointer-events-none');
        if (lblStatus) lblStatus.innerText = "⏸️ ATIVIDADE PARALISADA";
        if (dotStatus) dotStatus.className = "inline-block w-2 h-2 rounded-full bg-orange-500 animate-ping";

        const horaPausa = dadosAtendimento.inicioPausa
            ? new Date(dadosAtendimento.inicioPausa).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})
            : '--:--';
        const elHora = document.getElementById('lbl-hora-inicio-pausa');
        const elMot = document.getElementById('lbl-motivo-pausa-atual');
        if (elHora) elHora.innerText = `Desde ${horaPausa}`;
        if (elMot) elMot.innerText = `Motivo: ${dadosAtendimento.motivoPausaAtual || 'Não informado'}`;
    } else {
        if (btnParalisar) btnParalisar.classList.remove('hidden');
        if (bannerPausa) bannerPausa.classList.add('hidden');
        if (corpoForm) corpoForm.classList.remove('opacity-50', 'pointer-events-none');
        if (lblStatus) lblStatus.innerText = dadosAtendimento.eraReaberta ? "🔄 Editando Atividade Reaberta" : "Status: Em Andamento no Painel";
        if (dotStatus) dotStatus.className = "inline-block w-2 h-2 rounded-full bg-blue-600 animate-ping";
    }
}

async function paralisarAtividadeAtualCampo() {
    if (!dadosAtendimento.idEmAndamento) return;
    lerDadosBlocosDaTela();

    const motivo = prompt("⏸️ PARALISAR ATIVIDADE TEMPORARIAMENTE\n\nInforme o motivo da paralisação (Ex: Horário de almoço, chuva, aguardando síndico/material):");
    if (motivo === null) return;
    const motivoLimpo = motivo.trim() || "Paralisação temporária em campo";

    const agora = Date.now();
    const horaStr = new Date(agora).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    dadosAtendimento.emPausa = true;
    dadosAtendimento.inicioPausa = agora;
    dadosAtendimento.motivoPausaAtual = motivoLimpo;

    const endAtual = document.getElementById('form-endereco')?.value.trim() || '';
    const libAtual = document.getElementById('form-liberou-acesso')?.value.trim() || '';
    const tagEnd = endAtual ? `[END: ${endAtual}] ` : '';
    const tagLib = libAtual ? `[LIBEROU_ACESSO: ${libAtual}] ` : '';
    const tagPausa = `[PAUSA_INICIO: ${agora}] [PAUSA_TOTAL: ${dadosAtendimento.minutosPausados || 0}]`;

    await supabaseClient.from('registros_producao').update({
        desfecho: "PARALISADA",
        h_saida: "Paralisada",
        motivo_desfecho: `⏸️ Paralisada às ${horaStr}: ${motivoLimpo}`,
        observacoes: `${tagEnd}${tagLib}${tagPausa}`.trim()
    }).eq('id', dadosAtendimento.idEmAndamento);

    sincronizarVisualPausaCampo();
    salvarRascunhoCampo();
    await carregarRegistrosModoCampoLeve();
    atualizarAbaMinhasAtividadesCampo(false);
    alert(`⏸️ Atividade paralisada às ${horaStr}!\nClique em "Retomar Atividade Agora" quando voltar ao serviço.`);
}

async function retomarAtividadeParalisadaCampo() {
    if (!dadosAtendimento.idEmAndamento || !dadosAtendimento.emPausa) return;

    const agora = Date.now();
    const inicio = dadosAtendimento.inicioPausa || agora;
    const minutosDestaPausa = Math.max(1, Math.round((agora - inicio) / 60000));

    dadosAtendimento.minutosPausados = (Number(dadosAtendimento.minutosPausados) || 0) + minutosDestaPausa;
    dadosAtendimento.emPausa = false;
    dadosAtendimento.inicioPausa = null;
    dadosAtendimento.motivoPausaAtual = "";

    const horaStr = new Date(agora).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const endAtual = document.getElementById('form-endereco')?.value.trim() || '';
    const libAtual = document.getElementById('form-liberou-acesso')?.value.trim() || '';
    const tagEnd = endAtual ? `[END: ${endAtual}] ` : '';
    const tagLib = libAtual ? `[LIBEROU_ACESSO: ${libAtual}] ` : '';
    const tagPausa = `[PAUSA_TOTAL: ${dadosAtendimento.minutosPausados}]`;

    await supabaseClient.from('registros_producao').update({
        desfecho: "EM ANDAMENTO",
        h_saida: "Em Andamento",
        motivo_desfecho: `▶️ Retomada às ${horaStr} (Pausa acumulada: ${dadosAtendimento.minutosPausados} min)`,
        observacoes: `${tagEnd}${tagLib}${tagPausa}`.trim()
    }).eq('id', dadosAtendimento.idEmAndamento);

    sincronizarVisualPausaCampo();
    salvarRascunhoCampo();
    await carregarRegistrosModoCampoLeve();
    atualizarAbaMinhasAtividadesCampo(false);
    alert(`▶️ Atividade retomada com sucesso!\nTempo desta pausa: ${minutosDestaPausa} min (Total acumulado: ${dadosAtendimento.minutosPausados} min).`);
}

// ================= BLOCOS DINÂMICOS =================
function criarObjetoBlocoPadrao(numero) {
    return {
        identificacao: `BLOCO ${numero}`,
        andares: "",
        hps: "",
        fusoes: 0,
        conectores: 0,
        caboRL: 0,
        caboDrop: 0,
        nap: 0,
        dio: 0,
        cxSobrepor: 0,
        cxEmbutida: 0,
        cxFosc: 0,
        desfecho: null,
        servicoObra: "SIM",
        concluidasOpcoes: [],
        obsConcluida: "",
        obsPendente: "",
        pendenciasOpcoes: [],
        obsMalograda: "",
        malogros: [],
        observacoes: "",
        fotos: []
    };
}

function lerDadosBlocosDaTela() {
    const qtd = dadosAtendimento.blocos.length;
    for (let i = 0; i < qtd; i++) {
        const b = dadosAtendimento.blocos[i];
        const elId = document.getElementById(`bloco-ident-${i}`);
        if (!elId) continue;
        b.identificacao = elId.value;
        b.andares = document.getElementById(`bloco-andares-${i}`)?.value || "";
        b.hps = document.getElementById(`bloco-hps-${i}`)?.value || "";
        b.fusoes = document.getElementById(`bloco-fusoes-${i}`)?.value || 0;
        b.conectores = document.getElementById(`bloco-conectores-${i}`)?.value || 0;
        b.caboRL = document.getElementById(`bloco-cabo-rl-${i}`)?.value || 0;
        b.caboDrop = document.getElementById(`bloco-cabo-drop-${i}`)?.value || 0;
        b.nap = document.getElementById(`bloco-nap-${i}`)?.value || 0;
        b.dio = document.getElementById(`bloco-dio-${i}`)?.value || 0;
        b.cxSobrepor = document.getElementById(`bloco-cx-sobrepor-${i}`)?.value || 0;
        b.cxEmbutida = document.getElementById(`bloco-cx-embutida-${i}`)?.value || 0;
        b.cxFosc = document.getElementById(`bloco-cx-fosc-${i}`)?.value || 0;
        b.servicoObra = document.getElementById(`bloco-servico-obra-${i}`)?.value || "SIM";
        b.obsConcluida = document.getElementById(`bloco-obs-conc-${i}`)?.value || "";
        b.obsPendente = document.getElementById(`bloco-obs-pend-${i}`)?.value || "";
        b.obsMalograda = document.getElementById(`bloco-obs-malo-${i}`)?.value || "";
        b.observacoes = document.getElementById(`bloco-observacoes-${i}`)?.value || "";

        b.concluidasOpcoes = Array.from(document.querySelectorAll(`input[name="bloco-concluida-check-${i}"]:checked`)).map(c => c.value);
        b.pendenciasOpcoes = Array.from(document.querySelectorAll(`input[name="bloco-pendencia-check-${i}"]:checked`)).map(c => c.value);
        b.malogros = Array.from(document.querySelectorAll(`input[name="bloco-malogro-check-${i}"]:checked`)).map(c => c.value);
    }
}

function alterarQuantidadeBlocos(novaQtd) {
    lerDadosBlocosDaTela();
    let qtd = parseInt(novaQtd, 10);
    if (isNaN(qtd) || qtd < 1) qtd = 1;
    if (qtd > 20) qtd = 20;
    document.getElementById('inp-qtd-blocos').value = qtd;

    while (dadosAtendimento.blocos.length < qtd) {
        dadosAtendimento.blocos.push(criarObjetoBlocoPadrao(dadosAtendimento.blocos.length + 1));
    }
    if (dadosAtendimento.blocos.length > qtd) {
        dadosAtendimento.blocos = dadosAtendimento.blocos.slice(0, qtd);
    }
    renderizarBlocosCampo();
    salvarRascunhoCampo();
}

function selecionarDesfechoBloco(idx, tipo) {
    lerDadosBlocosDaTela();
    if (dadosAtendimento.blocos[idx]) {
        dadosAtendimento.blocos[idx].desfecho = tipo;
    }
    renderizarBlocosCampo();
    salvarRascunhoCampo();
}

function renderizarBlocosCampo() {
    garantirOpcaoRedeGponNaoConstruida();
    const container = document.getElementById('container-blocos-dinamicos');
    if (!container) return;
    container.innerHTML = "";

    const qtdTotal = dadosAtendimento.blocos.length;
    const listaOpcoesConcluida = (typeof OPCOES_CONCLUIDA_PADRAO !== 'undefined' && Array.isArray(OPCOES_CONCLUIDA_PADRAO))
        ? [...OPCOES_CONCLUIDA_PADRAO]
        : [];
    if (!listaOpcoesConcluida.includes("REDE GPON NÃO CONSTRUÍDA")) {
        listaOpcoesConcluida.push("REDE GPON NÃO CONSTRUÍDA");
    }

    dadosAtendimento.blocos.forEach((b, idx) => {
        if (!b.fotos) b.fotos = [];
        if (!b.concluidasOpcoes) b.concluidasOpcoes = [];
        const mostrarIdentBloco = qtdTotal > 1;
        const d = b.desfecho;

        const btnConcClass = d === 'CONCLUIDA' ? 'ring-2 ring-offset-1 ring-emerald-700 bg-emerald-700 text-white' : 'bg-emerald-600/90 text-white opacity-80';
        const btnPendClass = d === 'PENDENTE' ? 'ring-2 ring-offset-1 ring-amber-600 bg-amber-600 text-white' : 'bg-amber-500/90 text-white opacity-80';
        const btnMaloClass = d === 'MALOGRADA' ? 'ring-2 ring-offset-1 ring-red-700 bg-red-700 text-white' : 'bg-red-600/90 text-white opacity-80';

        const checkboxesConcluidaHtml = listaOpcoesConcluida.map(op => {
            const checked = (b.concluidasOpcoes && b.concluidasOpcoes.includes(op)) ? 'checked' : '';
            const destaqueGpon = op === 'REDE GPON NÃO CONSTRUÍDA' ? 'font-black text-emerald-950 bg-emerald-100/80 px-1.5 py-0.5 rounded' : '';
            return `<label class="flex items-center gap-1.5 ${destaqueGpon}"><input type="checkbox" name="bloco-concluida-check-${idx}" value="${op}" ${checked}> ${op}</label>`;
        }).join('');

        const checkboxesPendenciaHtml = OPCOES_PENDENCIA_PADRAO.map(op => {
            const checked = (b.pendenciasOpcoes && b.pendenciasOpcoes.includes(op)) ? 'checked' : '';
            const destaque = op === 'REDE CORRETIVA' ? 'font-black text-amber-900 bg-amber-100/70 px-1.5 py-0.5 rounded' : '';
            return `<label class="flex items-center gap-1.5 ${destaque}"><input type="checkbox" name="bloco-pendencia-check-${idx}" value="${op}" ${checked}> ${op}</label>`;
        }).join('');

        const checkboxesMalogroHtml = OPCOES_MALOGRO_PADRAO.map(ofensor => {
            const checked = (b.malogros && b.malogros.includes(ofensor)) ? 'checked' : '';
            const destaque = ofensor === 'REDE CORRETIVA' ? 'font-black text-red-900 bg-red-100/70 px-1.5 py-0.5 rounded' : '';
            return `<label class="flex items-center gap-1.5 ${destaque}"><input type="checkbox" name="bloco-malogro-check-${idx}" value="${ofensor}" ${checked}> ${ofensor}</label>`;
        }).join('');

        const miniaturasFotosHtml = b.fotos.map((fotoSrc, fIdx) => `
            <div class="relative group border border-slate-300 rounded-lg overflow-hidden w-16 h-16 bg-slate-100">
                <img src="${fotoSrc}" onclick="abrirZoomFoto('${fotoSrc}', 'Foto_${fIdx + 1}.jpg')" class="w-full h-full object-cover cursor-pointer">
                <button type="button" onclick="removerFotoBloco(${idx}, ${fIdx})" class="absolute top-0.5 right-0.5 bg-red-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">✕</button>
            </div>
        `).join('');

        const card = document.createElement('div');
        card.className = "bg-white p-3.5 rounded-xl border-2 border-blue-900/20 shadow-sm space-y-3";
        card.innerHTML = `
            <div class="flex justify-between items-center border-b border-slate-200 pb-2">
                <span class="bg-blue-900 text-white font-black text-[11px] px-2.5 py-1 rounded-md uppercase">
                    🏢 ${qtdTotal > 1 ? `Bloco ${idx + 1} de ${qtdTotal}` : 'Dados Técnicos do Bloco / Imóvel'}
                </span>
                ${mostrarIdentBloco ? `
                    <div class="flex items-center gap-1">
                        <span class="text-[10px] font-bold text-slate-600">Nome/Nº:</span>
                        <input type="text" id="bloco-ident-${idx}" value="${b.identificacao}" placeholder="Ex: BLOCO A" class="w-28 text-xs font-bold border border-blue-300 rounded px-2 py-1 uppercase text-blue-950 outline-none">
                    </div>
                ` : `<input type="hidden" id="bloco-ident-${idx}" value="${b.identificacao}">`}
            </div>

            <div class="grid grid-cols-2 gap-2 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200">
                <div>
                    <label class="block text-[11px] font-bold text-slate-800">Nº de Andares <span class="text-red-600">*</span></label>
                    <input type="number" id="bloco-andares-${idx}" value="${b.andares}" min="1" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white outline-none" placeholder="Obrigatório">
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-800">Nº de HPs <span class="text-red-600">*</span></label>
                    <input type="number" id="bloco-hps-${idx}" value="${b.hps}" min="1" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white outline-none" placeholder="Obrigatório">
                </div>
            </div>

            <div class="space-y-2 pt-1">
                <h4 class="text-[10px] font-bold text-blue-900 uppercase">Materiais e Caixas (${qtdTotal > 1 ? b.identificacao : 'Rede MDU'})</h4>
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="block text-[10px] font-semibold text-slate-600">Fusões</label><input type="number" id="bloco-fusoes-${idx}" value="${b.fusoes}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                    <div><label class="block text-[10px] font-semibold text-slate-600">Conectores</label><input type="number" id="bloco-conectores-${idx}" value="${b.conectores}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="block text-[10px] font-semibold text-slate-600">Cabo RL (m)</label><input type="number" id="bloco-cabo-rl-${idx}" value="${b.caboRL}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                    <div><label class="block text-[10px] font-semibold text-slate-600">Cabo Drop (m)</label><input type="number" id="bloco-cabo-drop-${idx}" value="${b.caboDrop}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="block text-[10px] font-semibold text-slate-600">NAP</label><input type="number" id="bloco-nap-${idx}" value="${b.nap}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                    <div><label class="block text-[10px] font-semibold text-slate-600">DIO</label><input type="number" id="bloco-dio-${idx}" value="${b.dio}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                </div>
                <div class="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                    <div><label class="block text-[9px] font-semibold text-slate-600">Cx. Sobrepor</label><input type="number" id="bloco-cx-sobrepor-${idx}" value="${b.cxSobrepor}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                    <div><label class="block text-[9px] font-semibold text-slate-600">Cx. Embutida</label><input type="number" id="bloco-cx-embutida-${idx}" value="${b.cxEmbutida}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                    <div><label class="block text-[9px] font-semibold text-slate-600">Cx. FOSC</label><input type="number" id="bloco-cx-fosc-${idx}" value="${b.cxFosc}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                </div>
            </div>

            <div class="space-y-2 pt-2 border-t border-slate-200">
                <label class="block text-[11px] font-bold text-slate-800 uppercase">Desfecho ${qtdTotal > 1 ? `deste Bloco` : `da Atividade`}: <span class="text-red-600">*</span></label>
                <div class="grid grid-cols-3 gap-2">
                    <button type="button" onclick="selecionarDesfechoBloco(${idx}, 'CONCLUIDA')" class="${btnConcClass} font-bold p-2 rounded-lg text-[11px] transition">CONCLUÍDA</button>
                    <button type="button" onclick="selecionarDesfechoBloco(${idx}, 'PENDENTE')" class="${btnPendClass} font-bold p-2 rounded-lg text-[11px] transition">PENDENTE</button>
                    <button type="button" onclick="selecionarDesfechoBloco(${idx}, 'MALOGRADA')" class="${btnMaloClass} font-bold p-2 rounded-lg text-[11px] transition">MALOGRADA</button>
                </div>

                <div class="${d === 'CONCLUIDA' ? '' : 'hidden'} space-y-2 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    <label class="block text-[11px] font-bold text-emerald-900">Houve Serviço de Obra?</label>
                    <select id="bloco-servico-obra-${idx}" class="w-full text-xs border border-emerald-300 rounded-lg p-2 bg-white outline-none">
                        <option value="SIM" ${b.servicoObra === 'SIM' ? 'selected' : ''}>SIM</option>
                        <option value="NÃO" ${b.servicoObra === 'NÃO' ? 'selected' : ''}>NÃO</option>
                    </select>
                    <label class="block text-[11px] font-bold text-emerald-900 mt-1">Itens Verificados / Entregues (Marcação Múltipla):</label>
                    <div class="grid grid-cols-1 gap-1 text-[11px] bg-white p-2 rounded-lg border border-emerald-200">
                        ${checkboxesConcluidaHtml}
                    </div>
                    <label class="block text-[11px] font-semibold text-emerald-900">Informação Complementar (Opcional)</label>
                    <input type="text" id="bloco-obs-conc-${idx}" value="${b.obsConcluida}" class="w-full text-xs border border-emerald-300 rounded-lg p-2 bg-white" placeholder="Detalhe opcional...">
                </div>

                <div class="${d === 'PENDENTE' ? '' : 'hidden'} space-y-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <label class="block text-[11px] font-bold text-amber-900">Selecione a(s) Opção(ões) da Pendência (Marcação Múltipla):*</label>
                    <div class="grid grid-cols-1 gap-1 text-[11px] bg-white p-2 rounded-lg border border-amber-200 max-h-36 overflow-y-auto">
                        ${checkboxesPendenciaHtml}
                    </div>
                    <label class="block text-[11px] font-bold text-amber-900 mt-1">Descrição / Motivo da Pendência (Obrigatório)*</label>
                    <textarea id="bloco-obs-pend-${idx}" rows="2" class="w-full text-xs border border-amber-300 rounded-lg p-2 bg-white" placeholder="Descreva o motivo...">${b.obsPendente}</textarea>
                </div>

                <div class="${d === 'MALOGRADA' ? '' : 'hidden'} space-y-2 bg-red-50 p-2.5 rounded-xl border border-red-200">
                    <label class="block text-[11px] font-bold text-red-900">Selecione o(s) Ofensor(es) / Malogro(s) (Marcação Múltipla):*</label>
                    <div class="grid grid-cols-1 gap-1 text-[11px] bg-white p-2 rounded-lg border border-red-200 max-h-40 overflow-y-auto">
                        ${checkboxesMalogroHtml}
                    </div>
                    <label class="block text-[11px] font-bold text-red-900 mt-1">Descrição / Motivo do Malogro (Obrigatório)*</label>
                    <textarea id="bloco-obs-malo-${idx}" rows="2" class="w-full text-xs border border-red-300 rounded-lg p-2 bg-white" placeholder="Descreva o motivo...">${b.obsMalograda}</textarea>
                </div>
            </div>

            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                <div class="flex justify-between items-center">
                    <label class="text-[11px] font-bold text-blue-950 flex items-center gap-1">📷 Fotos da Galeria (${b.fotos.length}/10)</label>
                    <label class="bg-blue-900 hover:bg-blue-950 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer shadow-sm transition">
                        📂 + Anexar da Galeria
                        <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png" multiple onchange="aoSelecionarFotosBloco(${idx}, this)" class="hidden">
                    </label>
                </div>
                ${b.fotos.length > 0 ? `<div class="flex flex-wrap gap-2 pt-1">${miniaturasFotosHtml}</div>` : `<p class="text-[10px] text-slate-400">Nenhuma foto anexada neste bloco (Máx. 10 fotos).</p>`}
            </div>

            <div>
                <label class="block text-[11px] font-semibold text-slate-600">Observações Gerais ${qtdTotal > 1 ? `(${b.identificacao})` : ''}</label>
                <textarea id="bloco-observacoes-${idx}" rows="2" class="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none" placeholder="Ocorrências...">${b.observacoes}</textarea>
            </div>
        `;
        container.appendChild(card);
    });
    forcarInputsFotoApenasGaleria();
}

// ================= RASCUNHO, CHECK-IN E SALVAMENTO COMPLETO =================
function salvarRascunhoCampo() {
    try {
        const posAberturaVisivel = !document.getElementById('bloco-pos-abertura').classList.contains('hidden');
        if (posAberturaVisivel) lerDadosBlocosDaTela();
        const rascunho = {
            emAndamento: posAberturaVisivel,
            idEmAndamento: dadosAtendimento.idEmAndamento,
            _projetoTravado: dadosAtendimento._projetoTravado || '',
            _imovelTravado: dadosAtendimento._imovelTravado || '',
            eraReaberta: dadosAtendimento.eraReaberta || false,
            eraProgramada: dadosAtendimento.eraProgramada || false,
            emPausa: dadosAtendimento.emPausa || false,
            inicioPausa: dadosAtendimento.inicioPausa || null,
            motivoPausaAtual: dadosAtendimento.motivoPausaAtual || "",
            minutosPausados: dadosAtendimento.minutosPausados || 0,
            equipe: document.getElementById('sel-equipe')?.value || '',
            projeto: dadosAtendimento._projetoTravado || document.getElementById('sel-projeto')?.value || '',
            imovel: dadosAtendimento._imovelTravado || document.getElementById('inp-imovel')?.value || '',
            hEntrada: document.getElementById('lbl-h-entrada')?.innerText || '',
            gpsEntrada: dadosAtendimento.gpsEntrada,
            endereco: document.getElementById('form-endereco')?.value || '',
            liberouAcesso: document.getElementById('form-liberou-acesso')?.value || '',
            responsavel: document.getElementById('form-responsavel')?.value || '',
            contato: document.getElementById('form-contato')?.value || '',
            email: document.getElementById('form-email')?.value || '',
            qtdBlocos: document.getElementById('inp-qtd-blocos')?.value || 1,
            blocos: dadosAtendimento.blocos
        };
        localStorage.setItem('gpd_rascunho_campo_ativo', JSON.stringify(rascunho));
    } catch (e) {}
}

function atualizarProjetosPermitidosCampo(nomeEquipe, projetoPreSelecionado = null) {
    const selProj = document.getElementById('sel-projeto');
    const badgeSetor = document.getElementById('badge-setor-campo');
    if (!selProj) return;

    if (!nomeEquipe) {
        selProj.innerHTML = `<option value="">Selecione primeiro o técnico acima...</option>`;
        if (badgeSetor) {
            badgeSetor.className = "text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600";
            badgeSetor.innerText = "Selecione o técnico";
        }
        return;
    }

    if (!TODOS_OS_PROJETOS || TODOS_OS_PROJETOS.length === 0) {
        if (typeof reconstruirMapasDeProjetosDinamicos === "function") reconstruirMapasDeProjetosDinamicos(false);
    }

    const eqObj = (equipesSistema || []).find(e => e.nome === nomeEquipe);
    const setoresArr = obterArraySetores(eqObj ? eqObj.setor : "Instalador");
    let listaProjetos = obterProjetosPermitidosParaSetores(setoresArr);
    if (!listaProjetos || listaProjetos.length === 0) {
        listaProjetos = TODOS_OS_PROJETOS.length > 0 ? TODOS_OS_PROJETOS : ["VISTORIA", "CONSTRUÇÃO F", "CONSTRUÇÃO ON GOING"];
    }

    if (badgeSetor) {
        badgeSetor.className = "text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-950 border border-indigo-300";
        badgeSetor.innerText = `Grupos: ${setoresArr.join(' + ')}`;
    }

    if (setoresArr.length > 1) {
        selProj.innerHTML = setoresArr.map(s => {
            const projs = PROJETOS_POR_SETOR[s] || [];
            return `<optgroup label="Função: ${s.toUpperCase()}">${projs.map(p => `<option value="${p}">${p} (${obterMacroGrupoProjeto(p)})</option>`).join('')}</optgroup>`;
        }).join('');
    } else {
        selProj.innerHTML = listaProjetos.map(p => `<option value="${p}">${p} (${obterMacroGrupoProjeto(p)})</option>`).join('');
    }

    const projNorm = projetoPreSelecionado ? normalizarNomeProjeto(projetoPreSelecionado) : null;
    if (projNorm && listaProjetos.includes(projNorm)) {
        selProj.value = projNorm;
    } else if (projNorm) {
        selProj.innerHTML += `<option value="${projNorm}">${projNorm}</option>`;
        selProj.value = projNorm;
    } else if (listaProjetos.length > 0) {
        selProj.value = listaProjetos[0];
    }
    mudarTipoProjeto();
}

function restaurarRascunhoCampo() {
    try {
        renderizarBannerFilaOfflineCampo();
        organizarTelaPrincipalEBotaoSuporteRodape();
        const salvo = localStorage.getItem('gpd_rascunho_campo_ativo');
        if (!salvo) {
            if (equipeAutenticadaSessao) {
                const selEq = document.getElementById('sel-equipe');
                if (selEq) selEq.value = equipeAutenticadaSessao;
                document.getElementById('current-user-team').innerText = equipeAutenticadaSessao;
                atualizarProjetosPermitidosCampo(equipeAutenticadaSessao);
                atualizarBarraSegurancaPinCampo();
                atualizarBarraExpedienteCampo();
                renderizarResumoSolicitacoesCampo();
            }
            return;
        }
        const r = JSON.parse(salvo);

        if (r && r.equipe) {
            const selEq = document.getElementById('sel-equipe');
            if (selEq) selEq.value = r.equipe;
            document.getElementById('current-user-team').innerText = r.equipe;
            equipeAutenticadaSessao = r.equipe;
            sessionStorage.setItem('gpd_equipe_autenticada_pin', r.equipe);
            atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
            atualizarBarraSegurancaPinCampo();
            atualizarBarraExpedienteCampo();
            renderizarResumoSolicitacoesCampo();
        }
        if (r && r.imovel) document.getElementById('inp-imovel').value = r.imovel;

        if (r && r.emAndamento) {
            dadosAtendimento.idEmAndamento = r.idEmAndamento || Date.now();
            dadosAtendimento._projetoTravado = r._projetoTravado || r.projeto || '';
            dadosAtendimento._imovelTravado = r._imovelTravado || r.imovel || '';
            dadosAtendimento.eraReaberta = r.eraReaberta || false;
            dadosAtendimento.eraProgramada = r.eraProgramada || false;
            dadosAtendimento.emPausa = r.emPausa || false;
            dadosAtendimento.inicioPausa = r.inicioPausa || null;
            dadosAtendimento.motivoPausaAtual = r.motivoPausaAtual || "";
            dadosAtendimento.minutosPausados = Number(r.minutosPausados) || 0;
            dadosAtendimento.hEntrada = r.hEntrada;
            dadosAtendimento.gpsEntrada = r.gpsEntrada;
            dadosAtendimento.blocos = (Array.isArray(r.blocos) && r.blocos.length > 0) ? r.blocos : [criarObjetoBlocoPadrao(1)];

            const projAberto = dadosAtendimento._projetoTravado || document.getElementById('sel-projeto').value || normalizarNomeProjeto(r.projeto);
            document.getElementById('lbl-imovel-aberto').innerText = `${r.imovel} (${projAberto})`;
            document.getElementById('lbl-h-entrada').innerText = r.hEntrada || '-';
            document.getElementById('lbl-gps-entrada').innerText = r.gpsEntrada || '-';

            document.getElementById('form-endereco').value = r.endereco || '';
            if (document.getElementById('form-liberou-acesso')) document.getElementById('form-liberou-acesso').value = r.liberouAcesso || '';
            document.getElementById('form-responsavel').value = r.responsavel || '';
            document.getElementById('form-contato').value = r.contato || '';
            document.getElementById('form-email').value = r.email || '';
            document.getElementById('inp-qtd-blocos').value = dadosAtendimento.blocos.length;

            document.getElementById('form-campo-container').classList.add('hidden');
            document.getElementById('bloco-pos-abertura').classList.remove('hidden');
            mudarTipoProjeto();
            renderizarBlocosCampo();
            sincronizarVisualPausaCampo();
        }
    } catch (e) {
        localStorage.removeItem('gpd_rascunho_campo_ativo');
    }
}

async function cancelarCheckinAberto() {
    if (!confirm("Deseja realmente cancelar a abertura atual e retornar ao seu perfil no Modo Campo?")) return;

    const idAtivo = dadosAtendimento.idEmAndamento;
    if (idAtivo) {
        const regNuvem = (registrosSalvos || []).find(r => r.id === idAtivo);
        const veioDeProgramada = dadosAtendimento.eraProgramada ||
            (regNuvem && ((regNuvem.motivoDesfecho || '').includes('[ORIGEM:PROGRAMADA]') || (regNuvem.motivoDesfecho || '').includes('programada iniciada')));

        if (dadosAtendimento.eraReaberta) {
            await supabaseClient.from('registros_producao').update({ desfecho: "REABERTA" }).eq('id', idAtivo);
        } else if (veioDeProgramada) {
            await supabaseClient.from('registros_producao').update({
                desfecho: "PROGRAMADA",
                h_entrada: "Programada",
                h_saida: "Aguardando",
                gps_entrada: "Carga Gestor",
                motivo_desfecho: "Carga Programada (Retornada à fila pelo técnico)"
            }).eq('id', idAtivo);
        } else {
            await supabaseClient.from('registros_producao').delete().eq('id', idAtivo);
        }
    }

    resetarFormularioCampo();
    await carregarRegistrosModoCampoLeve();
    verificarImprevistoAtivoEquipeCampo();
    verificarPendenciasReabertasEProgramadasCampo(false);
    atualizarAbaMinhasAtividadesCampo(false);
}

function aoSelecionarEquipeCampo() {
    const selEq = document.getElementById('sel-equipe');
    const eq = selEq ? selEq.value : "";

    if (!eq) {
        pararMonitoramentoContinuoGps();
        equipeAutenticadaSessao = "";
        sessionStorage.removeItem('gpd_equipe_autenticada_pin');
        document.getElementById('current-user-team').innerText = "Selecione Equipe";
        atualizarProjetosPermitidosCampo("");
        atualizarBarraSegurancaPinCampo();
        atualizarBarraExpedienteCampo();
        verificarImprevistoAtivoEquipeCampo();
        verificarPendenciasReabertasEProgramadasCampo(false);
        atualizarAbaMinhasAtividadesCampo(false);
        renderizarResumoSolicitacoesCampo();
        organizarTelaPrincipalEBotaoSuporteRodape();
        return;
    }

    const eqObj = (equipesSistema || []).find(e => e.nome === eq);
    const pinCorreto = obterPinDaEquipe(eqObj);

    if (equipeAutenticadaSessao !== eq) {
        const pinDigitado = prompt(`🔒 AUTENTICAÇÃO DO TÉCNICO\n\nOlá, ${eq}!\nDigite o seu PIN de 4 dígitos para acessar suas atividades:\n(Se for seu primeiro acesso, o PIN padrão é 1234)`);

        if (pinDigitado === null || pinDigitado.trim() !== pinCorreto) {
            if (pinDigitado !== null) alert("❌ PIN incorreto! Acesso negado às atividades deste técnico.");
            selEq.value = "";
            equipeAutenticadaSessao = "";
            sessionStorage.removeItem('gpd_equipe_autenticada_pin');
            document.getElementById('current-user-team').innerText = "Selecione Equipe";
            atualizarProjetosPermitidosCampo("");
            atualizarBarraSegurancaPinCampo();
            atualizarBarraExpedienteCampo();
            verificarImprevistoAtivoEquipeCampo();
            verificarPendenciasReabertasEProgramadasCampo(false);
            atualizarAbaMinhasAtividadesCampo(false);
            renderizarResumoSolicitacoesCampo();
            return;
        }

        equipeAutenticadaSessao = eq;
        sessionStorage.setItem('gpd_equipe_autenticada_pin', eq);
    }

    document.getElementById('current-user-team').innerText = eq;
    atualizarProjetosPermitidosCampo(eq);
    atualizarBarraSegurancaPinCampo();
    atualizarBarraExpedienteCampo();
    salvarRascunhoCampo();
    verificarImprevistoAtivoEquipeCampo();
    verificarPendenciasReabertasEProgramadasCampo(true);
    atualizarAbaMinhasAtividadesCampo(false);
    renderizarResumoSolicitacoesCampo();
    popularOpcoesParceiroApoioCampo();
    verificarSolicitacoesApoioParaTitularCampo();
    organizarTelaPrincipalEBotaoSuporteRodape();
}

function desbloquearTrocaEquipeCampo() {
    const posAberturaVisivel = !document.getElementById('bloco-pos-abertura').classList.contains('hidden');
    if (posAberturaVisivel) {
        alert("⚠️ Você possui um atendimento aberto na tela. Finalize ou cancele o atendimento antes de trocar de técnico.");
        return;
    }
    if (!confirm("Deseja encerrar sua sessão atual e liberar a seleção para outro técnico?")) return;

    pararMonitoramentoContinuoGps();
    equipeAutenticadaSessao = "";
    parceiroApoioPreSelecionadoSuporte = "";
    sessionStorage.removeItem('gpd_equipe_autenticada_pin');
    localStorage.removeItem('gpd_rascunho_campo_ativo');
    const selEq = document.getElementById('sel-equipe');
    if (selEq) { selEq.disabled = false; selEq.value = ""; }
    document.getElementById('current-user-team').innerText = "Selecione Equipe";
    atualizarProjetosPermitidosCampo("");
    atualizarBarraSegurancaPinCampo();
    atualizarBarraExpedienteCampo();
    verificarImprevistoAtivoEquipeCampo();
    verificarPendenciasReabertasEProgramadasCampo(false);
    atualizarAbaMinhasAtividadesCampo(false);
    renderizarResumoSolicitacoesCampo();
}

async function alterarPinPeloTecnicoCampo() {
    const nomeEq = document.getElementById('sel-equipe')?.value;
    if (!nomeEq) return;
    const eqObj = (equipesSistema || []).find(e => e.nome === nomeEq);
    if (!eqObj) return;

    const pinAtualCorreto = obterPinDaEquipe(eqObj);
    const pinAtualInformado = prompt(`🔑 ALTERAR MEU PIN (${nomeEq})\n\nDigite o seu PIN ATUAL:`);
    if (pinAtualInformado === null) return;
    if (pinAtualInformado.trim() !== pinAtualCorreto) { alert("❌ O PIN atual informado está incorreto."); return; }

    const novoPin = prompt("🔑 Digite o NOVO PIN desejado (Exatamente 4 números, ex: 4580):");
    if (novoPin === null) return;
    const novoPinLimpo = novoPin.trim();
    if (!/^\d{4}$/.test(novoPinLimpo)) { alert("⚠️ O novo PIN deve conter exatamente 4 dígitos numéricos."); return; }

    const confPin = prompt("🔑 Confirme digitando novamente o seu NOVO PIN de 4 dígitos:");
    if (confPin === null || confPin.trim() !== novoPinLimpo) { alert("❌ A confirmação não coincide com o novo PIN."); return; }

    eqObj.pin = novoPinLimpo;
    await sincronizarEquipesNaNuvem();
    if (typeof renderizarTabelaEquipes === "function") renderizarTabelaEquipes();
    alert("✅ Seu novo PIN de 4 dígitos foi salvo com sucesso!");
}

async function resetarPinEquipeGestor(idEquipe) {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') return;
    const eqObj = (equipesSistema || []).find(e => e.id === idEquipe);
    if (!eqObj) return;

    const pinAtual = obterPinDaEquipe(eqObj);
    const novoPinGestor = prompt(`🔄 RESETAR PIN DO TÉCNICO: ${eqObj.nome}\n\nPIN Atual: ${pinAtual}\n\nDigite o novo PIN de 4 dígitos:`, "1234");
    if (novoPinGestor === null) return;
    const pinLimpo = novoPinGestor.trim();
    if (!/^\d{4}$/.test(pinLimpo)) { alert("⚠️ O PIN deve ter exatamente 4 números."); return; }

    eqObj.pin = pinLimpo;
    registrarLogAuditoria("RESET DE PIN (GESTOR)", `Gestor ${usuarioLogado} redefiniu o PIN do técnico ${eqObj.nome} para '${pinLimpo}'.`);
    await sincronizarEquipesNaNuvem();
    if (typeof renderizarTabelaEquipes === "function") renderizarTabelaEquipes();
    alert(`✅ O PIN do técnico ${eqObj.nome} foi redefinido para "${pinLimpo}"!`);
}

function verificarPendenciasReabertasEProgramadasCampo(permitirSom = true) {
    const equipeSelecionada = document.getElementById('sel-equipe')?.value;
    const boxReab = document.getElementById('box-reabertas-campo');
    const listaReab = document.getElementById('lista-reabertas-campo');
    const boxProg = document.getElementById('box-programadas-campo');
    const listaProg = document.getElementById('lista-programadas-campo');

    if (!equipeSelecionada) {
        if (boxReab) boxReab.classList.add('hidden');
        if (boxProg) boxProg.classList.add('hidden');
        return;
    }

    const reabertas = (registrosSalvos || []).filter(r => r.equipe === equipeSelecionada && r.desfecho === 'REABERTA');
    const programadas = (registrosSalvos || []).filter(r => r.equipe === equipeSelecionada && r.desfecho === 'PROGRAMADA');

    let chegouNova = false;
    [...reabertas, ...programadas].forEach(item => {
        const chaveNotif = `${item.id}_${item.desfecho}`;
        if (!idsNotificadosNoCelular.has(chaveNotif)) {
            idsNotificadosNoCelular.add(chaveNotif);
            chegouNova = true;
        }
    });

    if (chegouNova && permitirSom) tocarAlertaSonoroCelular();

    if (boxReab && listaReab) {
        if (reabertas.length > 0) {
            listaReab.innerHTML = reabertas.map(r => `
                <div class="bg-white p-2.5 rounded-lg border border-purple-300 flex justify-between items-center gap-2">
                    <div>
                        <div class="font-bold text-purple-950 text-xs">🏢 ${r.imovel} (${r.projeto})</div>
                        <div class="text-[10px] text-slate-500">📍 ${r.endereco || 'Sem endereço'} • Data: ${r.dataRegistro}</div>
                    </div>
                    <button type="button" onclick="retomarAtividadeReabertaCampo(${r.id})" class="bg-purple-700 hover:bg-purple-800 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">
                        ✏️ Editar Agora
                    </button>
                </div>
            `).join('');
            boxReab.classList.remove('hidden');
        } else {
            boxReab.classList.add('hidden');
        }
    }

    if (boxProg && listaProg) {
        if (programadas.length > 0) {
            listaProg.innerHTML = programadas.map(r => {
                const qtdB = r.qtdBlocosProgramados || 1;
                return `
                <div class="bg-white p-2.5 rounded-lg border border-cyan-300 flex justify-between items-center gap-2">
                    <div>
                        <div class="font-bold text-cyan-950 text-xs flex items-center gap-1 flex-wrap">
                            <span>🏢 ${r.imovel}</span>
                            <span class="bg-cyan-100 text-cyan-900 px-1.5 py-0.5 rounded text-[9px]">${r.projeto}</span>
                            <span class="bg-blue-900 text-white px-1.5 py-0.5 rounded text-[9px] font-black">${qtdB} Bloco(s)</span>
                        </div>
                        <div class="text-[10px] text-slate-600 mt-0.5">📍 ${r.endereco || 'Endereço a confirmar'}</div>
                    </div>
                    <button type="button" onclick="iniciarAtividadeProgramadaCampo(${r.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">
                        🚀 Iniciar
                    </button>
                </div>
            `}).join('');
            boxProg.classList.remove('hidden');
        } else {
            boxProg.classList.add('hidden');
        }
    }

    atualizarAbaMinhasAtividadesCampo(false);
}

async function retomarAtividadeReabertaCampo(idReg) {
    const r = (registrosSalvos || []).find(item => item.id === idReg);
    if (!r) return;

    encerrarImprevistosAbertosAoIniciarAtividade(r.equipe, r.gpsEntrada);
    atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
    document.getElementById('sel-projeto').value = r.projeto;
    document.getElementById('inp-imovel').value = r.imovel;

    dadosAtendimento.idEmAndamento = r.id;
    dadosAtendimento._projetoTravado = r.projeto;
    dadosAtendimento._imovelTravado = r.imovel;
    dadosAtendimento.eraReaberta = true;
    dadosAtendimento.eraProgramada = false;
    dadosAtendimento.emPausa = false;
    dadosAtendimento.inicioPausa = null;
    dadosAtendimento.motivoPausaAtual = "";
    dadosAtendimento.minutosPausados = Number(r.tempoPausadoMinutos) || 0;
    dadosAtendimento.hEntrada = r.hEntrada || new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    dadosAtendimento.gpsEntrada = r.gpsEntrada || "Mantido da abertura";

    let fotosRecuperadas = Array.isArray(r.fotos) ? [...r.fotos] : [];
    if (fotosRecuperadas.length === 0 && typeof obterFotosSobDemandaDoRegistro === 'function') {
        fotosRecuperadas = await obterFotosSobDemandaDoRegistro(r.id);
    }

    dadosAtendimento.blocos = [{
        identificacao: "BLOCO 1",
        andares: r.andares || 1,
        hps: r.hps || 1,
        fusoes: r.fusoes || 0,
        conectores: r.conectores || 0,
        caboRL: r.caboRL || 0,
        caboDrop: r.caboDrop || 0,
        nap: r.nap || 0,
        dio: r.dio || 0,
        cxSobrepor: r.cxSobrepor || 0,
        cxEmbutida: r.cxEmbutida || 0,
        cxFosc: r.cxFosc || 0,
        desfecho: "CONCLUIDA",
        servicoObra: r.servicoObra || "SIM",
        concluidasOpcoes: Array.isArray(r.malogros) ? r.malogros : [],
        obsConcluida: r.motivoDesfecho || "",
        obsPendente: r.motivoDesfecho || "",
        pendenciasOpcoes: Array.isArray(r.malogros) ? r.malogros : [],
        obsMalograda: r.motivoDesfecho || "",
        malogros: Array.isArray(r.malogros) ? r.malogros : [],
        observacoes: r.observacoes || "",
        fotos: fotosRecuperadas
    }];

    document.getElementById('lbl-status-execucao-campo').innerText = "🔄 Editando Atividade Reaberta pelo Gestor";
    document.getElementById('lbl-imovel-aberto').innerText = `${r.imovel} (${r.projeto})`;
    document.getElementById('lbl-h-entrada').innerText = dadosAtendimento.hEntrada;
    document.getElementById('lbl-gps-entrada').innerText = dadosAtendimento.gpsEntrada;

    document.getElementById('form-endereco').value = r.endereco || '';
    if (document.getElementById('form-liberou-acesso')) document.getElementById('form-liberou-acesso').value = r.liberouAcesso || '';
    document.getElementById('form-responsavel').value = r.responsavel || '';
    document.getElementById('form-contato').value = r.contato || '';
    document.getElementById('form-email').value = r.email || '';
    document.getElementById('inp-qtd-blocos').value = 1;

    document.getElementById('form-campo-container').classList.add('hidden');
    document.getElementById('box-reabertas-campo').classList.add('hidden');
    document.getElementById('bloco-pos-abertura').classList.remove('hidden');

    mudarTipoProjeto();
    renderizarBlocosCampo();
    sincronizarVisualPausaCampo();
    salvarRascunhoCampo();
}

async function iniciarAtividadeProgramadaCampo(idReg) {
    const r = (registrosSalvos || []).find(item => item.id === idReg);
    if (!r) return;

    atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
    document.getElementById('sel-projeto').value = r.projeto;
    document.getElementById('inp-imovel').value = r.imovel;
    verificarHistoricoReincidenciaImovelCampo(r.imovel);

    let coordReal = "Não capturado";
    try {
        coordReal = await capturarGpsReal(10000);
        const partes = coordReal.split(',').map(s => parseFloat(s.trim()));
        if (partes.length === 2 && !isNaN(partes[0])) {
            await registrarPontoTelemetriaEquipe(r.equipe, partes[0], partes[1], 'DISPONIVEL');
            iniciarMonitoramentoContinuoGps(r.equipe);
        }
    } catch (err) {
        alert("❌ Ative o GPS do celular para iniciar a atividade programada.");
        return;
    }

    await encerrarImprevistosAbertosAoIniciarAtividade(r.equipe, coordReal);

    const horaEntradaAtual = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const hojeISO = obterDataLocalISO();

    await supabaseClient.from('registros_producao').update({
        data_registro: hojeISO,
        h_entrada: horaEntradaAtual,
        h_saida: "Em Andamento",
        gps_entrada: coordReal,
        desfecho: "EM ANDAMENTO",
        motivo_desfecho: "[ORIGEM:PROGRAMADA] Atividade programada iniciada em campo"
    }).eq('id', r.id);

    dadosAtendimento.idEmAndamento = r.id;
    dadosAtendimento._projetoTravado = r.projeto;
    dadosAtendimento._imovelTravado = r.imovel;
    dadosAtendimento.eraReaberta = false;
    dadosAtendimento.eraProgramada = true;
    dadosAtendimento.emPausa = false;
    dadosAtendimento.inicioPausa = null;
    dadosAtendimento.motivoPausaAtual = "";
    dadosAtendimento.minutosPausados = 0
