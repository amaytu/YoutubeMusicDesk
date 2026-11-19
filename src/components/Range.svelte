<script lang="ts">
  // Slider com trilho preenchido na cor de destaque.
  // oninput = durante o arraste; onchange = ao soltar.
  let {
    value,
    max = 100,
    step = 1,
    label,
    oninput,
    onchange,
  }: {
    value: number;
    max?: number;
    step?: number;
    label: string;
    oninput?: (v: number) => void;
    onchange?: (v: number) => void;
  } = $props();

  const pct = $derived(max > 0 ? Math.min(100, (value / max) * 100) : 0);
</script>

<input
  type="range"
  min="0"
  {max}
  {step}
  {value}
  aria-label={label}
  style:--p="{pct}%"
  oninput={(e) => oninput?.(Number(e.currentTarget.value))}
  onchange={(e) => onchange?.(Number(e.currentTarget.value))}
/>

<style>
  input {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 18px;
    background: transparent;
    cursor: pointer;
    margin: 0;
  }
  input::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 4px;
    background: linear-gradient(to right, var(--range, var(--accent)) var(--p), rgba(255, 255, 255, 0.16) var(--p));
    box-shadow: 0 0 10px -2px var(--range-glow, var(--accent-glow));
    transition: height 0.25s var(--spring);
  }
  input:hover::-webkit-slider-runnable-track {
    height: 6px;
  }
  input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    margin-top: -5px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff, #dfe7ee);
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.14), 0 2px 6px rgba(0, 0, 0, 0.5);
    transform: scale(0);
    transition: transform 0.35s var(--spring);
  }
  input:hover::-webkit-slider-thumb {
    margin-top: -4px;
    transform: scale(1);
  }
  input:active::-webkit-slider-thumb {
    transform: scale(1.15);
  }
</style>
