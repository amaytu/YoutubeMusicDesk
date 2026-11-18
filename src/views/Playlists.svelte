<script lang="ts">
  import LibraryGrid from "../components/LibraryGrid.svelte";
  import { api } from "../lib/api";
  import type { AlbumItem, PlaylistItem } from "../lib/types";

  const sorts = [
    {
      id: "az",
      label: "A a Z",
      cmp: (a: AlbumItem | PlaylistItem, b: AlbumItem | PlaylistItem) =>
        a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }),
    },
  ];
</script>

<LibraryGrid title="Playlists" noun={["playlist", "playlists"]} load={api.libraryPlaylists} {sorts} />
