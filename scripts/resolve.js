window.RTN = window.RTN || {};

(function () {
  var PERIODICIDADE_PREF = {
    mensal: ['trimestral', 'anual'],
    trimestral: ['mensal', 'anual'],
    anual: ['trimestral', 'mensal'],
  };

  var UNIDADE_PREF = {
    corrente: ['constante_ipca', 'pct_pib', 'constante_ipca_acum12m'],
    constante_ipca: ['corrente', 'pct_pib', 'constante_ipca_acum12m'],
    pct_pib: ['constante_ipca', 'corrente', 'constante_ipca_acum12m'],
    constante_ipca_acum12m: ['constante_ipca', 'corrente', 'pct_pib'],
  };

  // Nomes de tabela seguem sempre "N.N" ou "N.N-X" (um digito por segmento),
  // entao comparacao lexicografica basta para ordenar de forma deterministica.
  RTN.compareTabelaNumbers = function (a, b) {
    return a.tabela < b.tabela ? -1 : a.tabela > b.tabela ? 1 : 0;
  };

  RTN.tabelaToFilename = function (tabela) {
    return 'rtn_' + tabela.replace(/\./g, '_').replace(/-/g, '_') + '.csv';
  };

  function findEntry(codigo, descricao) {
    if (!RTN.catalog) return null;
    for (var i = 0; i < RTN.catalog.length; i++) {
      var c = RTN.catalog[i];
      if (c.codigo === codigo && c.descricao === descricao) return c;
    }
    return null;
  }

  function pickByPref(candidates, field, prefOrder) {
    for (var i = 0; i < prefOrder.length; i++) {
      var found = candidates.filter(function (c) {
        return c[field] === prefOrder[i];
      });
      if (found.length) {
        found.sort(RTN.compareTabelaNumbers);
        return found[0];
      }
    }
    candidates.sort(RTN.compareTabelaNumbers);
    return candidates[0];
  }

  RTN.suggestClosest = function (entry, periodicidade, unidadeTipo) {
    var avail = entry.disponibilidade;

    // Prioridade 1: mesma unidade_tipo, outra periodicidade.
    var p1 = avail.filter(function (d) {
      return d.unidade_tipo === unidadeTipo;
    });
    if (p1.length) return pickByPref(p1, 'periodicidade', PERIODICIDADE_PREF[periodicidade] || []);

    // Prioridade 2: mesma periodicidade, outra unidade_tipo.
    var p2 = avail.filter(function (d) {
      return d.periodicidade === periodicidade;
    });
    if (p2.length) return pickByPref(p2, 'unidade_tipo', UNIDADE_PREF[unidadeTipo] || []);

    // Prioridade 3: fallback final -- sempre existe pois disponibilidade nunca e vazia.
    var rest = avail.slice().sort(RTN.compareTabelaNumbers);
    return rest[0];
  };

  RTN.resolveTabela = function (periodicidade, unidadeTipo, rubrica) {
    var entry = findEntry(rubrica.codigo, rubrica.descricao);
    if (!entry) return { ok: false, reason: 'not_in_catalog' };

    var matches = entry.disponibilidade.filter(function (d) {
      return d.periodicidade === periodicidade && d.unidade_tipo === unidadeTipo;
    });

    if (matches.length > 0) {
      matches.sort(RTN.compareTabelaNumbers);
      var best = matches[0];
      return { ok: true, tabela: best.tabela, csvFile: RTN.tabelaToFilename(best.tabela) };
    }

    var suggestion = RTN.suggestClosest(entry, periodicidade, unidadeTipo);
    return { ok: false, reason: 'no_match', suggestion: suggestion };
  };
})();
