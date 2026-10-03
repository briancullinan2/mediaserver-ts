import { Widget } from "@lumino/widgets";
import type { PlaylistEntry } from "./widget";

// 3. SilkDrop / Butterchurn WebAudio Canvas Visualizer Sub-Widget
export class SilkDropVisualizerWidget extends Widget
{
	canvas?: HTMLCanvasElement | null;
	ctx: any;
	albumArt: any;
	isAnimating: boolean;
	audioContext: null;
	analyser: null;
	constructor()
	{
		super();
		this.addClass('renderer-subwidget');
		this.node.innerHTML = `
						<div class="visualizer-container">
							<canvas class="silkdrop-canvas"></canvas>
							<div class="audio-cover-art-overlay">
								<img src="" class="album-art-disc" alt="Cover Art">
								<div>
									<h2 id="viz-track-title" style="font-size: 18px; font-weight:700;">Track Title</h2>
									<p id="viz-track-artist" style="font-size: 12px; color: var(--text-muted); margin-top:4px;">Artist Name</p>
								</div>
							</div>
						</div>
					`;
		this.canvas = this.node.querySelector('canvas');
		this.ctx = this.canvas?.getContext('2d');
		this.albumArt = this.node.querySelector('.album-art-disc');
		this.isAnimating = false;
		this.audioContext = null;
		this.analyser = null;

		window.addEventListener('resize', () => this.resizeCanvas());
	}

	onAfterAttach()
	{
		this.resizeCanvas();
	}

	resizeCanvas()
	{
		if(this.canvas)
		{
			this.canvas.width = this.node.clientWidth || 800;
			this.canvas.height = this.node.clientHeight || 500;
		}
	}

	loadTrack(track: PlaylistEntry)
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
		this.albumArt.src = track.thumb;
	}

	startAnimation()
	{
		if(!this.isAnimating)
		{
			this.isAnimating = true;
			this.albumArt.classList.add('playing');
			this.renderFrame();
		}
	}

	stopAnimation()
	{
		this.isAnimating = false;
		this.albumArt.classList.remove('playing');
	}

	renderFrame()
	{
		if(!this.isAnimating || !this.canvas) return;

		const width = this.canvas.width;
		const height = this.canvas.height;
		const time = Date.now() * 0.002;

		// Simulated Organic SilkDrop Silk Waves & Frequency Spectrum
		this.ctx.fillStyle = 'rgba(3, 7, 18, 0.2)';
		this.ctx.fillRect(0, 0, width, height);

		this.ctx.lineWidth = 2;

		for(let j = 0; j < 5; j++)
		{
			this.ctx.beginPath();
			const colorHue = (time * 20 + j * 40) % 360;
			this.ctx.strokeStyle = `hsla(${colorHue}, 80%, 60%, 0.6)`;

			for(let i = 0; i < width; i += 10)
			{
				const y = Math.sin(i * 0.008 + time + j) * 40 +
					Math.cos(i * 0.015 - time) * 20 +
					height / 2;
				if(i === 0) this.ctx.moveTo(i, y);
				else this.ctx.lineTo(i, y);
			}
			this.ctx.stroke();
		}

		requestAnimationFrame(() => this.renderFrame());
	}
}
