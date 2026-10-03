import { Widget } from "@lumino/widgets";
import type { PlaylistEntry } from "./widget";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";

const visualSelf: LuminoLayoutWindow = self as unknown as any;


export class SilkDropVisualizerWidget extends Widget
{
	canvas?: HTMLCanvasElement | null;
	ctx: CanvasRenderingContext2D | null = null;
	albumArt: HTMLImageElement | null = null;
	isAnimating = false;
	audioContext = null;
	analyser = null;

	constructor()
	{
		super();
		this.addClass('renderer-subwidget');
		this.node.innerHTML = `
            <div class="visualizer-container" style="position: relative; width: 100%; height: 100%; overflow: hidden;">
                <canvas class="silkdrop-canvas" style="display: block; width: 100%; height: 100%;"></canvas>
                <div class="audio-cover-art-overlay">
                    <img src="" class="album-art-disc" alt="Cover Art">
                    <div>
                        <h2 id="viz-track-title" style="font-size: 18px; font-weight:700;">Track Title</h2>
                        <p id="viz-track-artist" style="font-size: 12px; color: var(--text-muted); margin-top:4px;">Artist Name</p>
                    </div>
                </div>
            </div>
			<div id="root" class="silkdrop-visualizer-real"></div>
        `;

		this.canvas = this.node.querySelector('.silkdrop-canvas');
		this.ctx = this.canvas?.getContext('2d') || null;
		this.albumArt = this.node.querySelector('.album-art-disc');
	}

	protected onAfterAttach(): void
	{
		this.resizeCanvas();
		visualSelf.preloadDependencies?.(['/components/player/silkdrop.js']);
	}

	// Capture Lumino layout resize events instead of window resize alone
	protected onResize(msg: Widget.ResizeMessage): void
	{
		super.onResize(msg);
		this.resizeCanvas();
	}

	private resizeCanvas(): void
	{
		if(!this.canvas) return;

		// Get exact pixel bounds of parent container
		const rect = this.node.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;

		// Match internal drawing resolution to actual display size (handling High DPI)
		const displayWidth = Math.floor(rect.width);
		const displayHeight = Math.floor(rect.height);

		if(this.canvas.width !== displayWidth || this.canvas.height !== displayHeight)
		{
			this.canvas.width = displayWidth;
			this.canvas.height = displayHeight;
		}
	}

	loadTrack(track: PlaylistEntry): void
	{
		const title = this.node.querySelector('#viz-track-title') as HTMLElement;
		if(title && track.title)
		{
			title.innerText = track.title;
		}
		const artist = this.node.querySelector('#viz-track-artist') as HTMLElement;
		if(artist && track.artist)
		{
			artist.innerText = track.artist;
		}
		if(this.albumArt && track.thumb)
		{
			this.albumArt.src = track.thumb;
		}
	}

	startAnimation(): void
	{
		if(!this.isAnimating)
		{
			this.isAnimating = true;
			this.albumArt?.classList.add('playing');
			this.renderFrame();
		}
	}

	stopAnimation(): void
	{
		this.isAnimating = false;
		this.albumArt?.classList.remove('playing');
	}

	renderFrame(): void
	{
		if(!this.isAnimating || !this.canvas || !this.ctx) return;

		const width = this.canvas.width;
		const height = this.canvas.height;
		const time = Date.now() * 0.002;

		// Use precise background clearing to prevent black border artifacts
		this.ctx.fillStyle = 'rgba(3, 7, 18, 0.2)';
		this.ctx.fillRect(0, 0, width, height);

		this.ctx.lineWidth = 2;

		for(let j = 0; j < 5; j++)
		{
			this.ctx.beginPath();
			const colorHue = (time * 20 + j * 40) % 360;
			this.ctx.strokeStyle = `hsla(${colorHue}, 80%, 60%, 0.6)`;

			// Draw slightly beyond boundaries to ensure clean edges
			for(let i = -10; i <= width + 10; i += 10)
			{
				const y = Math.sin(i * 0.008 + time + j) * 40 +
					Math.cos(i * 0.015 - time) * 20 +
					height / 2;
				if(i === -10) this.ctx.moveTo(i, y);
				else this.ctx.lineTo(i, y);
			}
			this.ctx.stroke();
		}

		requestAnimationFrame(() => this.renderFrame());
	}
}
