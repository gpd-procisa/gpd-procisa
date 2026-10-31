// ================= CONTROLE DE RASTREIO GPS E WAKE LOCK =================
let watchIdRastreioGps = null;
let timerEnvioRastreioGps = null;
let wakeLockAtivo = null;
let ultimaCoordRastreioCache = null;

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
    const dadosTel = nomeEq ? telemetriaEquipes[nomeEq] : null;
    if (document.visibilityState === 'visible' && dadosTel && dadosTel.data === hojeISO && dadosTel.statusTurno === 'DISPONIVEL') {
        ativarWakeLockTela();
        capturarEEnviarPosicaoRastreio(nomeEq, false);
    }
});

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
    const info = telemetriaEquipes[nomeEq];
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
    registrarLogAuditoria("INÍCIO DE EXPEDIENTE (ROTA)", `Técnico ${nomeEq} iniciou expediente às ${horaAgora} | GPS: ${latIni}, ${lngIni}`);
    alert(`🟢 Expediente iniciado às ${horaAgora}!\nVocê já consta como DISPONÍVEL EM ROTA no mapa da gestão.`);
}

async function encerrarExpedienteRastreioCampo() {
    const nomeEq = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao;
    if (!nomeEq) return;

    const posAberturaVisivel = !document.getElementById('bloco-pos-abertura').classList.contains('hidden');
    if (posAberturaVisivel) {
        alert("⚠️ Você possui um atendimento em andamento na tela. Finalize ou cancele o atendimento antes de encerrar o expediente do dia.");
        return;
    }

    if (!confirm(`🔴 ENCERRAR EXPEDIENTE DO DIA\n\nConfirmar o encerramento do turno de hoje para ${nomeEq}? O compartilhamento de GPS em rota será desligado.`)) {
        return;
    }

    let latFim = ultimaCoordRastreioCache?.lat || telemetriaEquipes[nomeEq]?.lat || null;
    let lngFim = ultimaCoordRastreioCache?.lng || telemetriaEquipes[nomeEq]?.lng || null;

    try {
        const coord = await capturarGpsReal(6000);
        const partes = coord.split(',').map(s => parseFloat(s.trim()));
        if (partes.length === 2 && !isNaN(partes[0])) {
            latFim = partes[0];
            lngFim = partes[1];
        }
    } catch (e) {}

    pararMonitoramentoContinuoGps();
    await registrarPontoTelemetriaEquipe(nomeEq, latFim, lngFim, 'ENCERRADO');

    const horaFim = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    registrarLogAuditoria("FIM DE EXPEDIENTE", `Técnico ${nomeEq} encerrou o expediente às ${horaFim}.`);
    alert(`🔴 Expediente encerrado às ${horaFim}! Bom descanso.`);
}

function comprimirImagemBase64(file, maxWidth = 780, quality = 0.60) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
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
            const base64Comprimida = await comprimirImagemBase64(arq, 780, 0.60);
            bloco.fotos.push(base64Comprimida);
        } catch (e) {
            console.warn("Erro ao processar foto:", e);
        }
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

// ================= SUB-ABAS DO MODO CAMPO (ATENDIMENTO vs MINHAS ATIVIDADES) =================

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
    }
}

async function atualizarAbaMinhasAtividadesCampo(forcarRecarregamentoNuvem = false) {
    if (forcarRecarregamentoNuvem) {
        await carregarRegistrosModoCampoLeve();
    }

    const equipeSelecionada = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || "";
    const container = document.getElementById('lista-minhas-atividades-campo');
    const badgeQtd = document.getElementById('badge-qtd-minhas-ativ');

    if (!container) return;

    if (!equipeSelecionada) {
        if (badgeQtd) badgeQtd.innerText = "0";
        container.innerHTML = `
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center text-xs text-slate-500">
                🔒 Selecione a sua <b>Equipe / Técnico</b> e autentique seu PIN na aba "Atendimento" para visualizar e controlar todas as suas atividades no painel de gestão.
            </div>
        `;
        return;
    }

    const hojeISO = obterDataLocalISO();
    const meusRegistros = registrosSalvos.filter(r => r.equipe === equipeSelecionada && r.projeto !== 'IMPREVISTO / ATRASO');

    const ativasPainel = meusRegistros.filter(r => ['EM ANDAMENTO', 'PARALISADA', 'REABERTA', 'PROGRAMADA'].includes(r.desfecho));
    const finalizadasHoje = meusRegistros.filter(r => r.dataRegistro === hojeISO && ['CONCLUIDA', 'PENDENTE', 'MALOGRADA'].includes(r.desfecho));

    if (badgeQtd) badgeQtd.innerText = ativasPainel.length;

    const ordemPrioridade = { 'EM ANDAMENTO': 1, 'PARALISADA': 2, 'REABERTA': 3, 'PROGRAMADA': 4 };
    ativasPainel.sort((a, b) => (ordemPrioridade[a.desfecho] || 9) - (ordemPrioridade[b.desfecho] || 9));

    let html = "";

    if (ativasPainel.length === 0) {
        html += `
            <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center text-xs text-emerald-900 font-semibold">
                ✅ Você não possui atividades pendentes, programadas ou em aberto na fila do painel neste momento.
            </div>
        `;
    } else {
        html += `<div class="text-[11px] font-black text-slate-700 uppercase px-1">🔥 Ativas / Na Fila do Painel (${ativasPainel.length})</div>`;
        ativasPainel.forEach(r => {
            const corBadge = obterClasseCorDesfecho(r.desfecho);
            const qtdB = r.qtdBlocosProgramados || 1;
            let btnAcao = "";

            if (r.desfecho === 'PROGRAMADA') {
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

function retomarAtividadeEmAndamentoOuParalisadaNuvem(idReg) {
    if (dadosAtendimento.idEmAndamento && dadosAtendimento.idEmAndamento === idReg) {
        mudarSubAbaCampo('lancamento');
        return;
    }

    const r = registrosSalvos.find(item => item.id === idReg);
    if (!r) return;

    atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
    document.getElementById('sel-projeto').value = r.projeto;
    document.getElementById('inp-imovel').value = r.imovel;

    dadosAtendimento.idEmAndamento = r.id;
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

// ================= PARALISAR E RETOMAR ATIVIDADE EM CAMPO =================

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
    registrarLogAuditoria("ATIVIDADE PARALISADA", `Imóvel paralisado às ${horaStr}. Motivo: ${motivoLimpo}`);
    await carregarRegistrosModoCampoLeve();
    atualizarAbaMinhasAtividadesCampo(false);
    alert(`⏸️ Atividade paralisada às ${horaStr}!\nSeus dados preenchidos estão salvos. Clique em "Retomar Atividade Agora" quando voltar ao serviço.`);
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
    registrarLogAuditoria("ATIVIDADE RETOMADA", `Imóvel retomado às ${horaStr}. Tempo paralisado acumulado: ${dadosAtendimento.minutosPausados} min.`);
    await carregarRegistrosModoCampoLeve();
    atualizarAbaMinhasAtividadesCampo(false);
    alert(`▶️ Atividade retomada com sucesso!\nTempo desta pausa: ${minutosDestaPausa} min (Total acumulado: ${dadosAtendimento.minutosPausados} min).`);
}

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

        const checksConc = document.querySelectorAll(`input[name="bloco-concluida-check-${i}"]:checked`);
        b.concluidasOpcoes = Array.from(checksConc).map(c => c.value);

        const checksPend = document.querySelectorAll(`input[name="bloco-pendencia-check-${i}"]:checked`);
        b.pendenciasOpcoes = Array.from(checksPend).map(c => c.value);

        const checksMalo = document.querySelectorAll(`input[name="bloco-malogro-check-${i}"]:checked`);
        b.malogros = Array.from(checksMalo).map(c => c.value);
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
    const container = document.getElementById('container-blocos-dinamicos');
    if (!container) return;
    container.innerHTML = "";

    const qtdTotal = dadosAtendimento.blocos.length;

    dadosAtendimento.blocos.forEach((b, idx) => {
        if (!b.fotos) b.fotos = [];
        if (!b.concluidasOpcoes) b.concluidasOpcoes = [];
        const mostrarIdentBloco = qtdTotal > 1;
        const d = b.desfecho;

        const btnConcClass = d === 'CONCLUIDA' ? 'ring-2 ring-offset-1 ring-emerald-700 bg-emerald-700 text-white' : 'bg-emerald-600/90 text-white opacity-80';
        const btnPendClass = d === 'PENDENTE' ? 'ring-2 ring-offset-1 ring-amber-600 bg-amber-600 text-white' : 'bg-amber-500/90 text-white opacity-80';
        const btnMaloClass = d === 'MALOGRADA' ? 'ring-2 ring-offset-1 ring-red-700 bg-red-700 text-white' : 'bg-red-600/90 text-white opacity-80';

        const checkboxesConcluidaHtml = OPCOES_CONCLUIDA_PADRAO.map(op => {
            const checked = (b.concluidasOpcoes && b.concluidasOpcoes.includes(op)) ? 'checked' : '';
            return `<label class="flex items-center gap-1.5"><input type="checkbox" name="bloco-concluida-check-${idx}" value="${op}" ${checked}> ${op}</label>`;
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
                    <label class="text-[11px] font-bold text-blue-950 flex items-center gap-1">📷 Fotos do Fechamento (${b.fotos.length}/10)</label>
                    <label class="bg-blue-900 hover:bg-blue-950 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer shadow-sm transition">
                        + Tirar / Anexar Foto
                        <input type="file" accept="image/*" multiple onchange="aoSelecionarFotosBloco(${idx}, this)" class="hidden">
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
}

function salvarRascunhoCampo() {
    const posAberturaVisivel = !document.getElementById('bloco-pos-abertura').classList.contains('hidden');
    if (posAberturaVisivel) {
        lerDadosBlocosDaTela();
    }
    const rascunho = {
        emAndamento: posAberturaVisivel,
        idEmAndamento: dadosAtendimento.idEmAndamento,
        eraReaberta: dadosAtendimento.eraReaberta || false,
        eraProgramada: dadosAtendimento.eraProgramada || false,
        emPausa: dadosAtendimento.emPausa || false,
        inicioPausa: dadosAtendimento.inicioPausa || null,
        motivoPausaAtual: dadosAtendimento.motivoPausaAtual || "",
        minutosPausados: dadosAtendimento.minutosPausados || 0,
        equipe: document.getElementById('sel-equipe').value,
        projeto: document.getElementById('sel-projeto').value,
        imovel: document.getElementById('inp-imovel').value,
        hEntrada: document.getElementById('lbl-h-entrada').innerText,
        gpsEntrada: dadosAtendimento.gpsEntrada,
        endereco: document.getElementById('form-endereco')?.value || '',
        liberouAcesso: document.getElementById('form-liberou-acesso')?.value || '',
        responsavel: document.getElementById('form-responsavel')?.value || '',
        contato: document.getElementById('form-contato')?.value || '',
        email: document.getElementById('form-email')?.value || '',
        qtdBlocos: document.getElementById('inp-qtd-blocos')?.value || 1,
        blocos: dadosAtendimento.blocos
    };
    try {
        localStorage.setItem('gpd_rascunho_campo_ativo', JSON.stringify(rascunho));
    } catch (e) {
        console.warn("Aviso ao salvar rascunho local:", e);
    }
}

function restaurarRascunhoCampo() {
    try {
        const salvo = localStorage.getItem('gpd_rascunho_campo_ativo');
        if (!salvo) {
            if (equipeAutenticadaSessao) {
                const selEq = document.getElementById('sel-equipe');
                if (selEq) selEq.value = equipeAutenticadaSessao;
                document.getElementById('current-user-team').innerText = equipeAutenticadaSessao;
                atualizarProjetosPermitidosCampo(equipeAutenticadaSessao);
                atualizarBarraSegurancaPinCampo();
                atualizarBarraExpedienteCampo();
            }
            return;
        }
        const r = JSON.parse(salvo);

        if (r.equipe) {
            document.getElementById('sel-equipe').value = r.equipe;
            document.getElementById('current-user-team').innerText = r.equipe;
            equipeAutenticadaSessao = r.equipe;
            sessionStorage.setItem('gpd_equipe_autenticada_pin', r.equipe);
            atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
            atualizarBarraSegurancaPinCampo();
            atualizarBarraExpedienteCampo();
        }
        if (r.imovel) document.getElementById('inp-imovel').value = r.imovel;

        if (r.emAndamento) {
            dadosAtendimento.idEmAndamento = r.idEmAndamento || null;
            dadosAtendimento.eraReaberta = r.eraReaberta || false;
            dadosAtendimento.eraProgramada = r.eraProgramada || false;
            dadosAtendimento.emPausa = r.emPausa || false;
            dadosAtendimento.inicioPausa = r.inicioPausa || null;
            dadosAtendimento.motivoPausaAtual = r.motivoPausaAtual || "";
            dadosAtendimento.minutosPausados = Number(r.minutosPausados) || 0;
            dadosAtendimento.hEntrada = r.hEntrada;
            dadosAtendimento.gpsEntrada = r.gpsEntrada;
            dadosAtendimento.blocos = (Array.isArray(r.blocos) && r.blocos.length > 0) ? r.blocos : [criarObjetoBlocoPadrao(1)];

            const projAberto = document.getElementById('sel-projeto').value || normalizarNomeProjeto(r.projeto);
            document.getElementById('lbl-imovel-aberto').innerText = `${r.imovel} (${projAberto})`;
            document.getElementById('lbl-h-entrada').innerText = r.hEntrada || '-';
            document.getElementById('lbl-gps-entrada').innerText = r.gpsEntrada || '-';

            document.getElementById('form-endereco').value = r.endereco || '';
            if (document.getElementById('form-liberou-acesso')) {
                document.getElementById('form-liberou-acesso').value = r.liberouAcesso || '';
            }
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
        console.warn("Erro ao restaurar rascunho de campo:", e);
    }
}

async function cancelarCheckinAberto() {
    if (!confirm("Deseja realmente cancelar a abertura atual e retornar ao seu perfil no Modo Campo?")) return;

    const idAtivo = dadosAtendimento.idEmAndamento;
    if (idAtivo) {
        const regNuvem = registrosSalvos.find(r => r.id === idAtivo);
        const veioDeProgramada = dadosAtendimento.eraProgramada ||
            (regNuvem && ((regNuvem.motivoDesfecho || '').includes('[ORIGEM:PROGRAMADA]') || (regNuvem.motivoDesfecho || '').includes('programada iniciada')));

        if (dadosAtendimento.eraReaberta) {
            await supabaseClient.from('registros_producao').update({
                desfecho: "REABERTA"
            }).eq('id', idAtivo);
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
        return;
    }

    const eqObj = equipesSistema.find(e => e.nome === eq);
    const pinCorreto = obterPinDaEquipe(eqObj);

    if (equipeAutenticadaSessao !== eq) {
        const pinDigitado = prompt(`🔒 AUTENTICAÇÃO DO TÉCNICO\n\nOlá, ${eq}!\nDigite o seu PIN de 4 dígitos para acessar suas atividades:\n(Se for seu primeiro acesso, o PIN padrão é 1234)`);
        
        if (pinDigitado === null || pinDigitado.trim() !== pinCorreto) {
            if (pinDigitado !== null) {
                alert("❌ PIN incorreto! Acesso negado às atividades deste técnico.");
            }
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
    sessionStorage.removeItem('gpd_equipe_autenticada_pin');
    localStorage.removeItem('gpd_rascunho_campo_ativo');
    const selEq = document.getElementById('sel-equipe');
    if (selEq) {
        selEq.disabled = false;
        selEq.value = "";
    }
    document.getElementById('current-user-team').innerText = "Selecione Equipe";
    atualizarProjetosPermitidosCampo("");
    atualizarBarraSegurancaPinCampo();
    atualizarBarraExpedienteCampo();
    verificarImprevistoAtivoEquipeCampo();
    verificarPendenciasReabertasEProgramadasCampo(false);
    atualizarAbaMinhasAtividadesCampo(false);
}

async function alterarPinPeloTecnicoCampo() {
    const nomeEq = document.getElementById('sel-equipe')?.value;
    if (!nomeEq) return;

    const eqObj = equipesSistema.find(e => e.nome === nomeEq);
    if (!eqObj) return;

    const pinAtualCorreto = obterPinDaEquipe(eqObj);
    const pinAtualInformado = prompt(`🔑 ALTERAR MEU PIN (${nomeEq})\n\nDigite o seu PIN ATUAL:`);
    if (pinAtualInformado === null) return;

    if (pinAtualInformado.trim() !== pinAtualCorreto) {
        alert("❌ O PIN atual informado está incorreto.");
        return;
    }

    const novoPin = prompt("🔑 Digite o NOVO PIN desejado (Exatamente 4 números, ex: 4580):");
    if (novoPin === null) return;

    const novoPinLimpo = novoPin.trim();
    if (!/^\d{4}$/.test(novoPinLimpo)) {
        alert("⚠️ O novo PIN deve conter exatamente 4 dígitos numéricos (ex: 2580).");
        return;
    }

    const confPin = prompt("🔑 Confirme digitando novamente o seu NOVO PIN de 4 dígitos:");
    if (confPin === null || confPin.trim() !== novoPinLimpo) {
        alert("❌ A confirmação não coincide com o novo PIN. Operação cancelada.");
        return;
    }

    eqObj.pin = novoPinLimpo;
    registrarLogAuditoria("ALTERAÇÃO DE PIN (CAMPO)", `O técnico ${eqObj.nome} alterou seu próprio PIN de acesso no Modo Campo.`);
    await sincronizarEquipesNaNuvem();
    if (typeof renderizarTabelaEquipes === "function") renderizarTabelaEquipes();
    alert("✅ Seu novo PIN de 4 dígitos foi salvo e sincronizado na nuvem com sucesso!");
}

async function resetarPinEquipeGestor(idEquipe) {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') {
        alert("⚠️ Apenas Gestores (Master ou Operador) podem resetar o PIN de um técnico.");
        return;
    }

    const eqObj = equipesSistema.find(e => e.id === idEquipe);
    if (!eqObj) return;

    const pinAtual = obterPinDaEquipe(eqObj);
    const novoPinGestor = prompt(
        `🔄 RESETAR PIN DO TÉCNICO: ${eqObj.nome}\n\nPIN Atual: ${pinAtual}\n\nDigite o novo PIN de 4 dígitos para este técnico (ou mantenha 1234 para o padrão):`,
        "1234"
    );
    if (novoPinGestor === null) return;

    const pinLimpo = novoPinGestor.trim();
    if (!/^\d{4}$/.test(pinLimpo)) {
        alert("⚠️ O PIN deve ter exatamente 4 números (ex: 1234).");
        return;
    }

    eqObj.pin = pinLimpo;
    registrarLogAuditoria("RESET DE PIN (GESTOR)", `Gestor ${usuarioLogado} redefiniu o PIN do técnico ${eqObj.nome} para '${pinLimpo}'.`);
    await sincronizarEquipesNaNuvem();
    if (typeof renderizarTabelaEquipes === "function") renderizarTabelaEquipes();
    alert(`✅ O PIN do técnico ${eqObj.nome} foi redefinido para "${pinLimpo}" com sucesso!`);
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

    const reabertas = registrosSalvos.filter(r => r.equipe === equipeSelecionada && r.desfecho === 'REABERTA');
    const programadas = registrosSalvos.filter(r => r.equipe === equipeSelecionada && r.desfecho === 'PROGRAMADA');

    let chegouNova = false;
    [...reabertas, ...programadas].forEach(item => {
        const chaveNotif = `${item.id}_${item.desfecho}`;
        if (!idsNotificadosNoCelular.has(chaveNotif)) {
            idsNotificadosNoCelular.add(chaveNotif);
            chegouNova = true;
        }
    });

    if (chegouNova && permitirSom) {
        tocarAlertaSonoroCelular();
    }

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
                        <div class="text-[9px] text-slate-500">Andares: <b>${r.andares || '-'}</b> | HPs: <b>${r.hps || '-'}</b> ${r.responsavel ? `| Resp: <b>${r.responsavel}</b>` : ''}</div>
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

function retomarAtividadeReabertaCampo(idReg) {
    const r = registrosSalvos.find(item => item.id === idReg);
    if (!r) return;

    atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
    document.getElementById('sel-projeto').value = r.projeto;
    document.getElementById('inp-imovel').value = r.imovel;

    dadosAtendimento.idEmAndamento = r.id;
    dadosAtendimento.eraReaberta = true;
    dadosAtendimento.eraProgramada = false;
    dadosAtendimento.emPausa = false;
    dadosAtendimento.inicioPausa = null;
    dadosAtendimento.motivoPausaAtual = "";
    dadosAtendimento.minutosPausados = Number(r.tempoPausadoMinutos) || 0;
    dadosAtendimento.hEntrada = r.hEntrada || new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    dadosAtendimento.gpsEntrada = r.gpsEntrada || "Mantido da abertura";

    const blocoRecuperado = {
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
        fotos: Array.isArray(r.fotos) ? [...r.fotos] : []
    };

    dadosAtendimento.blocos = [blocoRecuperado];

    document.getElementById('lbl-status-execucao-campo').innerText = "🔄 Editando Atividade Reaberta pelo Gestor";
    document.getElementById('lbl-imovel-aberto').innerText = `${r.imovel} (${r.projeto})`;
    document.getElementById('lbl-h-entrada').innerText = dadosAtendimento.hEntrada;
    document.getElementById('lbl-gps-entrada').innerText = dadosAtendimento.gpsEntrada;

    document.getElementById('form-endereco').value = r.endereco || '';
    if (document.getElementById('form-liberou-acesso')) {
        document.getElementById('form-liberou-acesso').value = r.liberouAcesso || '';
    }
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
    const r = registrosSalvos.find(item => item.id === idReg);
    if (!r) return;

    atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
    document.getElementById('sel-projeto').value = r.projeto;
    document.getElementById('inp-imovel').value = r.imovel;

    let coordReal = "Não capturado";
    try {
        coordReal = await capturarGpsReal(10000);
        const partes = coordReal.split(',').map(s => parseFloat(s.trim()));
        if (partes.length === 2 && !isNaN(partes[0])) {
            await registrarPontoTelemetriaEquipe(r.equipe, partes[0], partes[1], 'DISPONIVEL');
        }
    } catch (err) {
        alert("❌ Ative o GPS do celular para iniciar a atividade programada.");
        return;
    }

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
    dadosAtendimento.eraReaberta = false;
    dadosAtendimento.eraProgramada = true;
    dadosAtendimento.emPausa = false;
    dadosAtendimento.inicioPausa = null;
    dadosAtendimento.motivoPausaAtual = "";
    dadosAtendimento.minutosPausados = 0;
    dadosAtendimento.hEntrada = horaEntradaAtual;
    dadosAtendimento.gpsEntrada = coordReal;

    const totalBlocos = Math.max(1, Math.min(20, Number(r.qtdBlocosProgramados) || 1));
    dadosAtendimento.blocos = [];
    for (let i = 1; i <= totalBlocos; i++) {
        const novoBloco = criarObjetoBlocoPadrao(i);
        if (r.andares) novoBloco.andares = r.andares;
        if (r.hps) novoBloco.hps = r.hps;
        if (r.observacoes) novoBloco.observacoes = r.observacoes;
        dadosAtendimento.blocos.push(novoBloco);
    }

    document.getElementById('lbl-status-execucao-campo').innerText = `Status: Em Andamento (${totalBlocos} Bloco${totalBlocos > 1 ? 's' : ''})`;
    document.getElementById('lbl-imovel-aberto').innerText = `${r.imovel} (${r.projeto})`;
    document.getElementById('lbl-h-entrada').innerText = horaEntradaAtual;
    document.getElementById('lbl-gps-entrada').innerText = coordReal;

    document.getElementById('form-endereco').value = r.endereco || '';
    if (document.getElementById('form-liberou-acesso')) {
        document.getElementById('form-liberou-acesso').value = r.liberouAcesso || '';
    }
    document.getElementById('form-responsavel').value = r.responsavel || '';
    document.getElementById('form-contato').value = r.contato || '';
    document.getElementById('form-email').value = r.email || '';
    document.getElementById('inp-qtd-blocos').value = totalBlocos;

    document.getElementById('form-campo-container').classList.add('hidden');
    document.getElementById('box-programadas-campo').classList.add('hidden');
    document.getElementById('bloco-pos-abertura').classList.remove('hidden');

    mudarTipoProjeto();
    renderizarBlocosCampo();
    sincronizarVisualPausaCampo();
    salvarRascunhoCampo();
    await carregarRegistrosModoCampoLeve();
    atualizarAbaMinhasAtividadesCampo(false);
}

function verificarImprevistoAtivoEquipeCampo() {
    const equipeSelecionada = document.getElementById('sel-equipe').value;
    const boxImp = document.getElementById('box-imprevisto-ativo-campo');
    if (!equipeSelecionada || !boxImp) {
        if (boxImp) boxImp.classList.add('hidden');
        return;
    }

    const hojeISO = obterDataLocalISO();
    const impAtivo = registrosSalvos.find(r => 
        r.equipe === equipeSelecionada && 
        r.dataRegistro === hojeISO && 
        r.desfecho === 'IMPREVISTO'
    );

    if (impAtivo) {
        const motivoStr = (impAtivo.malogros && impAtivo.malogros.length > 0) ? impAtivo.malogros.join(' + ') : impAtivo.motivoDesfecho;
        document.getElementById('lbl-info-imprevisto-ativo').innerText = `${motivoStr} (Iniciado às ${impAtivo.hEntrada})`;
        boxImp.dataset.idImprevisto = impAtivo.id;
        boxImp.classList.remove('hidden');
    } else {
        boxImp.classList.add('hidden');
    }
}

async function finalizarImprevistoCampo() {
    const boxImp = document.getElementById('box-imprevisto-ativo-campo');
    const idImp = Number(boxImp?.dataset.idImprevisto);
    if (!idImp) return;

    const btn = document.getElementById('btn-finalizar-imprevisto-campo');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Finalizando imprevisto...";
    }

    await resolverImprevistoPorId(idImp, false);

    if (btn) {
        btn.disabled = false;
        btn.innerText = "✅ Resolver Imprevisto e Ficar Disponível";
    }
    boxImp.classList.add('hidden');
    alert("✅ Imprevisto finalizado! Você já consta como DISPONÍVEL para o painel de gestão.");
}

async function resolverImprevistoPorId(idImp, chamadoPeloGestor = true) {
    const reg = registrosSalvos.find(r => r.id === idImp);
    const horaFim = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const gpsSaida = reg?.gpsEntrada || "Não capturado";

    const { error } = await supabaseClient
        .from('registros_producao')
        .update({
            desfecho: "IMPREVISTO RESOLVIDO",
            h_saida: horaFim,
            gps_saida: gpsSaida
        })
        .eq('id', idImp);

    if (error) {
        alert("Erro ao finalizar imprevisto: " + error.message);
        return;
    }

    registrarLogAuditoria("IMPREVISTO RESOLVIDO", `Imprevisto da equipe ${reg?.equipe || ''} encerrado às ${horaFim}. Técnico novamente disponível.`);
    await carregarRegistrosModoCampoLeve();
    if (chamadoPeloGestor) {
        if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
        alert("✅ Imprevisto marcado como RESOLVIDO! O técnico voltou a ficar disponível.");
    }
}

async function copiarTextoAreaTransferencia(texto, msgSucesso) {
    try {
        await navigator.clipboard.writeText(texto);
        alert(msgSucesso);
    } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = texto;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert(msgSucesso);
    }
}

function montarTextoResumoItem(r) {
    let iconeDesf = "🟢";
    if (r.desfecho === "PENDENTE" || r.desfecho === "IMPREVISTO") iconeDesf = "🟡";
    else if (r.desfecho === "MALOGRADA") iconeDesf = "🔴";
    else if (r.desfecho === "EM ANDAMENTO") iconeDesf = "🔵";
    else if (r.desfecho === "PARALISADA") iconeDesf = "⏸️";
    else if (r.desfecho === "REABERTA") iconeDesf = "🔄";
    else if (r.desfecho === "PROGRAMADA") iconeDesf = "📋";

    let linhas = [
        `📋 *GPD MDU • PROCISA RJ*`,
        `📅 *Data:* ${r.dataRegistro}`,
        `👷 *Equipe:* ${r.equipe}`,
        `🏢 *Imóvel:* ${r.imovel}`,
        `📍 *Endereço:* ${r.endereco || '-'}`
    ];

    if (r.liberouAcesso) {
        linhas.push(`🔑 *Liberou o Acesso:* ${r.liberouAcesso}`);
    }

    linhas.push(`🏗️ *Projeto:* ${r.projeto} (${obterMacroGrupoProjeto(r.projeto)})`);
    linhas.push(`🕒 *Horário:* ${r.hEntrada} às ${r.hSaida}`);

    if (Number(r.tempoPausadoMinutos) > 0) {
        linhas.push(`⏸️ *Tempo Paralisado:* ${r.tempoPausadoMinutos} min`);
    }

    linhas.push(`📍 *GPS:* ${r.gpsEntrada}`);

    if (Array.isArray(r.blocosDetalhados) && r.blocosDetalhados.length > 1) {
        linhas.push(`────────────────────`);
        linhas.push(`🏢 *DETALHAMENTO POR BLOCO (${r.blocosDetalhados.length} BLOCOS):*`);

        r.blocosDetalhados.forEach((b, idx) => {
            let iconeB = "🟢";
            if (b.desfecho === "PENDENTE") iconeB = "🟡";
            else if (b.desfecho === "MALOGRADA") iconeB = "🔴";

            const nomeBloco = (b.identificacao || `BLOCO ${idx + 1}`).toUpperCase().trim();
            linhas.push(`\n🔹 *${nomeBloco}*`);
            linhas.push(`   • *Andares:* ${b.andares || 0} | *HPs:* ${b.hps || 0}`);
            linhas.push(`   • *Desfecho:* ${iconeB} ${b.desfecho}`);
            linhas.push(`   • *Materiais (${nomeBloco}):* RL: ${Number(b.caboRL) || 0}m | Drop: ${Number(b.caboDrop) || 0}m | Conect: ${Number(b.conectores) || 0} | Fusões: ${Number(b.fusoes) || 0} | NAP: ${Number(b.nap) || 0} | DIO: ${Number(b.dio) || 0}`);
            
            const cxS = Number(b.cxSobrepor) || 0;
            const cxE = Number(b.cxEmbutida) || 0;
            const cxF = Number(b.cxFosc) || 0;
            if (cxS > 0 || cxE > 0 || cxF > 0) {
                linhas.push(`   • *Caixas (${nomeBloco}):* Sobrepor: ${cxS} | Embutida: ${cxE} | FOSC: ${cxF}`);
            }
            if (Array.isArray(b.opcoesMarcadas) && b.opcoesMarcadas.length > 0) {
                linhas.push(`   • *Opções:* ${b.opcoesMarcadas.join(', ')}`);
            }
            if (b.motivoDesfecho) {
                linhas.push(`   • *Detalhe:* ${b.motivoDesfecho}`);
            }
            if (b.observacoes) {
                linhas.push(`   • *Obs:* ${b.observacoes}`);
            }
            if (Array.isArray(b.fotos) && b.fotos.length > 0) {
                linhas.push(`   • *Fotos:* ${b.fotos.length} anexada(s)`);
            }
        });

        linhas.push(`────────────────────`);
        linhas.push(`📊 *TOTAL GERAL CONSOLIDADO:*`);
        linhas.push(`🏢 *Andares Totais:* ${r.andares || 0} | *HPs Totais:* ${r.hps || 0}`);
        linhas.push(`📦 *Soma Materiais:* RL: ${r.caboRL}m | Drop: ${r.caboDrop}m | Conect: ${r.conectores} | Fusões: ${r.fusoes} | NAP: ${r.nap} | DIO: ${r.dio}`);
        if (r.fotos && r.fotos.length > 0) {
            linhas.push(`📷 *Total de Fotos:* ${r.fotos.length} foto(s) no sistema`);
        }
    } else {
        linhas.push(`🏢 *Andares:* ${r.andares || 0} | *HPs:* ${r.hps || 0}`);
        linhas.push(`${iconeDesf} *Status/Desfecho:* ${r.desfecho}`);

        if (r.projeto !== "IMPREVISTO / ATRASO") {
            linhas.push(`📦 *Materiais:* RL: ${r.caboRL}m | Drop: ${r.caboDrop}m | Conect: ${r.conectores} | Fusões: ${r.fusoes} | NAP: ${r.nap} | DIO: ${r.dio}`);
            const cxS = Number(r.cxSobrepor) || 0;
            const cxE = Number(r.cxEmbutida) || 0;
            const cxF = Number(r.cxFosc) || 0;
            if (cxS > 0 || cxE > 0 || cxF > 0) {
                linhas.push(`🧰 *Caixas:* Sobrepor: ${cxS} | Embutida: ${cxE} | FOSC: ${cxF}`);
            }
        }
        if (r.malogros && r.malogros.length > 0) {
            linhas.push(`⚠️ *Opções Marcadas:* ${r.malogros.join(', ')}`);
        }
        if (r.motivoDesfecho) {
            linhas.push(`💬 *Detalhe:* ${r.motivoDesfecho}`);
        }
        if (r.observacoes) {
            linhas.push(`📝 *Obs:* ${r.observacoes}`);
        }
        if (r.fotos && r.fotos.length > 0) {
            linhas.push(`📷 *Fotos Anexadas:* ${r.fotos.length} foto(s) no sistema`);
        }
    }
    return linhas.join('\n');
}

function copiarUltimoResumoCampoWhatsApp() {
    if (!ultimoResumoCampoTexto) return;
    copiarTextoAreaTransferencia(ultimoResumoCampoTexto, "📲 Resumo da atividade copiado! Agora é só colar no WhatsApp.");
}

async function fazerCheckIn() {
    const equipe = document.getElementById('sel-equipe').value;
    const projeto = document.getElementById('sel-projeto').value;
    const imovel = document.getElementById('inp-imovel').value.trim();
    if (!equipe || !projeto || !imovel) { alert("⚠️ Selecione a Equipe, o Projeto e informe o Cód. Imóvel."); return; }

    const hojeISO = obterDataLocalISO();
    const duplicadoHoje = registrosSalvos.find(r => 
        r.dataRegistro === hojeISO && 
        r.imovel.toUpperCase().trim().startsWith(imovel.toUpperCase()) &&
        r.projeto === projeto &&
        !['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(r.desfecho)
    );

    if (duplicadoHoje) {
        const confirmarDup = confirm(`⚠️ ATENÇÃO: O imóvel "${imovel}" já possui um registro de "${projeto}" lançado hoje (${duplicadoHoje.desfecho} por ${duplicadoHoje.equipe}).\n\nDeseja abrir um novo atendimento para este mesmo imóvel?`);
        if (!confirmarDup) return;
    }

    document.getElementById('box-ultimo-resumo-whats').classList.add('hidden');

    const btnCheckin = document.getElementById('btn-checkin');
    if (btnCheckin) {
        btnCheckin.disabled = true;
        btnCheckin.innerText = "📍 Obtendo GPS e iniciando no painel...";
    }

    let coordReal = "Não capturado";
    try {
        coordReal = await capturarGpsReal(12000);
        dadosAtendimento.gpsEntrada = coordReal;
        document.getElementById('lbl-gps-entrada').innerText = coordReal;

        const partes = coordReal.split(',').map(s => parseFloat(s.trim()));
        if (partes.length === 2 && !isNaN(partes[0])) {
            await registrarPontoTelemetriaEquipe(equipe, partes[0], partes[1], 'DISPONIVEL');
            iniciarMonitoramentoContinuoGps(equipe);
        }
    } catch (err) {
        alert("❌ Não foi possível capturar o GPS. Verifique se a Localização do celular está ativada e se o navegador tem permissão.");
        if (btnCheckin) {
            btnCheckin.disabled = false;
            btnCheckin.innerText = "🚀 Iniciar Atividade no Imóvel (Status: Em Andamento)";
        }
        return;
    }

    const horaEntradaAtual = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const idTemp = Date.now();

    const registroEmAndamentoDB = {
        id: idTemp,
        data_registro: hojeISO,
        equipe: equipe,
        membros: equipe,
        projeto: projeto,
        imovel: imovel,
        h_entrada: horaEntradaAtual,
        h_saida: "Em Andamento",
        gps_entrada: coordReal,
        gps_saida: "Em Campo",
        desfecho: "EM ANDAMENTO",
        motivo_desfecho: "Atividade iniciada em campo (Em execução)",
        malogros: [],
        responsavel: '',
        contato: '',
        email: '',
        agendamento: null,
        andares: 0,
        hps: 0,
        servico_obra: "SIM",
        observacoes: "Em andamento"
    };

    const { error } = await supabaseClient.from('registros_producao').insert([registroEmAndamentoDB]);
    if (error) {
        console.warn("Aviso ao registrar status Em Andamento:", error.message);
    } else {
        dadosAtendimento.idEmAndamento = idTemp;
        dadosAtendimento.eraReaberta = false;
        dadosAtendimento.eraProgramada = false;
    }

    if (btnCheckin) {
        btnCheckin.disabled = false;
        btnCheckin.innerText = "🚀 Iniciar Atividade no Imóvel (Status: Em Andamento)";
    }

    dadosAtendimento.blocos = [criarObjetoBlocoPadrao(1)];
    document.getElementById('inp-qtd-blocos').value = 1;

    document.getElementById('lbl-status-execucao-campo').innerText = "Status: Em Andamento no Painel";
    document.getElementById('form-campo-container').classList.add('hidden');
    document.getElementById('bloco-pos-abertura').classList.remove('hidden');
    document.getElementById('lbl-imovel-aberto').innerText = `${imovel} (${projeto})`;
    document.getElementById('lbl-h-entrada').innerText = horaEntradaAtual;
    mudarTipoProjeto();
    renderizarBlocosCampo();
    sincronizarVisualPausaCampo();
    salvarRascunhoCampo();
    await carregarRegistrosModoCampoLeve();
    atualizarAbaMinhasAtividadesCampo(false);
}

// PONTO 06: Validação de preenchimento obrigatório para Endereço, Liberou o Acesso, Andares e HPs
async function salvarRegistro() {
    if (dadosAtendimento.emPausa) {
        alert("⚠️ A atividade encontra-se PARALISADA. Clique no botão verde '▶️ Retomar Atividade Agora' antes de finalizar o atendimento.");
        return;
    }

    lerDadosBlocosDaTela();

    const enderecoGeral = document.getElementById('form-endereco').value.trim();
    if (!enderecoGeral) {
        alert("⚠️ O preenchimento do ENDEREÇO DO ATENDIMENTO é obrigatório.");
        document.getElementById('form-endereco').focus();
        return;
    }

    const liberouAcessoGeral = document.getElementById('form-liberou-acesso') ? document.getElementById('form-liberou-acesso').value.trim() : '';
    if (!liberouAcessoGeral) {
        alert("⚠️ O preenchimento do campo 'LIBEROU O ACESSO' é obrigatório.");
        document.getElementById('form-liberou-acesso')?.focus();
        return;
    }

    const qtdBlocos = dadosAtendimento.blocos.length;

    for (let i = 0; i < qtdBlocos; i++) {
        const b = dadosAtendimento.blocos[i];
        const nomeBloco = qtdBlocos > 1 ? `(${b.identificacao || 'Bloco ' + (i+1)})` : '';

        const numAndares = Number(b.andares);
        const numHps = Number(b.hps);

        if (!b.andares || isNaN(numAndares) || numAndares <= 0) {
            alert(`⚠️ Informe obrigatoriamente a quantidade de ANDARES ${nomeBloco}.`);
            document.getElementById(`bloco-andares-${i}`)?.focus();
            return;
        }
        if (!b.hps || isNaN(numHps) || numHps <= 0) {
            alert(`⚠️ Informe obrigatoriamente o Nº DE HPs ${nomeBloco}.`);
            document.getElementById(`bloco-hps-${i}`)?.focus();
            return;
        }
        if (!b.desfecho) {
            alert(`⚠️ Selecione o DESFECHO da atividade ${nomeBloco} (CONCLUÍDA, PENDENTE ou MALOGRADA).`);
            return;
        }
        if (b.desfecho === 'PENDENTE' && (!b.obsPendente.trim() || !b.pendenciasOpcoes || b.pendenciasOpcoes.length === 0)) {
            alert(`⚠️ Para atividade PENDENTE ${nomeBloco}, selecione pelo menos uma opção (ex: Rede Corretiva) e descreva o motivo.`);
            return;
        }
        if (b.desfecho === 'MALOGRADA' && (!b.obsMalograda.trim() || !b.malogros || b.malogros.length === 0)) {
            alert(`⚠️ Informe o motivo e selecione pelo menos um ofensor de malogro ${nomeBloco}.`);
            return;
        }
    }

    const btnSalvar = document.getElementById('btn-salvar-final');
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.innerText = "⏳ Capturando GPS de saída e salvando fotos...";
    }

    const equipeNome = document.getElementById('sel-equipe').value;
    let gpsSaidaFinal = dadosAtendimento.gpsEntrada || "Não capturado";
    try {
        gpsSaidaFinal = await capturarGpsReal(4000);
        const partes = gpsSaidaFinal.split(',').map(s => parseFloat(s.trim()));
        if (partes.length === 2 && !isNaN(partes[0])) {
            await registrarPontoTelemetriaEquipe(equipeNome, partes[0], partes[1]);
        }
    } catch (e) {
        console.warn("Sinal interno fraco na saída, mantendo coordenada real da entrada.");
    }

    const projetoNome = document.getElementById('sel-projeto').value;
    const imovelBase = document.getElementById('inp-imovel').value.trim();
    const responsavelGeral = document.getElementById('form-responsavel').value.trim();
    const contatoGeral = document.getElementById('form-contato').value.trim();
    const emailGeral = document.getElementById('form-email').value.trim();
    const dataLocalCorreta = obterDataLocalISO();
    const horaEntradaOriginal = document.getElementById('lbl-h-entrada').innerText || "08:30";
    const horaSaidaAtual = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const foiReaberta = dadosAtendimento.eraReaberta;
    const minutosPausaTotal = Number(dadosAtendimento.minutosPausados) || 0;

    if (dadosAtendimento.idEmAndamento) {
        await supabaseClient.from('registros_producao').delete().eq('id', dadosAtendimento.idEmAndamento);
    }

    const listaRegistrosParaInserir = dadosAtendimento.blocos.map((b, idx) => {
        let motivoDesfecho = "";
        let opcoesMarcadas = [];

        if (b.desfecho === 'CONCLUIDA') {
            motivoDesfecho = b.obsConcluida.trim();
            opcoesMarcadas = b.concluidasOpcoes || [];
        } else if (b.desfecho === 'PENDENTE') {
            motivoDesfecho = b.obsPendente.trim();
            opcoesMarcadas = b.pendenciasOpcoes || [];
        } else if (b.desfecho === 'MALOGRADA') {
            motivoDesfecho = b.obsMalograda.trim();
            opcoesMarcadas = b.malogros || [];
        }

        const codigoImovelFinal = qtdBlocos > 1 
            ? `${imovelBase} - ${(b.identificacao || 'BLOCO ' + (idx + 1)).toUpperCase().trim()}`
            : imovelBase;

        const tagLiberou = `[LIBEROU_ACESSO: ${liberouAcessoGeral}] `;
        const tagPausa = (minutosPausaTotal > 0 && idx === 0) ? `[PAUSA_TOTAL: ${minutosPausaTotal}] ` : '';
        const sufixoFotos = (b.fotos && b.fotos.length > 0) ? ` [FOTOS:${JSON.stringify(b.fotos)}]` : '';
        const obsFinal = `[END: ${enderecoGeral}] ${tagLiberou}${tagPausa}${b.observacoes || ''}${sufixoFotos}`.trim();

        return {
            id: Date.now() + idx,
            data_registro: dataLocalCorreta,
            equipe: equipeNome,
            membros: equipeNome,
            projeto: projetoNome,
            imovel: codigoImovelFinal,
            h_entrada: horaEntradaOriginal,
            h_saida: horaSaidaAtual,
            gps_entrada: dadosAtendimento.gpsEntrada || gpsSaidaFinal,
            gps_saida: gpsSaidaFinal,
            desfecho: b.desfecho,
            motivo_desfecho: motivoDesfecho,
            malogros: opcoesMarcadas,
            responsavel: responsavelGeral,
            contato: contatoGeral,
            email: emailGeral,
            agendamento: null,
            andares: Number(b.andares) || 0,
            hps: Number(b.hps) || 0,
            servico_obra: b.servicoObra || "SIM",
            observacoes: obsFinal,
            fusoes: Number(b.fusoes) || 0,
            conectores: Number(b.conectores) || 0,
            cabo_rl: Number(b.caboRL) || 0,
            cabo_drop: Number(b.caboDrop) || 0,
            nap: Number(b.nap) || 0,
            dio: Number(b.dio) || 0,
            cx_sobrepor: Number(b.cxSobrepor) || 0,
            cx_embutida: Number(b.cxEmbutida) || 0,
            cx_fosc: Number(b.cxFosc) || 0
        };
    });

    const { error } = await supabaseClient.from('registros_producao').insert(listaRegistrosParaInserir);
    
    if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.innerText = "💾 Finalizar e Salvar Atendimento";
    }

    if (error) {
        alert("❌ Erro ao salvar: " + error.message);
        return;
    }

    const primeiroReg = listaRegistrosParaInserir[0];
    const todasFotos = dadosAtendimento.blocos.flatMap(b => b.fotos || []);

    const blocosParaWhats = dadosAtendimento.blocos.map((b, idx) => ({
        identificacao: b.identificacao || `BLOCO ${idx + 1}`,
        andares: Number(b.andares) || 0,
        hps: Number(b.hps) || 0,
        desfecho: b.desfecho,
        fusoes: Number(b.fusoes) || 0,
        conectores: Number(b.conectores) || 0,
        caboRL: Number(b.caboRL) || 0,
        caboDrop: Number(b.caboDrop) || 0,
        nap: Number(b.nap) || 0,
        dio: Number(b.dio) || 0,
        cxSobrepor: Number(b.cxSobrepor) || 0,
        cxEmbutida: Number(b.cxEmbutida) || 0,
        cxFosc: Number(b.cxFosc) || 0,
        opcoesMarcadas: b.desfecho === 'CONCLUIDA' ? b.concluidasOpcoes : (b.desfecho === 'PENDENTE' ? b.pendenciasOpcoes : b.malogros),
        motivoDesfecho: b.desfecho === 'CONCLUIDA' ? b.obsConcluida : (b.desfecho === 'PENDENTE' ? b.obsPendente : b.obsMalograda),
        observacoes: (b.observacoes || '').trim(),
        fotos: b.fotos || []
    }));
    
    ultimoResumoCampoTexto = montarTextoResumoItem({
        dataRegistro: dataLocalCorreta,
        equipe: equipeNome,
        imovel: qtdBlocos > 1 ? `${imovelBase} (${qtdBlocos} Blocos)` : imovelBase,
        endereco: enderecoGeral,
        liberouAcesso: liberouAcessoGeral,
        tempoPausadoMinutos: minutosPausaTotal,
        projeto: projetoNome,
        andares: listaRegistrosParaInserir.reduce((acc, r) => acc + r.andares, 0),
        hps: listaRegistrosParaInserir.reduce((acc, r) => acc + r.hps, 0),
        desfecho: listaRegistrosParaInserir.map(r => r.desfecho).join(' / '),
        hEntrada: horaEntradaOriginal,
        hSaida: horaSaidaAtual,
        gpsEntrada: primeiroReg.gps_entrada,
        caboRL: listaRegistrosParaInserir.reduce((acc, r) => acc + r.cabo_rl, 0),
        caboDrop: listaRegistrosParaInserir.reduce((acc, r) => acc + r.cabo_drop, 0),
        conectores: listaRegistrosParaInserir.reduce((acc, r) => acc + r.conectores, 0),
        fusoes: listaRegistrosParaInserir.reduce((acc, r) => acc + r.fusoes, 0),
        nap: listaRegistrosParaInserir.reduce((acc, r) => acc + r.nap, 0),
        dio: listaRegistrosParaInserir.reduce((acc, r) => acc + r.dio, 0),
        cxSobrepor: listaRegistrosParaInserir.reduce((acc, r) => acc + r.cx_sobrepor, 0),
        cxEmbutida: listaRegistrosParaInserir.reduce((acc, r) => acc + r.cx_embutida, 0),
        cxFosc: listaRegistrosParaInserir.reduce((acc, r) => acc + r.cx_fosc, 0),
        malogros: primeiroReg.malogros,
        motivoDesfecho: primeiroReg.motivo_desfecho,
        observacoes: (dadosAtendimento.blocos[0]?.observacoes || '').trim(),
        fotos: todasFotos,
        blocosDetalhados: blocosParaWhats
    });
    
    document.getElementById('box-ultimo-resumo-whats').classList.remove('hidden');

    const tipoAcaoAudit = foiReaberta ? "ATIVIDADE REABERTA FINALIZADA" : "INSERÇÃO DE REGISTRO";
    registrarLogAuditoria(tipoAcaoAudit, `Equipe: ${equipeNome} | Imóvel: ${imovelBase} (${qtdBlocos} bloco(s)) | Liberou: ${liberouAcessoGeral} | Fotos: ${todasFotos.length}`);
    
    alert(`✅ Atendimento finalizado (${qtdBlocos} bloco(s) e ${todasFotos.length} foto(s)) e sincronizado com sucesso!`);
    resetarFormularioCampo();
    await carregarRegistrosModoCampoLeve();
    verificarPendenciasReabertasEProgramadasCampo(false);
    atualizarAbaMinhasAtividadesCampo(false);
}
