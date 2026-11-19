<script lang="ts">
  import LibraryGrid from "../components/LibraryGrid.svelte";
  import { api } from "../lib/api";
  import type { AlbumItem, PlaylistItem } from "../lib/types";
  import { dialog } from "../lib/dialog.svelte";
  import { playlists } from "../lib/playlists.svelte";

  async function create() {
    const name = await dialog.prompt("Nova playlist", { placeholder: "Nome da playlist", confirm: "Criar" });
    if (name) await playlists.create(name);
  }

  const sorts = [
    {
      id: "az",
      label: "A a Z",
      cmp: (a: AlbumItem | PlaylistItem, b: AlbumItem | PlaylistItem) =>
        a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }),
    },
  ];
</script>

<LibraryGrid title="Playlists" noun={["playlist", "playlists"]} load={api.libraryPlaylists} {sorts} onCreate={create} />
