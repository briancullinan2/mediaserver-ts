import { Widget } from "@lumino/widgets";
import type { PlaylistEntry, TrackCallback } from "./widget";
import { Message } from "@lumino/messaging";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";

const playlistSelf: LuminoLayoutWindow = self as unknown as any;

export class PlaylistPanelWidget extends Widget
{
	private wrapper: HTMLDivElement;
	private onTrackSelect: TrackCallback;
	private nowPlaying: HTMLDivElement;

	constructor(onTrackSelect: TrackCallback)
	{
		super();
		this.addClass('playlist-panel-widget');
		this.title.label = 'Playlist';
		this.title.closable = false;
		this.title.closable = true;

		this.nowPlaying = document.createElement('div') as HTMLDivElement;
		this.nowPlaying.classList.add('now-playing-wrapper');
		this.wrapper = document.createElement('div') as HTMLDivElement;
		this.wrapper.classList.add('playlist-items-wrapper');
		this.node.appendChild(this.nowPlaying);
		this.node.appendChild(this.wrapper);
		// this.wrapper = this.node.querySelector('.playlist-items-wrapper');
		this.onTrackSelect = onTrackSelect;
		this.renderTracks();
	}

	public processMessage(msg: Message): void
	{
		if(msg.type === 'close-request')
		{
			console.log('Intercepted close request, hiding instead: ' + this.title.label);

			this.hide();
			playlistSelf.mainDock?.layout?.removeWidget(this);
			return; // BAIL OUT: Avoid calling super.processMessage() to prevent disposal
		}

		super.processMessage(msg);
	}


	renderTracks(activeId = 'track-1')
	{
		this.wrapper.innerHTML = `
			<div class="playlist-header">
				<h3><i class="fa-solid fa-list-ul"></i> Up Next</h3>
				<span class="track-badge">${PLAYLIST_DATA.length} Tracks</span>
			</div>`;
		PLAYLIST_DATA.forEach(track =>
		{
			const card = document.createElement('div');
			card.className = `track-card ${track.id === activeId ? 'active' : ''}`;
			card.innerHTML = `
							<img src="${track.thumb}" class="track-thumb" alt="Thumbnail">
							<div class="track-info">
								<div class="track-title">${track.title}</div>
								<div class="track-artist">${track.artist}</div>
							</div>
							<span class="track-badge">${track.type}</span>
						`;
			card.addEventListener('click', () => this.onTrackSelect(track));
			this.wrapper.appendChild(card);
		});
		const card = document.createElement('div');
		card.className = `track-card empty-track`;
		card.innerHTML = `
						<div class="track-info">
							<div class="track-title">Your Playlist</div>
							<div class="track-artist">Drag and drop files here or open more files to play.</div>
						</div>
						<span class="track-badge">Empty</span>
					`;
		this.wrapper.appendChild(card);
	}
}

// Global Media Store State
export const PLAYLIST_DATA: PlaylistEntry[] = [
	{
		id: 'track-1',
		type: 'youtube',
		title: 'Cyberpunk Synthwave Journey',
		artist: 'Lofi Cyber Dreams',
		src: 'https://www.youtube.com/embed/5qap5aO4i9A?enablejsapi=1&autoplay=1',
		thumb: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=150&auto=format&fit=crop&q=60',
		duration: 240,
		xray: { scene: 'Neon Highway Patrol', cast: ['Cyber Unit 01', 'Synth AI'], trivia: 'Rendered in real-time 4K GLSL shaders.' }
	},
	{
		id: 'track-2',
		type: 'audio',
		title: 'Midnight Ambient Chill',
		artist: 'SilkDrop Audio Lab',
		src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
		thumb: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=150&auto=format&fit=crop&q=60',
		duration: 372,
		xray: { scene: 'Deep Space Soundstage', cast: ['SilkDrop Synth Engine'], trivia: 'Features reactive spectrum analyzer frequency nodes.' }
	},
	{
		id: 'track-3',
		type: 'video',
		title: 'Cosmic Nebula Motion',
		artist: 'NASA Visual Engine',
		src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
		thumb: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=150&auto=format&fit=crop&q=60',
		duration: 734,
		xray: { scene: 'Orbital Insertion', cast: ['Commander Vance', 'Dr. Aris'], trivia: 'Shot on 8K anamorphic space optics.' }
	},
	{
		id: 'track-4',
		type: 'photo',
		title: 'Exotic Nature Photo Series',
		artist: 'Unsplash Gallery',
		photos: [
			'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&auto=format&fit=crop&q=80',
			'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1200&auto=format&fit=crop&q=80',
			'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1200&auto=format&fit=crop&q=80'
		],
		thumb: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=150&auto=format&fit=crop&q=60',
		duration: 15,
		xray: { scene: 'Highland Ridge', cast: ['Nature Photography'], trivia: 'Google Photos style side-by-side slideshow.' }
	}
];

