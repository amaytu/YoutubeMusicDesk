<script lang="ts">
  import LibraryGrid from "../components/LibraryGrid.svelte";
  import { api } from "../lib/api";
  import type { AlbumItem, PlaylistItem } from "../lib/types";

  const by = (f: (x: AlbumItem) => string) => (a: AlbumItem | PlaylistItem, b: AlbumItem | PlaylistItem) =>
    f(a as AlbumItem).localeCompare(f(b as AlbumItem), "pt-BR", { sensitivity: "base" });

  const sorts = [
    { id: "az", label: "A a Z", cmp: by((x) => x.title) },
    { id: "artist", label: "Artista", cmp: by((x) => x.artists?.[0]?.name ?? x.subtitle ?? "") },
    { id: "year", label: "Ano", cmp: (a: AlbumItem | PlaylistItem, b: AlbumItem | PlaylistItem) => Number((b as AlbumItem).year ?? 0) - Number((a as AlbumItem).year ?? 0) },
  ];
</script>

<LibraryGrid title="Álbuns" noun={["álbum", "álbuns"]} load={api.libraryAlbums} {sorts} />
