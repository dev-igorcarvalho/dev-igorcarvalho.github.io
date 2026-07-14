/* Livro de Abas — router (fetch + hash) e toggle de tema. Vanilla JS, zero dependências. */

(function () {
  "use strict";

  var CHAVE_TEMA = "tema";
  var ARTIGO_PADRAO = "boas-vindas";
  var conteudo = document.getElementById("conteudo");
  var nav = document.querySelector(".sidebar nav");
  var botaoTema = document.getElementById("toggle-tema");
  var campoBusca = document.getElementById("busca-artigos");
  var mensagemVazia = document.querySelector(".busca__vazio");

  // ---------- Tema ----------

  function temaAtual() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function aplicarTema(tema) {
    document.documentElement.setAttribute("data-theme", tema);
    if (botaoTema) {
      botaoTema.textContent = tema === "dark" ? "☀ tema claro" : "☾ tema escuro";
    }
  }

  function alternarTema() {
    var novo = temaAtual() === "dark" ? "light" : "dark";
    localStorage.setItem(CHAVE_TEMA, novo);
    aplicarTema(novo);
  }

  if (botaoTema) {
    aplicarTema(temaAtual()); // sincroniza o rótulo com o que o script anti-flash já aplicou
    botaoTema.addEventListener("click", alternarTema);
  }

  // ---------- Sidebar: montada em runtime a partir de articles/manifest.json ----------

  function montarSidebar(itens) {
    if (!nav) return;
    nav.innerHTML = "";
    itens.forEach(function (item) {
      var link = document.createElement("a");
      link.href = "#" + item.slug;
      link.setAttribute("data-article", item.slug);
      link.textContent = item.titulo;
      nav.appendChild(link);
    });
  }

  function normalizar(texto) {
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function filtrarArtigos() {
    if (!nav || !campoBusca) return;
    var termo = normalizar(campoBusca.value.trim());
    var links = nav.querySelectorAll("a[data-article]");
    var algumVisivel = false;
    links.forEach(function (link) {
      var corresponde = !termo || normalizar(link.textContent).indexOf(termo) !== -1;
      link.hidden = !corresponde;
      if (corresponde) algumVisivel = true;
    });
    if (mensagemVazia) mensagemVazia.hidden = algumVisivel || links.length === 0;
  }

  if (campoBusca) {
    campoBusca.addEventListener("input", filtrarArtigos);
    campoBusca.addEventListener("keydown", function (evento) {
      if (evento.key !== "Enter") return;
      var primeiroVisivel = nav && nav.querySelector("a[data-article]:not([hidden])");
      if (primeiroVisivel) {
        evento.preventDefault();
        primeiroVisivel.click();
      }
    });
  }

  function carregarManifesto() {
    return fetch("./articles/manifest.json")
      .then(function (resposta) {
        if (!resposta.ok) throw new Error("manifest indisponível");
        return resposta.json();
      })
      .then(montarSidebar)
      .catch(function () {
        if (nav) {
          nav.innerHTML = '<p class="erro-carga" style="margin:0;padding:.75rem">Não foi possível carregar a lista de artigos.</p>';
        }
      });
  }

  // ---------- Router de artigos ----------

  function marcarLinkAtivo(nomeArtigo) {
    if (!nav) return;
    var links = nav.querySelectorAll("a[data-article]");
    links.forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("data-article") === nomeArtigo);
    });
  }

  function mostrarErro(nomeArtigo) {
    conteudo.innerHTML =
      '<div class="erro-carga">' +
      "<h2>Artigo não encontrado</h2>" +
      "<p>Não foi possível carregar <code>" + nomeArtigo + ".html</code>. " +
      "Ele pode ter sido movido, renomeado ou ainda não existe.</p>" +
      "</div>";
  }

  function carregarArtigo(nomeArtigo) {
    fetch("./articles/" + nomeArtigo + ".html")
      .then(function (resposta) {
        if (!resposta.ok) throw new Error("404");
        return resposta.text();
      })
      .then(function (html) {
        conteudo.innerHTML = html;
        marcarLinkAtivo(nomeArtigo);
      })
      .catch(function () {
        mostrarErro(nomeArtigo);
        marcarLinkAtivo(nomeArtigo);
      });
  }

  function carregarDoHash() {
    var nomeArtigo = location.hash.slice(1) || ARTIGO_PADRAO;
    carregarArtigo(nomeArtigo);
  }

  if (nav) {
    nav.addEventListener("click", function (evento) {
      var link = evento.target.closest("a[data-article]");
      if (!link) return;
      evento.preventDefault();
      var nomeArtigo = link.getAttribute("data-article");
      if (location.hash.slice(1) === nomeArtigo) {
        carregarArtigo(nomeArtigo);
      } else {
        location.hash = nomeArtigo;
      }
    });
  }

  window.addEventListener("hashchange", carregarDoHash);
  carregarManifesto().then(carregarDoHash);
})();
