// ================= CONTROLE DE RASTREIO GPS, WAKE LOCK, FILA OFFLINE E SOLICITAÇÕES =================
let watchIdRastreioGps = null;
let timerEnvioRastreioGps = null;
let wakeLockAtivo = null;
let ultimaCoordRastreioCache = null;
let encerrandoExpedienteEmCurso = false;

let fotosSolicCombustivelTemp = {
    painel: null,
    mapa: null,
    cartao: null
};

// Patch para garantir a nova opção nos itens verificados de Concluída
if (typeof OPCOES_CONCLUIDA_PADRAO !== 'undefined' && Array.isArray(OPCOES_CONCLUIDA_PADRAO)) {
    if (!OPCOES_CONCLUIDA_PADRAO.includes("REDE GPON NÃO CONSTRUÍDA")) {
        OPCOES_CONCLUIDA_PADRAO.push("REDE GPON NÃO CONSTRUÍDA");
    }
}

// Força todos os inputs de imagem a abrirem o seletor da Galeria/Arquivos (evitando estourar a RAM com a câmera no navegador)
function forcarInputsFotoApenasGaleria() {
    try {
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
    } catch (e) {
        console.warn("Aviso WakeLock:", e);
    }
}

function liberarWakeLockTela() {
    try {
        if (wakeLockAtivo) {
            wakeLockAtivo.release();
            wakeLockAtivo = null;
        }
    } catch (e) {
        console.warn("Aviso ao liberar WakeLock:", e);
    }
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

// ================= SOLICITAÇÃO DE COMBUSTÍVEL EXTRA E DE MATERIAL NO MODO CAMPO =================

function validarTecnicoSelecionadoParaSolicitacao() {
    const selEq = document.getElementById('sel-equipe');
    const nomeEq = selEq?.value || equipeAutenticadaSessao || "";
    if (!nomeEq || equipeAutenticadaSessao !== nomeEq) {
        alert("⚠️ Selecione primeiro o seu nome em 'Equipe / Técnico' e digite seu PIN de 4 dígitos para enviar solicitações.");
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
    if (valor) {
        document.getElementById('inp-comb-motivo').value = valor;
    }
}

function atualizarPreviewSlotCombustivel(slot, base64, textoPadrao) {
    const imgEl = document.getElementById(`prev-foto-comb-${slot}`);
    const statusEl = document.getElementById(`status-foto-comb-${slot}`);
    if (base64) {
        if (imgEl) {
            imgEl.src = base64;
            imgEl.classList.remove('hidden');
        }
        if (statusEl) {
            statusEl.innerText = "✅ Foto anexada da galeria com sucesso";
            statusEl.className = "text-[10px] text-emerald-700 font-bold";
        }
    } else {
        if (imgEl) {
            imgEl.src = "";
            imgEl.classList.add('hidden');
        }
        if (statusEl) {
            statusEl.innerText = textoPadrao;
            statusEl.className = "text-[10px] text-slate-500";
        }
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
        console.warn("Erro ao comprimir foto combustível:", e);
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

    if (!placa) {
        alert("⚠️ Informe obrigatoriamente a PLACA do veículo.");
        document.getElementById('inp-comb-placa')?.focus();
        return;
    }
    if (!km || isNaN(Number(km)) || Number(km) <= 0) {
        alert("⚠️ Informe obrigatoriamente o KM ATUAL do veículo.");
        document.getElementById('inp-comb-km')?.focus();
        return;
    }
    if (!fotosSolicCombustivelTemp.painel) {
        alert("⚠️ A foto do PAINEL DO CARRO é obrigatória.");
        return;
    }
    if (!fotosSolicCombustivelTemp.mapa) {
        alert("⚠️ A foto do MAPA DE BORDO é obrigatória.");
        return;
    }

    localStorage.setItem(`gpd_ultima_placa_${nomeEq}`, placa);

    const btn = document.getElementById('btn-enviar-solic-comb');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Enviando solicitação e fotos...";
    }

    let gpsAtual = "Sem GPS no momento";
    try {
        gpsAtual = await capturarGpsReal(5000);
    } catch (e) {}

    const fotosArray = [
        fotosSolicCombustivelTemp.painel,
        fotosSolicCombustivelTemp.mapa
    ];
    if (fotosSolicCombustivelTemp.cartao) {
        fotosArray.push(fotosSolicCombustivelTemp.cartao);
    }

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

        if (btn) {
            btn.disabled = false;
            btn.innerText = "🚀 Enviar Solicitação de Recarga";
        }

        fotosSolicCombustivelTemp = { painel: null, mapa: null, cartao: null };
        fecharModalSolicitacaoCombustivelCampo();
        await carregarRegistrosModoCampoLeve();
        renderizarResumoSolicitacoesCampo();
        alert(`✅ Solicitação de Combustível enviada com sucesso!\n\nPlaca: ${placa} | KM: ${km}\nA gestão já recebeu seu pedido em tempo real.`);
    } catch (err) {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "🚀 Enviar Solicitação de Recarga";
        }
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
        if (qtd > 0) {
            itensPedidos.push(`${inp.dataset.nomeMaterial}: ${qtd}`);
        }
    });

    if (itensPedidos.length === 0) {
        alert("⚠️ Informe a quantidade (maior que zero) em pelo menos 1 item de material.");
        return;
    }

    const obs = (document.getElementById('inp-obs-solic-material')?.value || "").trim();
    const btn = document.getElementById('btn-enviar-solic-mat');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Enviando pedido de material...";
    }

    let gpsAtual = "Sem GPS no momento";
    try {
        gpsAtual = await capturarGpsReal(4000);
    } catch (e) {}

    const hojeISO = obterDataLocalISO();
    const horaAtual = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const resumoPedido = itensPedidos.join(" | ");

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
        motivo_desfecho: resumoPedido,
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

        if (btn) {
            btn.disabled = false;
            btn.innerText = "🚀 Enviar Pedido de Material";
        }

        fecharModalSolicitacaoMaterialCampo();
        await carregarRegistrosModoCampoLeve();
        renderizarResumoSolicitacoesCampo();
        alert(`✅ Pedido de Material enviado com sucesso!\n\nItens solicitados:\n• ${itensPedidos.join('\n• ')}`);
    } catch (err) {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "🚀 Enviar Pedido de Material";
        }
        alert("❌ Erro ao enviar pedido de material: " + (err.message || "Verifique sua conexão."));
    }
}

function renderizarResumoSolicitacoesCampo() {
    const box = document.getElementById('box-status-solicitacoes-campo');
    if (!box) return;

    const nomeEq = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || "";
    if (!nomeEq) {
        box.classList.add('hidden');
        return;
    }

    const minhasSolic = (registrosSalvos || []).filter(r =>
        r.equipe === nomeEq &&
        (r.projeto === PROJETO_SOLIC_COMBUSTIVEL || r.projeto === PROJETO_SOLIC_MATERIAL)
    ).slice(0, 4);

    if (minhasSolic.length === 0) {
        box.classList.add('hidden');
        return;
    }

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
                    Salvo(s) no celular durante queda de sinal 4G. Assim que a conexão estabilizar, clique abaixo ou aguarde o envio automático.
                </p>
            </div>
        </div>
        <button type="button" onclick="sincronizarFilaOfflineCampo(true)" title="Enviar agora os atendimentos que foram salvos sem internet no subsolo/DG para a nuvem do GPD" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2 rounded-lg text-xs transition shadow-sm">
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
            const { error } = await supabaseClient.from('registros_producao').insert(item.registros);
            if (error) {
                restantes.push(item);
            } else {
                enviados++;
            }
        } catch (err) {
            restantes.push(item);
        }
    }

    localStorage.setItem('gpd_fila_offline_campo', JSON.stringify(restantes));
    renderizarBannerFilaOfflineCampo();

    if (enviados > 0) {
        await carregarRegistrosModoCampoLeve();
        atualizarAbaMinhasAtividadesCampo(false);
        if (exibirFeedback) {
            alert(`✅ ${enviados} atendimento(s) da Fila Offline foram sincronizados com sucesso na nuvem!`);
        }
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

        if (imprevistosAbertos.length > 0) {
            imprevistosAbertos.forEach(imp => {
                imp.desfecho = "IMPREVISTO RESOLVIDO";
                imp.hSaida = horaFim;
            });
        }

        const boxImp = document.getElementById('box-imprevisto-ativo-campo');
        if (boxImp) boxImp.classList.add('hidden');
    } catch (e) {
        console.warn("Aviso ao encerrar imprevisto automaticamente:", e);
    }
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

setTimeout(() => {
    const inp = document.getElementById('inp-imovel');
    if (inp) {
        inp.addEventListener('input', (e) => verificarHistoricoReincidenciaImovelCampo(e.target.value));
    }
    renderizarBannerFilaOfflineCampo();
    forcarInputsFotoApenasGaleria();
}, 400);

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
    const turnoAtivoHoje = info && info.data === hojeISO && info.statusTurno === 'DISPONIVEL';
    const turnoEncerradoHoje = info && info.data === hojeISO && info.statusTurno === 'ENCERRADO';

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
        if (lblHoraIni) lblHoraIni.innerText = `Início: ${info.horaInicio || '--:--'}`;
        if (lblInfoGps) {
            lblInfoGps.className = "text-[10px] text-emerald-800 font-semibold leading-tight";
            lblInfoGps.innerText = `📡 Rastreamento GPS Ativo • Último envio: ${info.horaUltimoSinal || '--:--'} (${info.lat ? `${info.lat}, ${info.lng}` : 'Aguardando sinal'})`;
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
            await registrarPontoTelemetriaEquipe(nomeEq, partes[0], partes[1]);
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
        horaFim: statusCustom === 'ENCERRADO' ? horaAgora : (anterior.horaFim || null),
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
        (err) => {
            console.warn("Aviso watchPosition:", err);
        },
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
// ================= ENCERRAMENTO INSTANTÂNEO DE EXPEDIENTE (1 CLIQUE) =================
async function encerrarExpedienteRastreioCampo() {
    if (encerrandoExpedienteEmCurso) return;

    const nomeEq = (document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || "").trim().toUpperCase();
    if (!nomeEq) return;

    const posAberturaVisivel = !document.getElementById('bloco-pos-abertura')?.classList.contains('hidden');
    if (posAberturaVisivel) {
        alert("🚫 NÃO É PERMITIDO ENCERRAR O EXPEDIENTE!\n\nVocê possui uma atividade aberta na sua tela neste momento. Finalize e salve o atendimento (ou cancele a abertura) antes de encerrar o turno.");
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
    if (typeof ultimoDisparoGpsCampoTs !== 'undefined') {
        ultimoDisparoGpsCampoTs = Date.now() + 60000;
    }

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

        if (!latFim && typeof capturarCoordenadaGpsFrescaCampo === 'function') {
            const coordRapida = await Promise.race([
                capturarCoordenadaGpsFrescaCampo(1500),
                new Promise(res => setTimeout(() => res(null), 1500))
            ]);
            if (coordRapida) {
                latFim = coordRapida.lat;
                lngFim = coordRapida.lng;
            }
        }

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
        console.warn("Aviso ao encerrar expediente:", e);
        atualizarBarraExpedienteCampo();
    } finally {
        encerrandoExpedienteEmCurso = false;
        if (btnEnc) {
            btnEnc.disabled = false;
            btnEnc.innerText = "🔴 Encerrar Expediente do Dia";
        }
    }
}

// ================= CENTRAL DE SUPORTE UNIFICADA (COMBINANDO COMBUSTÍVEL, MATERIAL, IMPREVISTO E APOIO) =================
function abrirModalCentralSuporteCampo() {
    const nomeEq = validarTecnicoSelecionadoParaSolicitacao();
    if (!nomeEq) return;

    let modal = document.getElementById('modal-central-suporte-campo');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-central-suporte-campo';
        modal.className = 'fixed inset-0 bg-black/65 backdrop-blur-sm flex justify-center items-center p-4 hidden z-[85]';
        modal.innerHTML = `
            <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                <div class="bg-blue-950 text-white p-4 flex justify-between items-center border-b-4 border-amber-400">
                    <div>
                        <span class="bg-amber-400 text-blue-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Central Operacional</span>
                        <h3 class="font-bold text-base mt-0.5">🛠️ Central de Suporte & Apoio em Campo</h3>
                    </div>
                    <button type="button" onclick="fecharModalCentralSuporteCampo()" class="text-white font-bold text-lg hover:text-red-300">✕</button>
                </div>
                <div class="p-4 sm:p-5 overflow-y-auto space-y-3 text-xs text-slate-700">
                    <div class="bg-blue-50 p-3 rounded-xl border border-blue-200 flex justify-between items-center">
                        <div>
                            <span class="text-[10px] text-blue-800 font-bold uppercase block">Técnico Autenticado</span>
                            <span id="lbl-tec-central-suporte" class="font-black text-blue-950 text-sm">-</span>
                        </div>
                        <span class="bg-emerald-100 text-emerald-900 font-bold px-2.5 py-1 rounded-lg text-[10px]">🟢 Sessão Ativa</span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <button type="button" onclick="fecharModalCentralSuporteCampo(); abrirModalSolicitacaoCombustivelCampo();" class="bg-orange-50 hover:bg-orange-100 border-2 border-orange-300 p-3.5 rounded-xl text-left space-y-1 transition shadow-sm flex flex-col justify-between">
                            <div class="text-xl">⛽</div>
                            <div>
                                <h4 class="font-black text-orange-950 text-xs uppercase">Solicitar Combustível</h4>
                                <p class="text-[10px] text-orange-900 mt-0.5">Enviar fotos do painel, mapa de bordo e km atual.</p>
                            </div>
                        </button>

                        <button type="button" onclick="fecharModalCentralSuporteCampo(); abrirModalSolicitacaoMaterialCampo();" class="bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-300 p-3.5 rounded-xl text-left space-y-1 transition shadow-sm flex flex-col justify-between">
                            <div class="text-xl">🧰</div>
                            <div>
                                <h4 class="font-black text-indigo-950 text-xs uppercase">Solicitar Material</h4>
                                <p class="text-[10px] text-indigo-900 mt-0.5">Pedir cabos, conectores, caixas ou fusões extras.</p>
                            </div>
                        </button>

                        <button type="button" onclick="fecharModalCentralSuporteCampo(); abrirModalImprevisto();" class="bg-red-50 hover:bg-red-100 border-2 border-red-300 p-3.5 rounded-xl text-left space-y-1 transition shadow-sm flex flex-col justify-between">
                            <div class="text-xl">⚠️</div>
                            <div>
                                <h4 class="font-black text-red-950 text-xs uppercase">Informar Imprevisto / Atraso</h4>
                                <p class="text-[10px] text-red-900 mt-0.5">Reportar problemas climáticos, falta de acesso ou bloqueio.</p>
                            </div>
                        </button>

                        <button type="button" onclick="fecharModalCentralSuporteCampo(); abrirModalEntrarEmApoioObraAtivaCampo();" class="bg-purple-50 hover:bg-purple-100 border-2 border-purple-300 p-3.5 rounded-xl text-left space-y-1 transition shadow-sm flex flex-col justify-between">
                            <div class="text-xl">🤝</div>
                            <div>
                                <h4 class="font-black text-purple-950 text-xs uppercase">Atuação Conjunta / Apoio</h4>
                                <p class="text-[10px] text-purple-900 mt-0.5">Solicitar entrada em apoio a um colega em andamento.</p>
                            </div>
                        </button>
                    </div>
                </div>
                <div class="bg-slate-100 p-3.5 border-t flex justify-end">
                    <button type="button" onclick="fecharModalCentralSuporteCampo()" class="bg-slate-800 text-white text-xs px-5 py-2 rounded-xl font-bold">Fechar Central</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('lbl-tec-central-suporte').innerText = nomeEq;
    document.getElementById('modal-central-suporte-campo').classList.remove('hidden');
}

function fecharModalCentralSuporteCampo() {
    document.getElementById('modal-central-suporte-campo')?.classList.add('hidden');
}

// Injeta o botão flutuante ou fixo de "SUPORTE" na tela principal do Modo Campo e limpa botões antigos da tela principal
function injetarBotaoSuporteModoCampo() {
    const formContainer = document.getElementById('form-campo-container');
    if (!formContainer) return;

    // Remove elementos antigos de apoio da tela principal para não duplicar
    ['box-campo-apoio-conjunto', 'btn-modal-combustivel', 'btn-modal-material', 'btn-modal-imprevisto'].forEach(idAntigo => {
        const el = document.getElementById(idAntigo);
        if (el) el.remove();
    });

    if (!document.getElementById('btn-central-suporte-principal')) {
        const btnSuporte = document.createElement('button');
        btnSuporte.type = 'button';
        btnSuporte.id = 'btn-central-suporte-principal';
        btnSuporte.onclick = abrirModalCentralSuporteCampo;
        btnSuporte.className = 'w-full box-border bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-950 hover:to-indigo-950 text-white font-black py-3 px-4 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 mb-3 border-2 border-amber-400';
        btnSuporte.innerHTML = `<span class="text-base">🛠️</span> <span>CENTRAL DE SUPORTE & APOIO (Combustível, Material, Imprevisto, Conjunta)</span>`;

        const btnCheckin = document.getElementById('btn-checkin');
        if (btnCheckin && btnCheckin.parentNode === formContainer) {
            formContainer.insertBefore(btnSuporte, btnCheckin);
        } else {
            formContainer.prepend(btnSuporte);
        }
    }
}

// ================= CAIXA DE VALIDAÇÃO DE PRESENÇA DE APOIO PELO TÉCNICO TITULAR =================
async function verificarSolicitacoesApoioParaTitularCampo() {
    try {
        const titular = (document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || '').trim().toUpperCase();
        let boxValidacao = document.getElementById('box-validacao-apoio-titular-campo');

        const containerLancamento = document.getElementById('subview-campo-lancamento');
        if (containerLancamento && !boxValidacao) {
            boxValidacao = document.createElement('div');
            boxValidacao.id = 'box-validacao-apoio-titular-campo';
            boxValidacao.className = 'w-full box-border bg-amber-50 border-2 border-amber-500 p-3 rounded-xl space-y-2.5 hidden shadow-md mb-3';
            containerLancamento.insertBefore(boxValidacao, containerLancamento.firstChild);
        }
        if (!boxValidacao) return;

        if (!titular || equipeAutenticadaSessao !== titular) {
            boxValidacao.classList.add('hidden');
            return;
        }

        const hojeISO = typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
        const { data: minhasAtividadesHoje } = await supabaseClient
            .from('registros_producao')
            .select('id, imovel, projeto, equipe, membros, desfecho')
            .eq('data_registro', hojeISO)
            .eq('equipe', titular);

        const atividadesComPendentes = (minhasAtividadesHoje || []).filter(r =>
            extrairListaApoiosPendentesDoMembros(r.membros, r.equipe).length > 0
        );

        const ativAbertaAtual = (minhasAtividadesHoje || []).find(r => r.id === dadosAtendimento.idEmAndamento) || (minhasAtividadesHoje || [])[0];
        if (ativAbertaAtual) {
            const jaValidados = extrairListaApoiosDoMembros(ativAbertaAtual.membros, ativAbertaAtual.equipe);
            const lblBadge = document.getElementById('lbl-parceiro-apoio-atual-campo');
            if (lblBadge) {
                lblBadge.innerText = jaValidados.length > 0 ? `✅ Validado: ${jaValidados.join(', ')}` : 'Individual';
            }
        }

        if (atividadesComPendentes.length === 0) {
            boxValidacao.classList.add('hidden');
            return;
        }

        let htmlCards = `
            <div class="flex items-start gap-2">
                <span class="text-lg animate-bounce">🤝</span>
                <div>
                    <h4 class="text-xs font-black text-amber-950 uppercase">Validação de Presença de Equipe de Apoio!</h4>
                    <p class="text-[11px] text-amber-900">Confirme abaixo se o(s) técnico(s) realmente compareceram para apoiar você nesta atividade:</p>
                </div>
            </div>
        `;

        atividadesComPendentes.forEach(at => {
            const pendentes = extrairListaApoiosPendentesDoMembros(at.membros, at.equipe);
            pendentes.forEach(nomeAp => {
                htmlCards += `
                    <div class="bg-white p-2.5 rounded-xl border-2 border-amber-300 shadow-sm space-y-2 w-full box-border">
                        <div class="text-[11px] text-slate-800 break-words">
                            👷 Técnico de Apoio: <b class="text-purple-950 text-xs">${nomeAp}</b><br>
                            🏢 Atividade / Imóvel: <b>${at.imovel}</b> (${at.projeto})
                        </div>
                        <div class="grid grid-cols-2 gap-2 w-full">
                            <button type="button" onclick="responderValidacaoApoioTitularCampo(${at.id}, '${nomeAp}', true)" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 px-2 rounded-lg text-[11px] shadow-sm transition text-center">
                                ✅ Validar Presença
                            </button>
                            <button type="button" onclick="responderValidacaoApoioTitularCampo(${at.id}, '${nomeAp}', false)" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-2 rounded-lg text-[11px] shadow-sm transition text-center">
                                ❌ Recusar Apoio
                            </button>
                        </div>
                    </div>
                `;
            });
        });

        boxValidacao.innerHTML = htmlCards;
        boxValidacao.classList.remove('hidden');
    } catch (e) {
        console.warn("Aviso ao checar validações de apoio:", e);
    }
}

async function responderValidacaoApoioTitularCampo(idAtividade, nomeApoiador, aprovar) {
    try {
        const { data: regBanco, error } = await supabaseClient
            .from('registros_producao')
            .select('*')
            .eq('id', idAtividade)
            .maybeSingle();

        if (error || !regBanco) {
            alert("⚠️ Registro não localizado na nuvem.");
            return;
        }

        let validados = extrairListaApoiosDoMembros(regBanco.membros, regBanco.equipe);
        let pendentes = extrairListaApoiosPendentesDoMembros(regBanco.membros, regBanco.equipe).filter(n => n !== nomeApoiador);

        const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        let obsAtual = regBanco.observacoes || '';

        if (aprovar) {
            if (!validados.includes(nomeApoiador)) validados.push(nomeApoiador);
            obsAtual = `${obsAtual} [APOIO_VALIDADO: Presença de ${nomeApoiador} validada pelo titular ${regBanco.equipe} às ${horaAgora}]`.trim();
        } else {
            obsAtual = `${obsAtual} [APOIO_RECUSADO: Solicitação de ${nomeApoiador} recusada pelo titular ${regBanco.equipe} às ${horaAgora}]`.trim();
        }

        const novoMembros = formatarStringMembrosApoio(regBanco.equipe, validados, pendentes);

        const { error: errUpd } = await supabaseClient
            .from('registros_producao')
            .update({ membros: novoMembros, observacoes: obsAtual })
            .eq('id', idAtividade);

        if (errUpd) throw errUpd;

        const lblBadge = document.getElementById('lbl-parceiro-apoio-atual-campo');
        if (lblBadge) {
            lblBadge.innerText = validados.length > 0 ? `✅ Validado: ${validados.join(', ')}` : 'Individual';
        }

        await carregarRegistrosModoCampoLeve();
        await verificarSolicitacoesApoioParaTitularCampo();

        if (aprovar) {
            alert(`✅ PRESENÇA VALIDADA!\n\nVocê confirmou a presença de ${nomeApoiador} atuando em conjunto na atividade do imóvel ${regBanco.imovel}.`);
        } else {
            alert(`❌ Solicitação de apoio de ${nomeApoiador} foi recusada e removida da atividade.`);
        }
    } catch (e) {
        alert("❌ Erro ao validar apoio: " + e.message);
    }
}

function inicializarInterfaceApoioConjuntoCampo() {
    injetarBotaoSuporteModoCampo();

    const blocoPosAbertura = document.getElementById('bloco-pos-abertura');
    if (blocoPosAbertura && !document.getElementById('barra-apoio-obra-aberta-campo')) {
        const divAberta = document.createElement('div');
        divAberta.id = 'barra-apoio-obra-aberta-campo';
        divAberta.className = 'w-full box-border bg-purple-50 border-2 border-purple-300 p-3 rounded-xl text-xs space-y-2 mb-3 shadow-sm';
        divAberta.innerHTML = `
            <div class="flex flex-wrap justify-between items-center gap-1">
                <span class="font-black text-purple-950 text-[11px] uppercase">🤝 Validar / Incluir Apoio nesta Atividade:</span>
                <span id="lbl-parceiro-apoio-atual-campo" class="text-[10px] font-bold bg-purple-200 text-purple-950 px-2 py-0.5 rounded">Individual</span>
            </div>
            <div class="flex flex-col gap-2 w-full">
                <select id="sel-adicionar-apoio-em-andamento" class="w-full box-border text-xs border border-purple-300 rounded-lg p-2.5 bg-white font-bold text-purple-950 outline-none">
                    <option value="">+ Selecionar equipe de apoio para validar...</option>
                </select>
                <button type="button" onclick="vincularColegaApoioNaObraAbertaCampo()" class="w-full box-border bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 px-3 rounded-lg shadow-sm transition text-center">
                    ✅ Validar Presença da Equipe de Apoio
                </button>
            </div>
        `;
        blocoPosAbertura.insertBefore(divAberta, blocoPosAbertura.firstChild);
    }

    if (!document.getElementById('modal-entrar-apoio-campo')) {
        const modal = document.createElement('div');
        modal.id = 'modal-entrar-apoio-campo';
        modal.className = 'fixed inset-0 bg-black/65 backdrop-blur-sm flex justify-center items-center p-4 hidden z-[82]';
        modal.innerHTML = `
            <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-purple-300 flex flex-col max-h-[90vh]">
                <div class="bg-purple-900 text-white p-4 flex justify-between items-center border-b-4 border-purple-400">
                    <div>
                        <span class="bg-purple-300 text-purple-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Atuação Conjunta • Sujeita à Validação</span>
                        <h3 class="font-bold text-sm mt-0.5">🤝 Solicitar Entrada em Apoio em Atividade</h3>
                    </div>
                    <button type="button" onclick="fecharModalEntrarEmApoioObraAtivaCampo()" class="text-white font-bold text-lg">✕</button>
                </div>
                <div class="p-4 overflow-y-auto space-y-3 text-xs text-slate-700">
                    <div class="bg-purple-50 p-2.5 rounded-xl border border-purple-200 text-[11px] text-purple-950">
                        👷 <b>Técnico Solicitante do Apoio:</b> <span id="lbl-meu-nome-apoio-modal" class="font-black">-</span>
                    </div>
                    <p class="text-[11px] text-slate-600">
                        Selecione a atividade em andamento abaixo. Seu <b>Horário e GPS de chegada</b> serão enviados e o <b>Técnico Titular receberá um alerta na tela dele para validar sua presença</b>:
                    </p>
                    <div id="lista-obras-ativas-para-apoio-campo" class="space-y-2 max-h-64 overflow-y-auto"></div>
                </div>
                <div class="bg-slate-100 p-3 border-t flex justify-end">
                    <button type="button" onclick="fecharModalEntrarEmApoioObraAtivaCampo()" class="bg-slate-400 text-white text-xs px-4 py-2 rounded-xl font-bold">Fechar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    popularOpcoesParceiroApoioCampo();
}

function popularOpcoesParceiroApoioCampo(apenasSincronizar = false) {
    const selTitular = document.getElementById('sel-equipe');
    const titular = (selTitular?.value || equipeAutenticadaSessao || '').trim().toUpperCase();
    const selApoio2 = document.getElementById('sel-adicionar-apoio-em-andamento');

    const equipesAtivas = (typeof equipesSistema !== 'undefined' && Array.isArray(equipesSistema))
        ? equipesSistema.filter(e => e.status === 'Ativo' && e.nome !== titular)
        : [];

    if (selApoio2) {
        const valAnt2 = selApoio2.value;
        selApoio2.innerHTML = `<option value="">+ Selecionar equipe de apoio para validar...</option>` +
            equipesAtivas.map(eq => `<option value="${eq.nome}">🤝 ${eq.nome}</option>`).join('');
        if (valAnt2 && valAnt2 !== titular) selApoio2.value = valAnt2;
    }
}

async function abrirModalEntrarEmApoioObraAtivaCampo() {
    const meuNome = validarTecnicoSelecionadoParaSolicitacao();
    if (!meuNome) return;

    document.getElementById('lbl-meu-nome-apoio-modal').innerText = meuNome;
    const container = document.getElementById('lista-obras-ativas-para-apoio-campo');
    container.innerHTML = `<div class="p-4 text-center text-purple-900 font-bold animate-pulse">☁️ Buscando atividades em andamento hoje...</div>`;
    document.getElementById('modal-entrar-apoio-campo').classList.remove('hidden');

    try {
        const hojeISO = typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
        const { data, error } = await supabaseClient
            .from('registros_producao')
            .select('id, data_registro, equipe, membros, projeto, imovel, h_entrada, desfecho, observacoes')
            .eq('data_registro', hojeISO)
            .in('desfecho', ['EM ANDAMENTO', 'PARALISADA', 'REABERTA']);

        if (error) throw error;

        const atividadesDosColegas = (data || []).filter(r =>
            r.equipe !== '__CONFIG_SISTEMA__' &&
            r.equipe !== meuNome &&
            r.projeto !== 'IMPREVISTO / ATRASO'
        );

        if (atividadesDosColegas.length === 0) {
            container.innerHTML = `<div class="p-4 bg-slate-50 rounded-xl border text-center text-slate-500">Nenhuma atividade de outro técnico está com status "EM ANDAMENTO" hoje neste momento.</div>`;
            return;
        }

        container.innerHTML = atividadesDosColegas.map(at => {
            const validados = extrairListaApoiosDoMembros(at.membros, at.equipe);
            const pendentes = extrairListaApoiosPendentesDoMembros(at.membros, at.equipe);
            const jaValidado = validados.includes(meuNome);
            const jaPendente = pendentes.includes(meuNome);

            let botaoStatusHtml = `<button type="button" onclick="confirmarEntradaApoioObraCampo(${at.id})" class="w-full mt-1 bg-purple-700 hover:bg-purple-800 text-white font-black py-2 rounded-lg text-[11px] shadow-sm transition">🤝 Solicitar Meu Apoio nesta Atividade</button>`;
            if (jaValidado) {
                botaoStatusHtml = `<div class="text-[10px] font-black text-emerald-800 bg-emerald-100 p-1.5 rounded text-center mt-1">✅ Presença já VALIDADA pelo titular ${at.equipe}!</div>`;
            } else if (jaPendente) {
                botaoStatusHtml = `<div class="text-[10px] font-black text-amber-900 bg-amber-100 p-1.5 rounded text-center mt-1 animate-pulse">⏳ Aguardando ${at.equipe} validar sua presença na tela dele...</div>`;
            }

            return `
                <div class="p-3 rounded-xl border-2 ${jaValidado ? 'border-emerald-400 bg-emerald-50/60' : (jaPendente ? 'border-amber-400 bg-amber-50/60' : 'border-purple-200 bg-white')} shadow-sm space-y-1.5">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="font-black text-blue-950 text-xs">🏢 Imóvel: ${at.imovel}</span>
                            <span class="block text-[10px] font-bold text-purple-900">👷 Titular (Validador): ${at.equipe}</span>
                        </div>
                        <span class="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded text-[9px]">${at.projeto}</span>
                    </div>
                    <div class="text-[10px] text-slate-500">🟢 Iniciada às: <b>${at.h_entrada}</b></div>
                    ${botaoStatusHtml}
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = `<div class="p-3 bg-red-50 text-red-700 rounded-xl">Erro ao buscar atividades: ${e.message}</div>`;
    }
}

function fecharModalEntrarEmApoioObraAtivaCampo() {
    document.getElementById('modal-entrar-apoio-campo')?.classList.add('hidden');
}

async function confirmarEntradaApoioObraCampo(idAtividadeAlvo) {
    const meuNome = validarTecnicoSelecionadoParaSolicitacao();
    if (!meuNome) return;

    const coord = await capturarCoordenadaGpsFrescaCampo(7000);
    const gpsStr = coord ? `${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}` : 'GPS Apoio';
    const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const { data: regBanco, error: errBusca } = await supabaseClient
        .from('registros_producao')
        .select('*')
        .eq('id', idAtividadeAlvo)
        .maybeSingle();

    if (errBusca || !regBanco) {
        alert("❌ Não foi possível localizar a atividade na nuvem.");
        return;
    }

    const validados = extrairListaApoiosDoMembros(regBanco.membros, regBanco.equipe);
    const pendentes = extrairListaApoiosPendentesDoMembros(regBanco.membros, regBanco.equipe);
    if (!validados.includes(meuNome) && !pendentes.includes(meuNome)) {
        pendentes.push(meuNome);
    }

    const novoMembros = formatarStringMembrosApoio(regBanco.equipe, validados, pendentes);
    const notaApoio = `[APOIO_CONJUNTO: ${meuNome} entrou em apoio às ${horaAgora} (GPS: ${gpsStr})]`;
    const obsAtual = regBanco.observacoes || '';
    const novaObs = obsAtual.includes(notaApoio) ? obsAtual : `${notaApoio} ${obsAtual}`.trim();

    const { error: errUpd } = await supabaseClient
        .from('registros_producao')
        .update({ membros: novoMembros, observacoes: novaObs })
        .eq('id', idAtividadeAlvo);

    if (errUpd) {
        alert("❌ Erro ao enviar solicitação de apoio: " + errUpd.message);
        return;
    }

    const hojeISO = typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
    const telMeu = (typeof telemetriaEquipes !== 'undefined' && telemetriaEquipes) ? telemetriaEquipes[meuNome] : null;
    if (coord && telMeu && telMeu.data === hojeISO && telMeu.statusTurno === 'DISPONIVEL' && typeof registrarPontoTelemetriaEquipe === 'function') {
        await registrarPontoTelemetriaEquipe(meuNome, coord.lat, coord.lng, 'DISPONIVEL');
    }

    if (typeof carregarRegistrosModoCampoLeve === 'function') await carregarRegistrosModoCampoLeve();
    fecharModalEntrarEmApoioObraAtivaCampo();
    atualizarAbaMinhasAtividadesCampo(false);
    alert(`⏳ SOLICITAÇÃO DE APOIO ENVIADA!\n\nSua chegada na atividade às ${horaAgora} foi registrada.\nPeça ao técnico titular (${regBanco.equipe}) para clicar em "✅ Validar Presença" na tela dele!`);
}

async function vincularColegaApoioNaObraAbertaCampo() {
    const selColega = document.getElementById('sel-adicionar-apoio-em-andamento');
    const nomeColega = selColega ? selColega.value.trim().toUpperCase() : '';
    if (!nomeColega) {
        alert("⚠️ Selecione o nome da equipe/técnico cuja presença você deseja validar nesta atividade.");
        return;
    }

    try {
        if (dadosAtendimento.idEmAndamento) {
            const { data: regAtual } = await supabaseClient
                .from('registros_producao')
                .select('id, equipe, membros, observacoes')
                .eq('id', dadosAtendimento.idEmAndamento)
                .maybeSingle();

            if (regAtual) {
                const listaVal = extrairListaApoiosDoMembros(regAtual.membros, regAtual.equipe);
                const listaPend = extrairListaApoiosPendentesDoMembros(regAtual.membros, regAtual.equipe).filter(n => n !== nomeColega);
                if (!listaVal.includes(nomeColega)) listaVal.push(nomeColega);
                const novoMemb = formatarStringMembrosApoio(regAtual.equipe, listaVal, listaPend);
                const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const obsNova = `${regAtual.observacoes || ''} [APOIO_VALIDADO: Presença de ${nomeColega} validada pelo titular ${regAtual.equipe} às ${horaAgora}]`.trim();

                await supabaseClient.from('registros_producao').update({ membros: novoMemb, observacoes: obsNova }).eq('id', regAtual.id);

                const lblBadge = document.getElementById('lbl-parceiro-apoio-atual-campo');
                if (lblBadge) lblBadge.innerText = `✅ Validado: ${listaVal.join(', ')}`;
            }
        }
        await verificarSolicitacoesApoioParaTitularCampo();
        alert(`✅ Presença da equipe de apoio (${nomeColega}) VALIDADA em conjunto nesta atividade!`);
    } catch (e) {
        console.warn("Aviso ao validar apoio em andamento:", e);
    }
}

function instalarInterceptadoresApoioCampo() {
    if (typeof window.aoSelecionarEquipeCampo === 'function' && !window._apoioHookEquipe) {
        const origEq = window.aoSelecionarEquipeCampo;
        window.aoSelecionarEquipeCampo = function(...args) {
            const res = origEq.apply(this, args);
            injetarBotaoSuporteModoCampo();
            verificarSolicitacoesApoioParaTitularCampo();
            return res;
        };
        window._apoioHookEquipe = true;
    }

    if (typeof window.fazerCheckIn === 'function' && !window._apoioHookCheckIn) {
        const origCheckIn = window.fazerCheckIn;
        window.fazerCheckIn = async function(...args) {
            const parceiroEscolhido = document.getElementById('sel-adicionar-apoio-em-andamento')?.value?.trim().toUpperCase() || '';
            const res = await origCheckIn.apply(this, args);

            const lblBadge = document.getElementById('lbl-parceiro-apoio-atual-campo');
            if (parceiroEscolhido) {
                if (lblBadge) lblBadge.innerText = `✅ Validado: ${parceiroEscolhido}`;
                const selTitular = (document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || '').trim().toUpperCase();
                const novoMembros = formatarStringMembrosApoio(selTitular, [parceiroEscolhido], []);
                if (dadosAtendimento.idEmAndamento) {
                    await supabaseClient.from('registros_producao').update({ membros: novoMembros }).eq('id', dadosAtendimento.idEmAndamento);
                }
            } else if (lblBadge) {
                lblBadge.innerText = 'Individual';
            }
            return res;
        };
        window._apoioHookCheckIn = true;
    }

    if (typeof window.salvarRegistro === 'function' && !window._apoioHookSalvar) {
        const origSalvar = window.salvarRegistro;
        window.salvarRegistro = async function(...args) {
            let validadosNuvem = [];
            if (dadosAtendimento.idEmAndamento) {
                try {
                    const { data: regNuvem } = await supabaseClient
                        .from('registros_producao')
                        .select('id, equipe, membros')
                        .eq('id', dadosAtendimento.idEmAndamento)
                        .maybeSingle();

                    if (regNuvem) {
                        validadosNuvem = extrairListaApoiosDoMembros(regNuvem.membros, regNuvem.equipe);
                        const pendentesNuvem = extrairListaApoiosPendentesDoMembros(regNuvem.membros, regNuvem.equipe);
                        for (const nomePend of pendentesNuvem) {
                            const confirmaPresenca = confirm(
                                `🤝 VALIDAÇÃO DE PRESENÇA DE EQUIPE DE APOIO\n\n` +
                                `O técnico "${nomePend}" registrou entrada de apoio nesta atividade.\n\n` +
                                `Você VALIDA e confirma que "${nomePend}" esteve presente apoiando você nesta atividade?\n` +
                                `(Clique em OK para Validar a presença ou Cancelar para Recusar)`
                            );
                            if (confirmaPresenca && !validadosNuvem.includes(nomePend)) {
                                validadosNuvem.push(nomePend);
                            }
                        }
                    }
                } catch (e) {}
            }

            const parceiro2 = document.getElementById('sel-adicionar-apoio-em-andamento')?.value?.trim().toUpperCase() || '';
            if (parceiro2 && !validadosNuvem.includes(parceiro2)) validadosNuvem.push(parceiro2);

            const titular = (document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || '').trim().toUpperCase();
            const imovelBase = document.getElementById('inp-imovel')?.value?.trim() || '';

            const res = await origSalvar.apply(this, args);

            if (validadosNuvem.length > 0 && titular) {
                if (typeof ultimoResumoCampoTexto === 'string' && ultimoResumoCampoTexto && !ultimoResumoCampoTexto.includes('Apoio Validado')) {
                    ultimoResumoCampoTexto = ultimoResumoCampoTexto.replace(
                        `👷 *Equipe:* ${titular}`,
                        `👷 *Equipe Titular:* ${titular}\n🤝 *Apoio Validado:* ${validadosNuvem.join(', ')}`
                    );
                }

                const hojeISO = typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
                const novoMembros = formatarStringMembrosApoio(titular, validadosNuvem, []);
                const { data: recemSalvos } = await supabaseClient
                    .from('registros_producao')
                    .select('id, imovel, membros')
                    .eq('data_registro', hojeISO)
                    .eq('equipe', titular);

                for (const r of (recemSalvos || [])) {
                    if (!imovelBase || (r.imovel && r.imovel.toUpperCase().startsWith(imovelBase.toUpperCase()))) {
                        await supabaseClient.from('registros_producao').update({ membros: novoMembros }).eq('id', r.id);
                    }
                }
                const selApoio2 = document.getElementById('sel-adicionar-apoio-em-andamento');
                if (selApoio2) selApoio2.value = '';
            }
            await verificarSolicitacoesApoioParaTitularCampo();
            return res;
        };
        window._apoioHookSalvar = true;
    }
}

setTimeout(() => {
    injetarBotaoSuporteModoCampo();
    instalarInterceptadoresApoioCampo();
    iniciarMonitoramentoGpsAntiCongelamento();
    verificarSolicitacoesApoioParaTitularCampo();
}, 450);
