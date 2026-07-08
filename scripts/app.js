window.RTN = window.RTN || {};

(function () {
  var state = {
    periodicidade: 'mensal',
    unidadeTipo: 'corrente',
    selectedVars: [], // [{codigo, descricao}]
    searchQuery: '',
  };

  var PERIODICIDADE_LABEL = { mensal: 'Mensal', anual: 'Anual', trimestral: 'Trimestral' };
  var UNIDADE_LABEL_SHORT = {
    corrente: 'Corrente',
    constante_ipca: 'Constante (IPCA)',
    pct_pib: '% do PIB',
    constante_ipca_acum12m: 'Acum. 12 meses',
  };

  var els = {};
  var searchDebounce = null;

  function normalize(s) {
    return (s || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  function isSelected(codigo, descricao) {
    var key = RTN.varKey(codigo, descricao);
    return state.selectedVars.some(function (v) {
      return RTN.varKey(v.codigo, v.descricao) === key;
    });
  }

  function toggleVar(codigo, descricao) {
    var key = RTN.varKey(codigo, descricao);
    var idx = state.selectedVars.findIndex(function (v) {
      return RTN.varKey(v.codigo, v.descricao) === key;
    });
    if (idx >= 0) state.selectedVars.splice(idx, 1);
    else state.selectedVars.push({ codigo: codigo, descricao: descricao });
    render();
  }

  function removeVar(codigo, descricao) {
    var key = RTN.varKey(codigo, descricao);
    state.selectedVars = state.selectedVars.filter(function (v) {
      return RTN.varKey(v.codigo, v.descricao) !== key;
    });
    render();
  }

  function entryAvailableNow(entry) {
    return entry.disponibilidade.some(function (d) {
      return d.periodicidade === state.periodicidade && d.unidade_tipo === state.unidadeTipo;
    });
  }

  function renderVariableList() {
    if (!RTN.catalog) return; // catalogo ainda nao carregou (ou falhou) -- init() ja mostra o erro

    var query = normalize(state.searchQuery);
    var pool = RTN.catalog;
    var visible;

    if (!query) {
      visible = pool.filter(function (c) {
        return isSelected(c.codigo, c.descricao);
      });
    } else {
      visible = pool.filter(function (c) {
        var label = normalize(RTN.apelidoOuDescricao(c.codigo, c.descricao));
        return label.indexOf(query) !== -1 || normalize(c.codigo).indexOf(query) !== -1;
      });
    }

    var truncated = false;
    var MAX = 150;
    if (visible.length > MAX) {
      truncated = true;
      visible = visible
        .slice()
        .sort(function (a, b) {
          return isSelected(b.codigo, b.descricao) - isSelected(a.codigo, a.descricao);
        })
        .slice(0, MAX);
    }

    els.varList.innerHTML = '';

    if (!query && visible.length === 0) {
      var hint = document.createElement('p');
      hint.className = 'rtn-hint';
      hint.textContent = 'Digite para buscar entre ' + pool.length + ' rubricas.';
      els.varList.appendChild(hint);
      return;
    }

    visible.forEach(function (c) {
      var id = 'var-' + c.codigo + '-' + Math.abs(hashCode(c.descricao));
      var label = document.createElement('label');
      label.className = 'rtn-var-item';
      if (!entryAvailableNow(c)) label.classList.add('rtn-var-unavailable');

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isSelected(c.codigo, c.descricao);
      checkbox.addEventListener('change', function () {
        toggleVar(c.codigo, c.descricao);
      });

      var text = document.createElement('span');
      text.textContent = RTN.apelidoOuDescricao(c.codigo, c.descricao);

      var codeTag = document.createElement('code');
      codeTag.textContent = c.codigo || '—';

      label.appendChild(checkbox);
      label.appendChild(text);
      label.appendChild(codeTag);
      els.varList.appendChild(label);
    });

    if (truncated) {
      var more = document.createElement('p');
      more.className = 'rtn-hint';
      more.textContent = 'Mostrando ' + MAX + ' de ' + pool.filter(function (c) {
        var lbl = normalize(RTN.apelidoOuDescricao(c.codigo, c.descricao));
        return lbl.indexOf(query) !== -1 || normalize(c.codigo).indexOf(query) !== -1;
      }).length + ' resultados. Refine a busca.';
      els.varList.appendChild(more);
    }
  }

  function hashCode(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  function renderChips() {
    els.varChips.innerHTML = '';
    state.selectedVars.forEach(function (v) {
      var chip = document.createElement('span');
      chip.className = 'rtn-chip';
      var label = document.createElement('span');
      label.textContent = RTN.apelidoOuDescricao(v.codigo, v.descricao);
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'rtn-chip-remove';
      remove.setAttribute('aria-label', 'Remover ' + label.textContent);
      remove.textContent = '×';
      remove.addEventListener('click', function () {
        removeVar(v.codigo, v.descricao);
      });
      chip.appendChild(label);
      chip.appendChild(remove);
      els.varChips.appendChild(chip);
    });
  }

  function applySuggestion(suggestion) {
    state.periodicidade = suggestion.periodicidade;
    state.unidadeTipo = suggestion.unidade_tipo;
    syncFilterInputs();
    render();
  }

  function renderWarnings(failed) {
    els.warnings.innerHTML = '';
    failed.forEach(function (f) {
      var banner = document.createElement('div');
      banner.className = 'rtn-warning';

      var label = RTN.apelidoOuDescricao(f.rubrica.codigo, f.rubrica.descricao);
      var text = document.createElement('p');

      if (f.result.reason === 'not_in_catalog') {
        text.innerHTML = '<strong>' + label + '</strong> não foi encontrada no catálogo.';
        banner.appendChild(text);
      } else {
        var s = f.result.suggestion;
        text.innerHTML =
          '<strong>' + label + '</strong> não tem dado em ' +
          PERIODICIDADE_LABEL[state.periodicidade].toLowerCase() + ' + ' + RTN.unidadeLabel(state.unidadeTipo) +
          '. Mostrar em ' + PERIODICIDADE_LABEL[s.periodicidade].toLowerCase() + ' + ' +
          RTN.unidadeLabel(s.unidade_tipo) + '?';
        banner.appendChild(text);

        var actions = document.createElement('div');
        actions.className = 'rtn-warning-actions';

        var applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'rtn-btn rtn-btn-primary';
        applyBtn.textContent = 'Aplicar a todas';
        applyBtn.addEventListener('click', function () {
          applySuggestion(s);
        });

        var ignoreBtn = document.createElement('button');
        ignoreBtn.type = 'button';
        ignoreBtn.className = 'rtn-btn';
        ignoreBtn.textContent = 'Ignorar esta variável';
        ignoreBtn.addEventListener('click', function () {
          removeVar(f.rubrica.codigo, f.rubrica.descricao);
        });

        actions.appendChild(applyBtn);
        actions.appendChild(ignoreBtn);
        banner.appendChild(actions);
      }

      els.warnings.appendChild(banner);
    });
  }

  function syncFilterInputs() {
    var pRadio = document.querySelector('input[name="periodicidade"][value="' + state.periodicidade + '"]');
    if (pRadio) pRadio.checked = true;
    var uRadio = document.querySelector('input[name="unidadeTipo"][value="' + state.unidadeTipo + '"]');
    if (uRadio) uRadio.checked = true;
  }

  function render() {
    renderVariableList();
    renderChips();

    if (state.selectedVars.length === 0) {
      els.warnings.innerHTML = '';
      els.emptyState.classList.remove('rtn-hidden');
      els.chartWrap.classList.add('rtn-hidden');
      return;
    }

    var resolved = [];
    var failed = [];
    state.selectedVars.forEach(function (v) {
      var result = RTN.resolveTabela(state.periodicidade, state.unidadeTipo, v);
      if (result.ok) resolved.push({ codigo: v.codigo, descricao: v.descricao, tabela: result.tabela, csvFile: result.csvFile });
      else failed.push({ rubrica: v, result: result });
    });

    renderWarnings(failed);

    if (resolved.length === 0) {
      els.emptyState.classList.remove('rtn-hidden');
      els.emptyStateText.textContent = 'Nenhuma variável selecionada tem dado nesta combinação de filtros.';
      els.chartWrap.classList.add('rtn-hidden');
      return;
    }

    els.emptyState.classList.add('rtn-hidden');
    els.chartWrap.classList.remove('rtn-hidden');
    els.unidadeLabel.textContent = RTN.unidadeLabel(state.unidadeTipo) + ' · ' + PERIODICIDADE_LABEL[state.periodicidade];

    var files = resolved.map(function (r) {
      return r.csvFile;
    });

    RTN.ensureCsvLoaded(files)
      .then(function () {
        var chartData = RTN.buildChartDatasets(resolved, state);
        RTN.renderChart(els.canvas, chartData, state.unidadeTipo);
      })
      .catch(function (err) {
        console.error(err);
      });
  }

  function wireEvents() {
    document.querySelectorAll('input[name="periodicidade"]').forEach(function (input) {
      input.addEventListener('change', function () {
        state.periodicidade = input.value;
        render();
      });
    });
    document.querySelectorAll('input[name="unidadeTipo"]').forEach(function (input) {
      input.addEventListener('change', function () {
        state.unidadeTipo = input.value;
        render();
      });
    });
    els.varSearch.addEventListener('input', function () {
      var value = els.varSearch.value;
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(function () {
        state.searchQuery = value;
        renderVariableList();
      }, 150);
    });
  }

  RTN.onFetchError = function (file, err) {
    var banner = document.createElement('div');
    banner.className = 'rtn-warning';
    banner.innerHTML = '<p>Erro ao carregar <code>' + file + '</code>: ' + (err && err.message ? err.message : err) + '</p>';
    els.warnings.appendChild(banner);
  };

  function init() {
    els.varSearch = document.getElementById('var-search');
    els.varList = document.getElementById('var-list');
    els.varChips = document.getElementById('var-chips');
    els.warnings = document.getElementById('warnings');
    els.canvas = document.getElementById('chart');
    els.chartWrap = document.getElementById('chart-wrap');
    els.emptyState = document.getElementById('empty-state');
    els.emptyStateText = document.getElementById('empty-state-text');
    els.unidadeLabel = document.getElementById('unidade-label');

    wireEvents();

    RTN.loadCatalog()
      .then(function () {
        render();
      })
      .catch(function (err) {
        console.error(err);
        var msg = 'Erro ao carregar o catálogo: ' + err.message;
        if (location.protocol === 'file:') {
          msg =
            'Este painel precisa ser aberto por um servidor local, não direto do arquivo ' +
            '(o navegador bloqueia a busca de dados via "file://"). Rode <code>python -m http.server</code> ' +
            'nesta pasta e abra <code>http://localhost:8000</code> (ou a porta que aparecer).';
        }
        els.varList.innerHTML = '<p class="rtn-hint">' + msg + '</p>';
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
