// Ponte entre a página oficial do YouTube Music (janela oculta "player") e a UI.
//
// - Dados: chama a API interna da própria página (/youtubei/v1/*) com a sessão do
//   usuário e devolve objetos já normalizados (Track, Album, Artist, Shelf...).
// - Reprodução: usa o player oficial da página (#movie_player).
// - Estado: emite eventos só quando algo muda (sem polling contínuo).
//
// Rust chama:   window.__ymd.call(id, method, args)  -> invoke("bridge_reply")
//               window.__ymd.cmd(name, arg)          -> fire-and-forget
// A página emite: invoke("bridge_event", { kind, data })
(() => {
  if (window.__ymdLoaded) return;
  window.__ymdLoaded = true;

  const IS_YTM = location.hostname === "music.youtube.com";
  const LOGIN_URL =
    "https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26next%3Dhttps%253A%252F%252Fmusic.youtube.com%252F";

  const ipc = (cmd, payload) => {
    try {
      return window.__TAURI_INTERNALS__?.invoke(cmd, payload);
    } catch (_) {}
  };
  const emit = (kind, data) => ipc("bridge_event", { kind, data });
  const onReady = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  // ---------------------------------------------------------------- login recusado
  if (!IS_YTM) {
    if (/^accounts\.google\./.test(location.hostname) && location.pathname.includes("/signin/rejected")) {
      onReady(() => {
        const bar = document.createElement("div");
        Object.assign(bar.style, {
          position: "fixed", left: "0", right: "0", bottom: "0", zIndex: "2147483647",
          padding: "16px", background: "#202124", color: "#fff", textAlign: "center",
          font: "14px Segoe UI, Arial, sans-serif",
        });
        bar.textContent = "O Google recusou o login neste app. ";
        const a = document.createElement("a");
        a.textContent = "Tentar de novo";
        a.href = LOGIN_URL;
        a.style.color = "#8ab4f8";
        bar.append(a);
        document.body.append(bar);
      });
    }
    return;
  }

  // ---------------------------------------------------------------- utilitários
  const q = (sel, root = document) => root.querySelector(sel);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const text = (t) => (t?.runs ? t.runs.map((r) => r.text).join("") : t?.simpleText ?? "");

  /** Primeiro valor encontrado para `key` em qualquer profundidade. */
  function find(obj, key) {
    if (!obj || typeof obj !== "object") return undefined;
    if (key in obj) return obj[key];
    for (const v of Object.values(obj)) {
      const r = find(v, key);
      if (r !== undefined) return r;
    }
    return undefined;
  }

  /** Todos os valores para `key` (sem descer dentro de um item já encontrado). */
  function collect(obj, key, out = []) {
    if (!obj || typeof obj !== "object") return out;
    if (Array.isArray(obj)) {
      for (const v of obj) collect(v, key, out);
      return out;
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k === key) out.push(v);
      else collect(v, key, out);
    }
    return out;
  }

  const thumbOf = (o) => {
    const list = find(o, "thumbnails");
    return Array.isArray(list) && list.length ? list[list.length - 1].url : "";
  };

  const pageType = (ep) =>
    ep?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType ?? "";

  const DURATION = /^\d{1,2}(:\d{2}){1,2}$/;

  /** Lê "runs" de subtítulo: artistas, álbum, duração e texto exibível. */
  function parseRuns(runs = []) {
    const artists = [];
    let album, duration, year;
    for (const r of runs) {
      const ep = r.navigationEndpoint?.browseEndpoint;
      const pt = pageType(ep);
      if (pt === "MUSIC_PAGE_TYPE_ARTIST" || pt === "MUSIC_PAGE_TYPE_USER_CHANNEL")
        artists.push({ name: r.text, id: ep.browseId });
      else if (pt === "MUSIC_PAGE_TYPE_ALBUM") album = { name: r.text, id: ep.browseId };
      else if (DURATION.test(r.text.trim())) duration = r.text.trim();
      else if (/^\d{4}$/.test(r.text.trim())) year = r.text.trim();
    }
    const subtitle = runs.map((r) => r.text).join("");
    return { artists, album, duration, year, subtitle };
  }

  /** Converte um item de lista/grade em um "card" genérico. */
  function parseItem(it) {
    const two = it.musicTwoRowItemRenderer;
    const row = it.musicResponsiveListItemRenderer;
    const r = two || row;
    if (!r) return null;

    let title, subtitleRuns, nav, videoId, playlistId, duration;
    if (two) {
      title = text(two.title);
      subtitleRuns = two.subtitle?.runs ?? [];
      nav = two.navigationEndpoint;
    } else {
      const cols = (row.flexColumns ?? []).map((c) => c.musicResponsiveListItemFlexColumnRenderer?.text);
      title = text(cols[0]);
      subtitleRuns = cols.slice(1).flatMap((c, i) => (i > 0 ? [{ text: " • " }, ...(c?.runs ?? [])] : c?.runs ?? []));
      nav = row.navigationEndpoint ?? cols[0]?.runs?.[0]?.navigationEndpoint;
      const fixed = row.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text;
      duration = text(fixed) || undefined;
      videoId = row.playlistItemData?.videoId;
    }
    const watch = nav?.watchEndpoint ?? find(r.overlay, "watchEndpoint") ?? find(r, "watchEndpoint");
    videoId = videoId ?? (nav?.watchEndpoint ? nav.watchEndpoint.videoId : undefined);
    playlistId = watch?.playlistId;

    const info = parseRuns(subtitleRuns);
    const browse = nav?.browseEndpoint;
    const pt = pageType(browse);
    const base = { title, subtitle: info.subtitle, thumb: thumbOf(r.thumbnailRenderer ?? r.thumbnail) };

    if (browse && (pt === "MUSIC_PAGE_TYPE_ARTIST" || pt === "MUSIC_PAGE_TYPE_USER_CHANNEL"))
      return { kind: "artist", id: browse.browseId, ...base };
    if (browse && pt === "MUSIC_PAGE_TYPE_ALBUM")
      return { kind: "album", id: browse.browseId, artists: info.artists, year: info.year, ...base };
    if (browse && pt === "MUSIC_PAGE_TYPE_PLAYLIST")
      return { kind: "playlist", id: browse.browseId, ...base };
    if (videoId || watch?.videoId)
      return {
        kind: "song",
        videoId: videoId ?? watch.videoId,
        playlistId,
        artists: info.artists,
        album: info.album,
        duration: duration ?? info.duration,
        ...base,
      };
    if (browse?.browseId) return { kind: "other", id: browse.browseId, ...base };
    return null;
  }

  const parseItems = (arr) => (arr ?? []).map(parseItem).filter(Boolean);

  /** Prateleiras (home, busca, artista): título + itens. */
  function parseShelves(root) {
    const shelves = [];
    const sections = find(root, "sectionListRenderer")?.contents ?? [];
    for (const s of sections) {
      const car = s.musicCarouselShelfRenderer;
      const shelf = s.musicShelfRenderer;
      const card = s.musicCardShelfRenderer;
      if (car) {
        const h = car.header?.musicCarouselShelfBasicHeaderRenderer;
        shelves.push({ title: text(h?.title), items: parseItems(car.contents) });
      } else if (shelf) {
        shelves.push({ title: text(shelf.title), items: parseItems(shelf.contents) });
      } else if (card) {
        // Resultado principal da busca.
        const nav = card.title?.runs?.[0]?.navigationEndpoint;
        const item = parseItem({
          musicTwoRowItemRenderer: { title: card.title, subtitle: card.subtitle, navigationEndpoint: nav, thumbnailRenderer: card.thumbnail },
        });
        const items = [item, ...parseItems(card.contents)].filter(Boolean);
        shelves.push({ title: text(card.header?.musicCardShelfHeaderBasicRenderer?.title), top: true, items });
      }
    }
    return shelves.filter((s) => s.items.length);
  }

  // ---------------------------------------------------------------- InnerTube
  const cookie = (name) => document.cookie.split("; ").find((c) => c.startsWith(name + "="))?.slice(name.length + 1);

  async function sha1(s) {
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function ytcfgReady() {
    for (let i = 0; i < 150; i++) {
      if (window.ytcfg?.get?.("INNERTUBE_CONTEXT")) return window.ytcfg;
      await sleep(100);
    }
    throw new Error("YouTube Music não carregou");
  }

  /** Cliente mobile do YT Music: devolve letras com tempo (o web não). */
  const MOBILE_CLIENT = { clientName: "ANDROID_MUSIC", clientVersion: "7.21.50", nameId: "21" };

  async function api(endpoint, body, { mobile = false } = {}) {
    const cfg = await ytcfgReady();
    const headers = {
      "Content-Type": "application/json",
      "X-Goog-AuthUser": String(cfg.get("SESSION_INDEX") ?? "0"),
      "X-Origin": location.origin,
      "X-Youtube-Client-Name": mobile ? MOBILE_CLIENT.nameId : String(cfg.get("INNERTUBE_CONTEXT_CLIENT_NAME") ?? "67"),
      "X-Youtube-Client-Version": mobile ? MOBILE_CLIENT.clientVersion : String(cfg.get("INNERTUBE_CLIENT_VERSION") ?? ""),
    };
    const visitor = cfg.get("VISITOR_DATA");
    if (visitor) headers["X-Goog-Visitor-Id"] = visitor;
    const sapisid = cookie("__Secure-3PAPISID") || cookie("SAPISID");
    if (sapisid) {
      const ts = Math.floor(Date.now() / 1000);
      headers.Authorization = `SAPISIDHASH ${ts}_${await sha1(`${ts} ${sapisid} ${location.origin}`)}`;
    }
    const key = cfg.get("INNERTUBE_API_KEY");
    let res;
    try {
      res = await fetch(`/youtubei/v1/${endpoint}?prettyPrint=false${key ? `&key=${key}` : ""}`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ context: mobile ? mobileContext(cfg) : cfg.get("INNERTUBE_CONTEXT"), ...body }),
      });
    } catch (_) {
      throw new Error("Sem conexão com a internet");
    }
    if (res.status === 401 && !mobile) refreshSession();
    if (!res.ok) throw new Error(`YouTube Music respondeu ${res.status}`);
    return res.json();
  }

  /**
   * Sessão expirada (401): recarrega a página para renovar os tokens. Se a conta
   * saiu de verdade, o "ready" seguinte avisa a UI (signedIn: false).
   * No máximo uma vez a cada 2 min, para nunca entrar em loop.
   */
  function refreshSession() {
    const KEY = "__ymdSessionReload";
    const lastAt = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - lastAt < 120_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
    const wasPlaying = !!q("video") && !q("video").paused;
    if (!wasPlaying) setTimeout(() => location.reload(), 300);
  }

  function mobileContext(cfg) {
    const ctx = JSON.parse(JSON.stringify(cfg.get("INNERTUBE_CONTEXT") ?? {}));
    ctx.client = { ...(ctx.client ?? {}), clientName: MOBILE_CLIENT.clientName, clientVersion: MOBILE_CLIENT.clientVersion };
    return ctx;
  }

  const browse = (browseId, params) => api("browse", params ? { browseId, params } : { browseId });

  /** browseId da letra (MPLY...) a partir do "next" da faixa. */
  async function lyricsBrowseId(videoId) {
    const next = await api("next", { videoId, isAudioOnly: true });
    const tabs = find(next, "tabs") ?? [];
    const ep = tabs
      .map((t) => t.tabRenderer?.endpoint?.browseEndpoint)
      .find((e) => pageType(e) === "MUSIC_PAGE_TYPE_TRACK_LYRICS" || e?.browseId?.startsWith("MPLY"));
    return ep?.browseId ?? null;
  }

  const nextToken = (r) =>
    find(r, "continuationCommand")?.token ?? find(r, "nextContinuationData")?.continuation;

  /** Busca uma lista paginada (biblioteca, playlists longas). */
  async function browseAll(browseId, maxItems = 3000) {
    const rawItems = (r) => [
      ...collect(r, "musicResponsiveListItemRenderer").map((x) => ({ musicResponsiveListItemRenderer: x })),
      ...collect(r, "musicTwoRowItemRenderer").map((x) => ({ musicTwoRowItemRenderer: x })),
    ];
    let resp = await browse(browseId);
    const first = resp;
    const items = rawItems(resp);
    let token = nextToken(resp);
    let pages = 0;
    while (token && items.length < maxItems && pages++ < 60) {
      resp = await api("browse", { continuation: token });
      const more = rawItems(resp);
      if (!more.length) break;
      items.push(...more);
      token = nextToken(resp);
    }
    return { first, items: parseItems(items) };
  }

  // ---------------------------------------------------------------- métodos de dados
  const header = (r) =>
    find(r, "musicResponsiveHeaderRenderer") ??
    find(r, "musicDetailHeaderRenderer") ??
    find(r, "musicImmersiveHeaderRenderer") ??
    find(r, "musicVisualHeaderRenderer") ??
    {};

  const methods = {
    async auth() {
      await ytcfgReady();
      return { signedIn: !!window.ytcfg.get("LOGGED_IN") };
    },

    async home() {
      const r = await browse("FEmusic_home");
      const shelves = parseShelves(r);
      const token = nextToken(r);
      if (token) {
        try {
          const more = await api("browse", { continuation: token });
          const contents = find(more, "sectionListContinuation")?.contents ?? find(more, "continuationItems") ?? [];
          shelves.push(...parseShelves({ sectionListRenderer: { contents } }));
        } catch (_) {}
      }
      return shelves;
    },

    async search({ query }) {
      const r = await api("search", { query });
      return parseShelves(r);
    },

    async librarySongs() {
      return (await browseAll("FEmusic_liked_videos")).items.filter((i) => i.kind === "song");
    },
    async libraryAlbums() {
      return (await browseAll("FEmusic_liked_albums")).items.filter((i) => i.kind === "album");
    },
    async libraryArtists() {
      return (await browseAll("FEmusic_library_corpus_track_artists")).items.filter((i) => i.kind === "artist");
    },
    async libraryPlaylists() {
      return (await browseAll("FEmusic_liked_playlists")).items.filter((i) => i.kind === "playlist");
    },

    /** Álbum ou playlist (browseId MPRE... ou VL...). */
    async collection({ id }) {
      const { first, items } = await browseAll(id);
      const h = header(first);
      const strap = parseRuns(h.straplineTextOne?.runs ?? []);
      const sub = parseRuns(h.subtitle?.runs ?? []);
      const artists = strap.artists.length ? strap.artists : sub.artists;
      const isAlbum = id.startsWith("MPRE");
      const tracks = items
        .filter((i) => i.kind === "song")
        .map((t) => ({
          ...t,
          artists: t.artists?.length ? t.artists : artists,
          thumb: t.thumb || thumbOf(h.thumbnail),
        }));
      const playlistId =
        find(h, "watchPlaylistEndpoint")?.playlistId ??
        find(first, "watchPlaylistEndpoint")?.playlistId ??
        tracks.find((t) => t.playlistId)?.playlistId ??
        (id.startsWith("VL") ? id.slice(2) : undefined);
      return {
        kind: isAlbum ? "album" : "playlist",
        id,
        title: text(h.title),
        subtitle: text(h.subtitle),
        info: text(h.secondSubtitle),
        description: text(find(h, "description")?.musicDescriptionShelfRenderer?.description ?? h.description),
        artists,
        year: sub.year,
        thumb: thumbOf(h.thumbnail),
        playlistId,
        editable: !!find(first, "musicEditablePlaylistDetailHeaderRenderer"),
        tracks,
      };
    },

    async artist({ id }) {
      const r = await browse(id);
      const h = header(r);
      const sections = find(r, "sectionListRenderer")?.contents ?? [];
      let songs = [], songsPlaylistId, songsBrowseId;
      const albums = [], singles = [], related = [], videos = [];
      let description = text(h.description);
      let albumShelves = 0;
      for (const s of sections) {
        if (s.musicShelfRenderer) {
          songs = parseItems(s.musicShelfRenderer.contents).filter((i) => i.kind === "song");
          songsBrowseId = find(s.musicShelfRenderer.bottomEndpoint ?? s.musicShelfRenderer.title, "browseId");
          songsPlaylistId = songs.find((t) => t.playlistId)?.playlistId;
        } else if (s.musicCarouselShelfRenderer) {
          const items = parseItems(s.musicCarouselShelfRenderer.contents);
          if (items.some((i) => i.kind === "album")) {
            (albumShelves++ === 0 ? albums : singles).push(...items.filter((i) => i.kind === "album"));
          } else if (items.some((i) => i.kind === "artist")) {
            related.push(...items.filter((i) => i.kind === "artist"));
          } else if (items.some((i) => i.kind === "song")) {
            videos.push(...items.filter((i) => i.kind === "song"));
          }
        } else if (s.musicDescriptionShelfRenderer && !description) {
          description = text(s.musicDescriptionShelfRenderer.description);
        }
      }
      const play = find(h, "watchPlaylistEndpoint") ?? find(h.playButton, "watchEndpoint");
      const radio = find(h.startRadioButton, "watchPlaylistEndpoint") ?? find(h.startRadioButton, "watchEndpoint");
      return {
        id,
        name: text(h.title),
        description,
        thumb: thumbOf(h.thumbnail),
        subscribers: text(find(h, "subscriberCountText")) || text(find(h, "longSubscriberCountText")),
        monthlyListeners: text(h.monthlyListenerCount),
        playlistId: play?.playlistId ?? songsPlaylistId,
        radioPlaylistId: radio?.playlistId,
        songsBrowseId,
        songs,
        albums,
        singles,
        videos,
        related,
      };
    },

    /** Letra com tempo do próprio YT Music (mesma faixa que está tocando). */
    async timedLyrics({ videoId }) {
      const id = await lyricsBrowseId(videoId);
      if (!id) return null;
      const r = await api("browse", { browseId: id }, { mobile: true });
      const data = find(r, "timedLyricsData");
      if (!Array.isArray(data) || !data.length) return null;
      const lines = data
        .map((l) => ({ t: Number(l.cueRange?.startTimeMilliseconds ?? NaN) / 1000, text: (l.lyricLine ?? "").trim() || "♪" }))
        .filter((l) => Number.isFinite(l.t))
        .sort((a, b) => a.t - b.t);
      const source = text(find(r, "sourceMessage")) || text(find(r, "footer")) || "";
      return lines.length ? { lines, source } : null;
    },

    async lyrics({ videoId }) {
      const id = await lyricsBrowseId(videoId);
      if (!id) return null;
      const r = await browse(id);
      const shelf = find(r, "musicDescriptionShelfRenderer");
      if (!shelf) return null;
      return { text: text(shelf.description), source: text(shelf.footer) };
    },

    async queue() {
      return queueItems().map(({ d, el }, index) => {
        const info = parseRuns(d.longBylineText?.runs ?? d.shortBylineText?.runs ?? []);
        return {
          kind: "song",
          index,
          videoId: d.videoId,
          title: text(d.title),
          subtitle: text(d.shortBylineText),
          artists: info.artists,
          album: info.album,
          duration: text(d.lengthText),
          thumb: thumbOf(d.thumbnail),
          selected: !!(d.selected || el.hasAttribute("selected")),
        };
      }).filter((t) => t.videoId);
    },

    /**
     * Filtros do "A seguir": só Tudo / Conhecidas / Em alta / Descobrir.
     * A página tem mais de um grupo de chips (e gêneros); deduplica pelo nome.
     */
    queueChips() {
      const out = [];
      const found = queueChipMap();
      // O "selecionado" do YT Music nem sempre se atualiza no objeto de dados
      // (ficava preso em "Tudo"): vale a escolha feita aqui, enquanto a fila for a mesma.
      const chosen = chosenChip && found.some((c) => c.label === chosenChip) ? chosenChip : null;
      for (const c of found) {
        out.push({ index: c.index, label: c.label, selected: chosen ? c.label === chosen : c.selected });
      }
      if (!chosen && out.length && !out.some((c) => c.selected)) out[0].selected = true;
      return out;
    },

    /**
     * Playlists em que o usuário pode adicionar (as dele), já dizendo se a
     * música está em cada uma. Mesmo endpoint do "Salvar na playlist".
     */
    async addTargets({ videoId }) {
      const r = await api("playlist/get_add_to_playlist", { videoIds: [videoId], excludeWatchLater: true });
      return collect(r, "playlistAddToOptionRenderer")
        .filter((o) => o.playlistId)
        .map((o) => ({
          playlistId: o.playlistId,
          title: text(o.title),
          contains: o.containsSelectedVideos === "ALL",
        }));
    },

    /** Adiciona ou remove a música de uma playlist. */
    async editPlaylist({ playlistId, videoId, add }) {
      const action = add
        ? { action: "ACTION_ADD_VIDEO", addedVideoId: videoId, dedupeOption: "DEDUPE_OPTION_SKIP" }
        : { action: "ACTION_REMOVE_VIDEO_BY_VIDEO_ID", removedVideoId: videoId };
      const r = await api("browse/edit_playlist", { playlistId, actions: [action] });
      if (r.status && r.status !== "STATUS_SUCCEEDED") throw new Error("O YouTube Music recusou a alteração");
      return true;
    },

    /** Cria uma playlist (privada por padrão), já com as músicas indicadas. */
    async createPlaylist({ title, privacy = "PRIVATE", videoIds = [] }) {
      const name = String(title ?? "").trim().slice(0, 150);
      if (!name) throw new Error("Dê um nome para a playlist");
      const body = { title: name, description: "", privacyStatus: privacy };
      if (videoIds.length) body.videoIds = videoIds;
      const r = await api("playlist/create", body);
      if (!r.playlistId) throw new Error("O YouTube Music não criou a playlist");
      return { playlistId: r.playlistId, title: name };
    },

    async renamePlaylist({ playlistId, title }) {
      const name = String(title ?? "").trim().slice(0, 150);
      if (!name) throw new Error("Dê um nome para a playlist");
      const r = await api("browse/edit_playlist", {
        playlistId,
        actions: [{ action: "ACTION_SET_PLAYLIST_NAME", playlistName: name }],
      });
      if (r.status && r.status !== "STATUS_SUCCEEDED") throw new Error("O YouTube Music recusou a alteração");
      return true;
    },

    async deletePlaylist({ playlistId }) {
      await api("playlist/delete", { playlistId });
      return true;
    },

    /** Curtir (like=true) ou tirar a curtida de qualquer música. */
    async rate({ videoId, like }) {
      await api(like ? "like/like" : "like/removelike", { target: { videoId } });
      // Se for a música tocando, a barra do player atualiza sozinha; avisa a UI.
      setTimeout(emitState, 400);
      return true;
    },

    state() {
      return snapshot();
    },
  };

  // ---------------------------------------------------------------- fila
  /** Dados de um item da fila (o YT Music às vezes embrulha música + vídeo). */
  const itemData = (el) =>
    el.data?.playlistPanelVideoRenderer ??
    el.data?.primaryRenderer?.playlistPanelVideoRenderer ??
    el.data ??
    {};

  /**
   * Itens da fila na ordem exibida. A versão alternativa (vídeo/música) de cada
   * faixa fica escondida no DOM; ignorá-la mantém os índices alinhados.
   */
  function queueItems() {
    const root = q("ytmusic-player-queue") ?? document;
    const seen = new Set();
    const out = [];
    for (const el of root.querySelectorAll("ytmusic-player-queue-item")) {
      if (el.closest("#counterpart-renderer, [hidden]") || el.hasAttribute("hidden")) continue;
      const d = itemData(el);
      const key = (d.videoId ?? "") + ":" + out.length;
      if (!d.videoId || seen.has(key)) continue;
      seen.add(key);
      out.push({ el, d });
    }
    return out;
  }

  const WANTED_CHIPS = [
    { label: "Tudo", re: /^(tudo|todos|all)$/i },
    { label: "Conhecidas", re: /^(conhecidas?|familiar)$/i },
    { label: "Em alta", re: /^(em alta|popular|trending)$/i },
    { label: "Descobrir", re: /^(descobrir|discover)$/i },
  ];
  /** Filtro escolhido pelo app (vale até tocar outra lista). */
  let chosenChip = null;

  /** Selecionado pelo DOM (classe/atributos atualizados na hora); dados só como último recurso. */
  function chipSelected(el) {
    if (el.hasAttribute("is-selected") || el.classList.contains("selected") || el.classList.contains("iron-selected")) return true;
    const inner = el.querySelector('[aria-selected="true"], [aria-pressed="true"], .selected');
    if (inner) return true;
    const hasDomSignal = el.hasAttribute("aria-selected") || !!el.querySelector("[aria-selected], [aria-pressed]");
    return hasDomSignal ? el.getAttribute("aria-selected") === "true" : !!el.data?.isSelected;
  }

  /**
   * Os 4 filtros da fila, do primeiro grupo de chips que os tem (o da fila).
   * A página tem mais de um grupo (e gêneros); deduplica pelo nome.
   */
  function queueChipMap() {
    const all = chipEls();
    const nameOf = (el) => (text(el.data?.text) || el.textContent).trim();
    const groupOf = (el) => el.closest("ytmusic-chip-cloud-renderer") ?? el.parentElement;
    const first = all.find((el) => WANTED_CHIPS.some((w) => w.re.test(nameOf(el))));
    const group = first ? groupOf(first) : null;
    const out = [];
    for (const w of WANTED_CHIPS) {
      const matches = all
        .map((el, index) => ({ el, index, name: nameOf(el) }))
        .filter((c) => !group || groupOf(c.el) === group)
        .filter((c) => w.re.test(c.name));
      if (!matches.length) continue;
      out.push({ index: matches[0].index, el: matches[0].el, label: w.label, selected: matches.some((c) => chipSelected(c.el)) });
    }
    return out;
  }

  /** Chips do "A seguir" (Tudo / Conhecidas / Descobrir) da página do player. */
  function chipEls() {
    const page = q("ytmusic-player-page") ?? document;
    return [...page.querySelectorAll("ytmusic-chip-cloud-chip-renderer")].filter(
      (el) => !el.closest("[hidden]") && !el.hasAttribute("hidden"),
    );
  }

  // ---------------------------------------------------------------- reprodução
  const player = () => document.getElementById("movie_player");
  const app = () => q("ytmusic-app");
  const SHUFFLE_PARAMS = "wAEB8gECKAE%3D";

  async function play({ videoId, playlistId, shuffle, endpoint: given, fallback }) {
    if (!given) chosenChip = null;
    const endpoint =
      given ??
      (videoId
        ? { watchEndpoint: { videoId, playlistId } }
        : { watchPlaylistEndpoint: { playlistId, params: shuffle ? SHUFFLE_PARAMS : undefined } });
    const before = player()?.getVideoData?.()?.video_id;
    const listNow = () => new URL(location.href).searchParams.get("list");
    const beforeList = listNow();
    if (videoId && videoId === before) {
      startedFor = "";
      player()?.seekTo?.(0, true);
      player()?.playVideo?.();
      return;
    }
    const started = async (ms) => {
      for (let t = 0; t < ms; t += 100) {
        await sleep(100);
        const now = player()?.getVideoData?.()?.video_id;
        if (now && now !== before && (!videoId || now === videoId)) return true;
        // playlist que começa na mesma música que já tocava: a URL mostra a lista nova
        if (!videoId && playlistId && now && beforeList !== playlistId && listNow() === playlistId) return true;
      }
      return false;
    };
    // 1) navegação interna do app (sem recarregar)
    try { app()?.navigate_?.(endpoint); } catch (_) {}
    if (await started(1200)) return;
    // 2) evento de navegação do Polymer
    (q("ytmusic-player-bar") ?? document.body).dispatchEvent(
      new CustomEvent("yt-navigate", { bubbles: true, composed: true, detail: { endpoint } }),
    );
    if (await started(4000)) return;
    // 3) clique no próprio elemento (ex.: item da fila), se houver
    if (fallback) {
      fallback();
      if (await started(2500)) return;
    }
    // 4) navegação comum (recarrega a página)
    const url = new URL("/watch", location.origin);
    if (videoId) url.searchParams.set("v", videoId);
    if (playlistId) url.searchParams.set("list", playlistId);
    location.href = url.toString();
  }

  const click = (...sels) => {
    for (const s of sels) {
      const el = q(s);
      if (el) { el.click(); return true; }
    }
    return false;
  };

  const commands = {
    playItem(args) { play(args ?? {}); },
    playPause() {
      const p = player();
      if (!p) return click("#play-pause-button");
      p.getPlayerState?.() === 1 ? p.pauseVideo() : p.playVideo();
    },
    play() { player()?.playVideo?.(); },
    pause() { player()?.pauseVideo?.(); },
    next() { click("ytmusic-player-bar .next-button") || player()?.nextVideo?.(); },
    prev() { click("ytmusic-player-bar .previous-button") || player()?.previousVideo?.(); },
    seek(sec) { player()?.seekTo?.(Number(sec), true); },
    volume(v) {
      const p = player();
      if (!p) return;
      p.setVolume(Math.round(Number(v)));
      Number(v) > 0 ? p.unMute?.() : p.mute?.();
      emitState();
    },
    /** Embaralha a fila (o YT Music não tem "desembaralhar"). */
    shuffle() {
      const ok = click(
        "ytmusic-player-bar .shuffle",
        "ytmusic-player-bar tp-yt-paper-icon-button.shuffle",
        "ytmusic-player-bar #right-controls .shuffle",
        'ytmusic-player-bar [aria-label*="aleat" i]',
        'ytmusic-player-bar [aria-label*="shuffle" i]',
        "ytmusic-player-page .shuffle",
      );
      // Sem o botão: reabre a playlist/rádio atual em modo aleatório.
      if (!ok) {
        const list = new URL(location.href).searchParams.get("list");
        if (list) play({ playlistId: list, shuffle: true });
      }
    },
    /** Repetir: só "em sequência" (false) ou "repetir esta música" (true). */
    /** { videoId: segundos } — substitui a lista inteira. */
    setStartTimes(map) {
      startAt = map && typeof map === "object" ? map : {};
      try { localStorage.setItem(START_KEY, JSON.stringify(startAt)); } catch (_) {}
    },
    repeatOne(on) {
      repeatOne = !!on;
      const v = q("video");
      if (v) v.loop = repeatOne;
      emitState();
    },
    like() {
      click("ytmusic-player-bar ytmusic-like-button-renderer #button-shape-like button", "ytmusic-player-bar ytmusic-like-button-renderer .like");
      setTimeout(emitState, 300);
    },
    /** Filtro do "A seguir": clica no chip correspondente do YouTube Music. */
    selectQueueChip(arg) {
      // Aceita o rótulo ("Em alta") ou o índice antigo; o rótulo é procurado de novo
      // na hora porque o YT Music pode ter redesenhado os chips.
      const label = typeof arg === "object" && arg ? arg.label : null;
      const map = queueChipMap();
      const hit = (label && map.find((c) => c.label === label)) || map.find((c) => c.index === Number(arg?.index ?? arg));
      const el = hit?.el ?? chipEls()[Number(arg?.index ?? arg)];
      if (!el) return;
      chosenChip = hit?.label ?? null;
      (q("a", el) ?? q("button", el) ?? q("#chip", el) ?? el).click();
    },
    /** Toca um item da fila sem desmontar a fila (usa o endpoint do próprio item). */
    playQueueItem({ videoId, index }) {
      const items = queueItems();
      const hit =
        (items[index]?.d.videoId === videoId && items[index]) || items.find((x) => x.d.videoId === videoId);
      if (!hit) return play({ videoId });
      const { el, d } = hit;
      const ep = d.navigationEndpoint?.watchEndpoint
        ? { watchEndpoint: d.navigationEndpoint.watchEndpoint }
        : { watchEndpoint: { videoId: d.videoId } };
      const clickIt = () => {
        const target = q("ytmusic-play-button-renderer", el) ?? q(".song-info", el) ?? el;
        target.click();
      };
      play({ videoId: d.videoId, endpoint: ep, fallback: clickIt });
    },
  };

  // ---------------------------------------------------------------- estado
  function snapshot() {
    const p = player();
    const v = q("video");
    // O YT Music às vezes troca o <video> (ex.: ao embaralhar): reconecta os eventos.
    if (v) hookVideo(v);
    const md = navigator.mediaSession?.metadata;
    const bar = q("ytmusic-player-bar");
    const like = q("ytmusic-like-button-renderer", bar ?? document)?.getAttribute("like-status");
    const vid = p?.getVideoData?.()?.video_id ?? "";
    const art = md?.artwork?.length
      ? md.artwork[md.artwork.length - 1].src
      : vid
        ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`
        : "";
    const albumLink = [...(bar?.querySelectorAll(".byline a") ?? [])];
    const artistLinks = albumLink.filter((a) => a.href.includes("channel/") || a.href.includes("browse/UC"));
    const albumA = albumLink.find((a) => a.href.includes("browse/MPRE"));
    return {
      videoId: vid,
      title: md?.title ?? "",
      artist: md?.artist ?? "",
      album: md?.album ?? "",
      artistId: artistLinks[0]?.href.split("/").pop() ?? "",
      albumId: albumA?.href.split("/").pop() ?? "",
      thumb: art,
      // Tempo e duração da API do player (sempre da mesma faixa que videoId).
      // Na troca de faixa o <video> ainda pode ter a duração da anterior;
      // getDuration() fica 0 até a nova carregar, e a UI espera.
      ...timing(p, v),
      playing: !!v && !v.paused && !v.ended,
      volume: p?.getVolume?.() ?? 100,
      muted: !!p?.isMuted?.(),
      liked: like === "LIKE",
      repeat: repeatOne ? "ONE" : "NONE",
      at: Date.now(),
    };
  }

  function timing(p, v) {
    const hasApi = typeof p?.getDuration === "function";
    const pd = hasApi ? Number(p.getDuration()) : NaN;
    const pt = typeof p?.getCurrentTime === "function" ? Number(p.getCurrentTime()) : NaN;
    const duration = hasApi ? (pd > 0 ? pd : 0) : Number.isFinite(v?.duration) ? v.duration : 0;
    let time = Number.isFinite(pt) ? pt : v?.currentTime ?? 0;
    if (duration > 0) time = Math.min(time, duration);
    return { duration, time };
  }

  let repeatOne = false;

  // ---------------------------------------------------------------- início personalizado
  // Algumas músicas têm introdução longa (ex.: "Time", do Pink Floyd, começa em 2:15).
  // O usuário escolhe o segundo de início; vale toda vez que a música começa do zero.
  const START_KEY = "__ymdStartAt";
  let startAt = {};
  try { startAt = JSON.parse(localStorage.getItem(START_KEY) ?? "{}") || {}; } catch (_) {}
  let startedFor = "";
  let prevTime = 0;
  function applyStart(v) {
    const p = player();
    const vid = p?.getVideoData?.()?.video_id;
    if (!vid) return;
    const t = v.currentTime;
    // repetir esta música: o vídeo voltou do fim para o começo
    if (vid === startedFor && t < 1 && prevTime > (v.duration || 0) - 3) startedFor = "";
    prevTime = t;
    if (vid === startedFor) return;
    startedFor = vid;
    const s = Number(startAt[vid]);
    if (!(s > 0) || t > 3 || (v.duration && s >= v.duration - 1)) return;
    p.seekTo?.(s, true);
  }
  let stateQueued = false;
  /** Último estado enviado: base para detectar desvio do relógio da UI. */
  let last = { time: 0, at: 0, playing: false, videoId: "" };
  function emitState() {
    if (stateQueued) return;
    stateQueued = true;
    setTimeout(() => {
      stateQueued = false;
      const snap = snapshot();
      last = { time: snap.time, at: snap.at, playing: snap.playing, videoId: snap.videoId };
      emit("state", snap);
    }, 50);
  }

  /**
   * Correção de relógio: a UI interpola o tempo a partir do último estado.
   * Enquanto toca, reenvia a cada 5 s ou na hora se o tempo real divergir
   * (troca de faixa sem evento, seek interno, buffer etc.).
   */
  function onTimeUpdate(e) {
    const now = Date.now();
    const p = player();
    const { time } = timing(p, e.currentTarget);
    const expected = last.playing ? last.time + (now - last.at) / 1000 : last.time;
    applyStart(e.currentTarget);
    const vid = p?.getVideoData?.()?.video_id ?? "";
    if (vid !== last.videoId || Math.abs(time - expected) > 1.0 || now - last.at > 5000) emitState();
  }

  // Detecta troca de faixa no instante em que o YT Music atualiza o mediaSession.
  try {
    const desc = Object.getOwnPropertyDescriptor(MediaSession.prototype, "metadata");
    if (desc?.set) {
      Object.defineProperty(MediaSession.prototype, "metadata", {
        configurable: true,
        get() { return desc.get.call(this); },
        set(v) { desc.set.call(this, v); emitState(); },
      });
    }
  } catch (_) {}

  function hookVideo(v) {
    if (!v || v.__ymdHooked) return;
    v.__ymdHooked = true;
    for (const ev of ["play", "playing", "pause", "waiting", "ended", "seeked", "loadedmetadata", "durationchange", "ratechange", "volumechange", "emptied"])
      v.addEventListener(ev, emitState);
    v.addEventListener("timeupdate", onTimeUpdate);
    // O YT Music pode resetar o loop ao trocar de faixa: reaplica o modo escolhido.
    v.addEventListener("loadedmetadata", () => (v.loop = repeatOne));
    // "Ainda está ouvindo?" -> confirma automaticamente.
    v.addEventListener("pause", () =>
      setTimeout(() => {
        const dlg = q("ytmusic-you-there-renderer");
        if (dlg && dlg.offsetParent !== null) {
          (q("button", dlg) ?? dlg).click();
          player()?.playVideo?.();
        }
      }, 800),
    );
  }

  // ---------------------------------------------------------------- API exposta ao Rust
  window.__ymd = {
    async call(id, method, args) {
      try {
        const fn = methods[method];
        if (!fn) throw new Error(`método desconhecido: ${method}`);
        const data = await fn(args ?? {});
        ipc("bridge_reply", { id, ok: true, data: data ?? null });
      } catch (e) {
        ipc("bridge_reply", { id, ok: false, data: String(e?.message ?? e) });
      }
    },
    cmd(name, arg) {
      try { commands[name]?.(arg); } catch (_) {}
    },
  };

  onReady(async () => {
    try {
      await ytcfgReady();
    } catch (_) {}
    emit("ready", { signedIn: !!window.ytcfg?.get?.("LOGGED_IN") });
    // O <video> é criado sob demanda e pode ser trocado (ex.: ao embaralhar).
    // Observa o documento só até ele existir; depois, só o contêiner do vídeo.
    const watchContainer = (v) => {
      const box = v.closest(".html5-video-container") ?? v.parentElement;
      if (!box || box.__ymdWatched) return;
      box.__ymdWatched = true;
      new MutationObserver(() => {
        const nv = q("video");
        if (nv && !nv.__ymdHooked) { hookVideo(nv); watchContainer(nv); emitState(); }
      }).observe(box, { childList: true });
    };
    const v = q("video");
    if (v) { hookVideo(v); watchContainer(v); }
    else {
      const mo = new MutationObserver(() => {
        const v2 = q("video");
        if (v2) { hookVideo(v2); watchContainer(v2); mo.disconnect(); emitState(); }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }
    // Curtir e repetir alteram atributos da barra do player.
    const watchBar = () => {
      const bar = q("ytmusic-player-bar");
      if (!bar) return setTimeout(watchBar, 1000);
      new MutationObserver(emitState).observe(bar, { attributes: true, attributeFilter: ["repeat-mode"] });
      const like = q("ytmusic-like-button-renderer", bar);
      if (like) new MutationObserver(emitState).observe(like, { attributes: true, attributeFilter: ["like-status"] });
    };
    watchBar();
    emitState();
  });
})();
