<script>
    import { isMobile } from "pixi.js";

    let { game } = $props();

    let fps = $state(0);
    let frameTime = $state(undefined);
    let lastTick = Date.now();
    let msSinceLastTick = $state(0);
    let isWebGL = $state(null);
    let isWebGPU = $state(null);

    let isInputLocked = $derived(game.inputPacketManager.inputsLocked);

    game.eventEmitter.on("EntityUpdate", (e) => {
        frameTime = e.averageServerFrameTime;

        let now = Date.now();
        msSinceLastTick = now - lastTick;
        lastTick = now;

        if (isWebGL === null || isWebGPU === null) {
            isWebGL = game.renderer.renderer.renderer instanceof PIXI.WebGLRenderer;
            isWebGPU = game.renderer.renderer.renderer instanceof PIXI.WebGPURenderer;
        }
    });
    game.eventEmitter.on("RendererUpdated", () => {
        fps = game.renderer.replicator.getFps();
    });
</script>

<div class="absolute lg:bottom-28 bottom-24 left-2 text-white">
    {#if isInputLocked}
        <p class="text-accent-gold">Inputs Locked</p>
    {/if}
    {#if frameTime !== undefined}
        <p class={frameTime > 50 ? "overloaded" : frameTime > 30 ? "stressed" : ""}>
            {game.network.ping}ms / {frameTime}ms / {Math.round(1000 / msSinceLastTick)} TPS
        </p>
    {:else}
        <p>
            {game.network.ping}ms / {Math.round(1000 / msSinceLastTick)} TPS
        </p>
    {/if}
    {#if !isMobile.any}
        <p>
            {Math.round(fps)} FPS - {isWebGL ? "WebGL" : isWebGPU ? "WebGPU" : "Canvas"}
        </p>
    {/if}
</div>

<style lang="postcss">
    @reference "../../../app.css";

    div {
        font-family: "Hammersmith One", Arial, Helvetica, sans-serif;
    }
    .stressed {
        @apply text-orange-400;
    }
    .overloaded {
        @apply text-accent-red;
    }
</style>
