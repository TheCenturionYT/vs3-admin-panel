<script lang="ts">
  const INSTAB_COLORS = ['#90cc90', '#d4c060', '#e0a848', '#e07840', '#d06868', '#ff7070'];
  const INSTAB_LABELS = [
    'Fully Controlled', 'Minor Unrest', 'Growing Disorder',
    'Serious Instability', 'Near Revolt', 'Open Rebellion'
  ];

  let { level, size = 'sm' }: { level: number; size?: 'sm' | 'lg' } = $props();
  let color = $derived(INSTAB_COLORS[level] ?? '#90cc90');
  let label = $derived(INSTAB_LABELS[level] ?? 'Unknown');
  let dotClass = $derived(size === 'sm' ? 'w-2 h-2' : 'w-3 h-3');
</script>

<span class="inline-flex items-center gap-1.5">
  <span class="{dotClass} rounded-full shrink-0" style="background: {color};"></span>
  {label}
</span>
