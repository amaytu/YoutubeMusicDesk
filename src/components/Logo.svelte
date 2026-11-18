<script lang="ts">
  import logo from "../assets/logo.svg";
  let { size = 24 }: { size?: number } = $props();
</script>

<img src={logo} width={size} height={size} alt="YouTube Music Desk" draggable="false" />

<style>
  img {
    display: block;
    flex: none;
  }
</style>
