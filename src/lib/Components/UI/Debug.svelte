<script>
    import { isMobile } from "pixi.js";
    import { invoke } from "@tauri-apps/api/core";

    let { game } = $props();

    let fps = $state(0);
    let frameTime = $state(undefined);
    let tickTimes = $state([]);
    let tps = $derived(tickTimes.length);

    let isInputLocked = $derived(game.inputPacketManager.inputsLocked);

    let appMemory = $state(0);

    function formatBytes(bytes) {
        if (!bytes) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    game.eventEmitter.on("EntityUpdate", (e) => {
        frameTime = e.averageServerFrameTime;
        fps = game.renderer.replicator.getFps();

        if (
            game.renderer.replicator.getMsSinceTick(
                game.renderer.replicator.currentTick.tick,
            ) < 1000
        ) {
            let now = Date.now();
            tickTimes = [...tickTimes, now].filter(t => t > now - 1000);
        }
    });

    $effect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            tickTimes = tickTimes.filter(t => t > now - 1000);
        }, 100);
        return () => clearInterval(interval);
    });

    $effect(() => {
        const fetchMemory = async () => {
            try {
                appMemory = await invoke("get_memory_usage");
            } catch (e) {
                // Ignore errors when running outside Tauri desktop (e.g. web browser preview)
            }
        };
        fetchMemory();
        const interval = setInterval(fetchMemory, 2000);
        return () => clearInterval(interval);
    });
</script>

<div class="absolute text-sm lg:bottom-28 bottom-24 left-2 text-white">
    {#if isInputLocked}
        <p class="text-accent-gold">Inputs Locked</p>
    {/if}
    {#if frameTime !== undefined}
        <p class={frameTime > 50 ? "overloaded" : frameTime > 30 ? "stressed" : ""}>
            {game.network.ping}ms / {frameTime}ms / {tps} TPS
        </p>
    {:else}
        <p>
            {game.network.ping}ms / {tps} TPS
        </p>
    {/if}
    {#if !isMobile.any}
        <p>
            {Math.round(fps)} FPS {appMemory > 0 ? `/ ${formatBytes(appMemory)}` : ""}
        </p>
    {/if}
</div>

<style lang="postcss">
    @reference "../../../app.css";

    div {
        font-family: "Hammersmith One", Arial, Helvetica, sans-serif;
    }
    p {
        -webkit-text-stroke: 1px black;
        paint-order: stroke fill;
    }
    .stressed {
        @apply text-orange-400;
    }
    .overloaded {
        @apply text-accent-red;
    }
</style>
