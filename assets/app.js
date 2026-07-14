/* Tabbed Book — fetch+hash router and theme toggle. Vanilla JS, zero dependencies. */

(function () {
  "use strict";

  var THEME_KEY = "theme";
  var DEFAULT_ARTICLE = "about";
  var INDEX_FOLDER = "contents"; // the site's root section, target of the "back" link on other sections
  var VERSION = window.__SITE_VERSION__ || "dev";
  var content = document.getElementById("content");
  var nav = document.querySelector(".sidebar nav");
  var themeButton = document.getElementById("toggle-theme");
  var searchInput = document.getElementById("search-articles");
  var emptyMessage = document.querySelector(".search__empty");
  var rootManifest = [];

  // ---------- Theme ----------

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (themeButton) {
      themeButton.textContent = theme === "dark" ? "☀ light theme" : "☾ dark theme";
    }
  }

  function toggleTheme() {
    var next = currentTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  if (themeButton) {
    applyTheme(currentTheme()); // syncs the label with what the anti-flash script already applied
    themeButton.addEventListener("click", toggleTheme);
  }

  // ---------- Sidebar: built at runtime from articles/manifest.json ----------

  function buildSidebar(items) {
    if (!nav) return;
    nav.innerHTML = "";
    items.forEach(function (item) {
      var link = document.createElement("a");
      link.href = "#" + item.slug;
      link.setAttribute("data-article", item.slug);
      link.textContent = item.titulo;
      nav.appendChild(link);
    });
  }

  function normalize(text) {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function filterArticles() {
    if (!nav || !searchInput) return;
    var term = normalize(searchInput.value.trim());
    var links = nav.querySelectorAll("a[data-article]");
    var anyVisible = false;
    links.forEach(function (link) {
      var matches = !term || normalize(link.textContent).indexOf(term) !== -1;
      link.hidden = !matches;
      if (matches) anyVisible = true;
    });
    if (emptyMessage) emptyMessage.hidden = anyVisible || links.length === 0;
  }

  if (searchInput) {
    searchInput.addEventListener("input", filterArticles);
    searchInput.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      var firstVisible = nav && nav.querySelector("a[data-article]:not([hidden])");
      if (firstVisible) {
        event.preventDefault();
        firstVisible.click();
      }
    });
  }

  function loadManifest() {
    return fetch("./articles/manifest.json?v=" + VERSION)
      .then(function (response) {
        if (!response.ok) throw new Error("manifest unavailable");
        return response.json();
      })
      .then(function (items) {
        rootManifest = items;
        buildSidebar(items);
      })
      .catch(function () {
        if (nav) {
          nav.innerHTML = '<p class="load-error" style="margin:0;padding:.75rem">Could not load the article list.</p>';
        }
      });
  }

  // ---------- Article router (folders + per-folder manifest.json) ----------
  //
  // Every top-level section is a folder at articles/<folder>/ with its own
  // index.html (entry point) and manifest.json (children, if any):
  //   - manifest.json == []  -> leaf folder: only index.html is shown.
  //   - manifest.json != []  -> section index: a child list is rendered
  //     from the manifest, plus a link back to "contents".
  // Real children always live inside their own folder, at
  // articles/<folder>/assets/<child>.html, addressed by the hash
  // "folder/child" — a folder's manifest never points outside itself.

  function splitPath(path) {
    var parts = path.split("/");
    return { folder: parts[0], child: parts[1] };
  }

  function markActiveLink(folder) {
    if (!nav) return;
    var links = nav.querySelectorAll("a[data-article]");
    links.forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("data-article") === folder);
    });
  }

  function showError(path) {
    content.innerHTML =
      '<div class="load-error">' +
      "<h2>Page not found</h2>" +
      "<p>Could not load <code>" + path + "</code>. " +
      "It may have been moved, renamed, or doesn't exist yet.</p>" +
      "</div>";
  }

  function insertIntoSheet(sheet, element) {
    var colophon = sheet.querySelector("footer.colophon");
    if (colophon) sheet.insertBefore(element, colophon);
    else sheet.appendChild(element);
  }

  function backToContentsLink() {
    var p = document.createElement("p");
    p.className = "back-to-root";
    p.innerHTML = '<a href="#' + INDEX_FOLDER + '">← Back to Contents</a>';
    return p;
  }

  // Top-level pager (all sections, via articles/manifest.json — same order
  // used in the sidebar).
  function buildTopPager(folder) {
    var sheet = content.querySelector(".sheet");
    if (!sheet) return;
    var index = rootManifest.findIndex(function (item) { return item.slug === folder; });
    if (index === -1) return;
    var previous = rootManifest[index - 1];
    var next = rootManifest[index + 1];

    var pager = document.createElement("nav");
    pager.className = "pager";
    pager.innerHTML =
      (previous
        ? '<a class="pager__back" href="#' + previous.slug + '">← ' + previous.titulo + "</a>"
        : "<span></span>") +
      (next
        ? '<a class="pager__next" href="#' + next.slug + '">' + next.titulo + " →</a>"
        : "<span></span>");
    sheet.appendChild(pager);
  }

  // List of a section's children (rendered from that folder's manifest.json),
  // inserted right before the fragment's colophon.
  function buildSubnav(folder, items) {
    var sheet = content.querySelector(".sheet");
    if (!sheet || !items.length) return;

    var section = document.createElement("section");
    section.className = "folder-index";
    var list = items.map(function (item) {
      return '<li><a href="#' + folder + "/" + item.slug + '"><b>' + item.titulo + "</b></a></li>";
    }).join("");
    section.innerHTML = "<h2>In this section</h2><ul class=\"plain\">" + list + "</ul>";
    insertIntoSheet(sheet, section);

    if (folder !== INDEX_FOLDER) {
      insertIntoSheet(sheet, backToContentsLink());
    }
  }

  // Pager between children of the same section (via that folder's manifest.json).
  function buildChildPager(folder, child, items) {
    var sheet = content.querySelector(".sheet");
    if (!sheet) return;
    var index = items.findIndex(function (item) { return item.slug === child; });
    var previous = index > 0 ? items[index - 1] : null;
    var next = index > -1 && index < items.length - 1 ? items[index + 1] : null;

    var pager = document.createElement("nav");
    pager.className = "pager";
    pager.innerHTML =
      (previous
        ? '<a class="pager__back" href="#' + folder + "/" + previous.slug + '">← ' + previous.titulo + "</a>"
        : '<a class="pager__back" href="#' + folder + '">← Section index</a>') +
      (next
        ? '<a class="pager__next" href="#' + folder + "/" + next.slug + '">' + next.titulo + " →</a>"
        : "<span></span>");
    sheet.appendChild(pager);

    if (folder !== INDEX_FOLDER) {
      sheet.appendChild(backToContentsLink());
    }
  }

  function loadFolderManifest(folder) {
    return fetch("./articles/" + folder + "/manifest.json?v=" + VERSION)
      .then(function (response) {
        if (!response.ok) throw new Error("section manifest unavailable");
        return response.json();
      })
      .catch(function () { return []; });
  }

  function loadArticle(path) {
    var parts = splitPath(path);
    var folder = parts.folder;
    var child = parts.child;
    var url = child
      ? "./articles/" + folder + "/assets/" + child + ".html?v=" + VERSION
      : "./articles/" + folder + "/index.html?v=" + VERSION;

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error("404");
        return response.text();
      })
      .then(function (html) {
        content.innerHTML = html;
        markActiveLink(folder);
        return loadFolderManifest(folder).then(function (items) {
          if (child) {
            buildChildPager(folder, child, items);
          } else {
            buildSubnav(folder, items);
            buildTopPager(folder);
          }
        });
      })
      .catch(function () {
        showError(path);
        markActiveLink(folder);
      });
  }

  function loadFromHash() {
    var path = location.hash.slice(1) || DEFAULT_ARTICLE;
    loadArticle(path);
  }

  if (nav) {
    nav.addEventListener("click", function (event) {
      var link = event.target.closest("a[data-article]");
      if (!link) return;
      event.preventDefault();
      var articleSlug = link.getAttribute("data-article");
      if (location.hash.slice(1) === articleSlug) {
        loadArticle(articleSlug);
      } else {
        location.hash = articleSlug;
      }
    });
  }

  window.addEventListener("hashchange", loadFromHash);
  loadManifest().then(loadFromHash);
})();
